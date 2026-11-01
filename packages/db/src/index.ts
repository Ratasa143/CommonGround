import { Pool, type PoolClient, type QueryResultRow } from "pg";

export interface TransactionOptions {
  /** Number of retries after the first attempt. */
  maxRetries?: number;
  /** Base delay for exponential backoff, in milliseconds. */
  baseDelayMs?: number;
}

const RETRYABLE_SQLSTATES = new Set(["40001", "40P01"]);

function sqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createPool(connectionString = process.env.YB_URL): Pool {
  if (!connectionString) throw new Error("Set YB_URL in the process environment.");
  return new Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
}

/**
 * Runs database-only work in a transaction. Retries Yugabyte/PostgreSQL
 * transaction conflict codes only; connection and commit-ack failures are not
 * replayed because their outcome may be uncertain.
 */
export async function withTransaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 20;
  if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) {
    throw new RangeError("maxRetries must be an integer from 0 through 5.");
  }

  for (let attempt = 0; ; attempt += 1) {
    const client = await pool.connect();
    let transactionOpen = false;
    let retryDelay = 0;
    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const result = await work(client);
      await client.query("COMMIT");
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
      const retry = RETRYABLE_SQLSTATES.has(sqlState(error) ?? "") && attempt < maxRetries;
      if (!retry) throw error;
      retryDelay = baseDelayMs * 2 ** attempt;
    } finally {
      client.release();
    }
    if (retryDelay > 0) await sleep(retryDelay);
  }
}

export interface ClaimOutboxOptions {
  limit?: number;
  leaseMs?: number;
}

/** Claims pending or expired outbox rows without blocking other workers. */
export async function claimOutbox<T extends QueryResultRow = QueryResultRow>(
  pool: Pool,
  options: ClaimOutboxOptions = {},
): Promise<T[]> {
  const limit = options.limit ?? 10;
  const leaseMs = options.leaseMs ?? 30_000;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError("limit must be an integer from 1 through 100.");
  }
  if (!Number.isInteger(leaseMs) || leaseMs < 1) {
    throw new RangeError("leaseMs must be a positive integer.");
  }

  return withTransaction(pool, async (client) => {
    const result = await client.query<T>(
      `WITH candidates AS (
         SELECT id
         FROM outbox
         WHERE (status = 'pending' AND available_at <= now())
            OR (status = 'processing' AND lease_expires_at <= now())
         ORDER BY created_at ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE outbox AS item
       SET status = 'processing',
           lease_expires_at = now() + ($2 * interval '1 millisecond'),
           attempts = item.attempts + 1,
           updated_at = now()
       FROM candidates
       WHERE item.id = candidates.id
       RETURNING item.*`,
      [limit, leaseMs],
    );
    return result.rows;
  });
}

export async function applyInitialMigration(pool: Pool, sql: string): Promise<boolean> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
  const existing = await pool.query<{ version: string }>(
    "SELECT version FROM schema_migrations WHERE version = $1",
    ["001_initial"],
  );
  if (existing.rowCount) return false;
  await pool.query(sql);
  await pool.query(
    `INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING`,
    ["001_initial"],
  );
  return true;
}
