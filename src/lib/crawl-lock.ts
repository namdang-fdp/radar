import type { Pool, PoolClient } from 'pg';

const LOCK_ID = 81457202;
export async function acquireCrawlLock(pool: Pool): Promise<PoolClient | null> {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT pg_try_advisory_lock($1,hashtext(current_schema())) AS acquired', [LOCK_ID]);
    if (result.rows[0].acquired) return client;
    client.release();
    return null;
  } catch (error) { client.release(); throw error; }
}
export async function releaseCrawlLock(client: PoolClient) {
  try { await client.query('SELECT pg_advisory_unlock($1,hashtext(current_schema()))', [LOCK_ID]); }
  finally { client.release(); }
}
