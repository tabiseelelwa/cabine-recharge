import * as mysql from 'mysql2/promise';

const isTiDB = process.env.DB_HOST?.includes('tidbcloud.com') ?? false;

const CONFIG: mysql.ConnectionOptions = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || (isTiDB ? 4000 : 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cabine_recharge',
  ssl: isTiDB ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
  charset: 'utf8mb4',
  dateStrings: true,
  connectTimeout: 10000,
};

// Réutilise le pool entre les rechargements à chaud en développement
const g = globalThis as unknown as { __pool?: mysql.Pool };

export const pool: mysql.Pool =
  g.__pool ??
  mysql.createPool({
    ...CONFIG,
    decimalNumbers: true,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
  });

if (process.env.NODE_ENV !== 'production') g.__pool = pool;

/** Connexion dédiée acceptant plusieurs instructions (migrations, restauration). À fermer avec .end() */
export function connexionMultiple() {
  return mysql.createConnection({ ...CONFIG, multipleStatements: true });
}

/** Requête SELECT : renvoie les lignes */
export async function query<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** Première ligne ou null */
export async function queryOne<T = any>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE */
export async function execute(sql: string, params: unknown[] = []) {
  const [res] = await pool.query(sql, params);
  return res as mysql.ResultSetHeader;
}

/** Exécute une fonction dans une transaction */
export async function transaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}