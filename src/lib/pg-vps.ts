import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global { var __guPgPool: Pool | undefined; }

export function pgPool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL chưa được cấu hình trên VPS.');
  if (!globalThis.__guPgPool) {
    globalThis.__guPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      // Keep PostgreSQL listening on loopback; do not expose port 5432.
      ssl: false,
    });
  }
  return globalThis.__guPgPool;
}

export async function pgRows<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await pgPool().query<T>(sql, params);
  return result.rows;
}

export async function pgTransaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pgPool().connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* log original failure */ }
    throw error;
  } finally { client.release(); }
}
