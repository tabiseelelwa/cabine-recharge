import type { Connection } from 'mysql2/promise';
export function migrer(conn: Connection, log?: (msg: string) => void): Promise<void>;
