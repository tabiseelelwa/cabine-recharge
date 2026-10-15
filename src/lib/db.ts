import * as mysql from 'mysql2/promise';

// Réutilise le pool entre les rechargements à chaud en développement
const g = globalThis as unknown as { __pool?: mysql.Pool };

const host = process.env.DB_HOST || '127.0.0.1';
const isLocal = host === '127.0.0.1' || host === 'localhost';

// SSL obligatoire pour TiDB Cloud ; désactivé en local (forçable avec DB_SSL=true/false)
const useSsl = process.env.DB_SSL ? process.env.DB_SSL === 'true' : !isLocal;

const CONFIG: mysql.ConnectionOptions = {
  host,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cabine_recharge',
  ...(useSsl && { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }),
};

/** Connexion dédiée acceptant plusieurs instructions (migrations, restauration). À fermer avec .end() */
export function connexionMultiple() {
  return mysql.createConnection({ ...CONFIG, multipleStatements: true, charset: 'utf8mb4', dateStrings: true });
}

export const pool: mysql.Pool =
  g.__pool ??
  mysql.createPool({
    ...CONFIG,
    waitForConnections: true,
    connectionLimit: 10,
    decimalNumbers: true,
    dateStrings: true,
    charset: 'utf8mb4',
  });

if (process.env.NODE_ENV !== 'production') g.__pool = pool;

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
