import mysql, { type Pool, type PoolConnection, type PoolOptions, type ResultSetHeader } from 'mysql2/promise';

type Params = unknown[];

const env = process.env;
const host = env.DB_HOST ?? '127.0.0.1';
const isLocal = ['127.0.0.1', 'localhost'].includes(host);

/** SSL obligatoire pour TiDB Cloud ; désactivé en local sauf si DB_SSL=true */
const useSsl = env.DB_SSL ? env.DB_SSL === 'true' : !isLocal;

const config: PoolOptions = {
  host,
  port: Number(env.DB_PORT ?? (isLocal ? 3306 : 4000)),
  user: env.DB_USER ?? 'root',
  password: env.DB_PASSWORD ?? '',
  database: env.DB_NAME ?? 'cabine_recharge',
  charset: 'utf8mb4',
  dateStrings: true,
  decimalNumbers: true,
  ...(useSsl && { ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true } }),
};

// Un seul pool par instance (évite d'en recréer à chaque rechargement à chaud en dev)
const globalForDb = globalThis as unknown as { __pool?: Pool };

export const pool: Pool =
  globalForDb.__pool ??
  mysql.createPool({
    ...config,
    waitForConnections: true,
    connectionLimit: isLocal ? 10 : 5, // limiter les connexions côté serverless
    enableKeepAlive: true,
  });

if (env.NODE_ENV !== 'production') globalForDb.__pool = pool;

/** Connexion dédiée multi-instructions (migrations, restauration). Penser à appeler .end() */
export const connexionMultiple = () => mysql.createConnection({ ...config, multipleStatements: true });

/** SELECT : renvoie toutes les lignes */
export async function query<T = unknown>(sql: string, params: Params = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** SELECT : renvoie la première ligne ou null */
export async function queryOne<T = unknown>(sql: string, params: Params = []): Promise<T | null> {
  const [first] = await query<T>(sql, params);
  return first ?? null;
}

/** INSERT / UPDATE / DELETE */
export async function execute(sql: string, params: Params = []): Promise<ResultSetHeader> {
  const [result] = await pool.query<ResultSetHeader>(sql, params);
  return result;
}

/** Exécute `fn` dans une transaction (commit si succès, rollback sinon) */
export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
