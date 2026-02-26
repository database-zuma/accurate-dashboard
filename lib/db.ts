import { Pool } from "pg";

const globalForPg = globalThis as unknown as { pool: Pool | undefined };

export const pool =
  globalForPg.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 20000,
  });

// Cache pool globally to avoid creating new pools per request
globalForPg.pool = pool;

export default pool;
