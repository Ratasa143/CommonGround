import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import { applyInitialMigration, claimOutbox, createPool } from "./index.js";

const enabled = Boolean(process.env.YB_URL);
const pool = enabled ? createPool() : null;
const database = () => {
  if (!pool) throw new Error("Set YB_URL to run YugabyteDB integration tests.");
  return pool;
};

before(async () => {
  if (!pool) return;
  const sql = await readFile(new URL("../migrations/001_initial.sql", import.meta.url), "utf8");
  await applyInitialMigration(pool, sql);
});

after(async () => {
  await pool?.end();
});

test("50 concurrent duplicate reports share one idempotency row", { skip: !enabled }, async () => {
  const db = database();
  const location = `db-test-${randomUUID()}`;
  const incident = await db.query<{ id: string }>(
    `INSERT INTO incidents (category, location_id, summary)
     VALUES ('wifi_outage', $1, 'synthetic integration test') RETURNING id`,
    [location],
  );
  const incidentId = incident.rows[0]!.id;
  const key = randomUUID();
  try {
    const inserts = await Promise.all(
      Array.from({ length: 50 }, () =>
        db.query<{ id: string }>(
          `INSERT INTO reports (incident_id, idempotency_key, report_text)
           VALUES ($1, $2, 'synthetic duplicate report')
           ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
           RETURNING id`,
          [incidentId, key],
        ),
      ),
    );
    assert.equal(new Set(inserts.map((result) => result.rows[0]!.id)).size, 1);
    const count = await db.query<{ count: string }>(
      "SELECT count(*) FROM reports WHERE idempotency_key = $1",
      [key],
    );
    assert.equal(Number(count.rows[0]!.count), 1);
  } finally {
    await db.query("DELETE FROM incidents WHERE id = $1", [incidentId]);
  }
});

test("concurrent outbox workers claim a row only once", { skip: !enabled }, async () => {
  const db = database();
  const aggregateId = randomUUID();
  const correlationId = randomUUID();
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload, correlation_id)
     VALUES ('test', $1, 'test.claim', '{}'::jsonb, $2) RETURNING id`,
    [aggregateId, correlationId],
  );
  const id = inserted.rows[0]!.id;
  try {
    const [first, second] = await Promise.all([
      claimOutbox<{ id: string }>(db, { limit: 1, leaseMs: 60_000 }),
      claimOutbox<{ id: string }>(db, { limit: 1, leaseMs: 60_000 }),
    ]);
    const claimed = [...first, ...second].filter((row) => row.id === id);
    assert.equal(claimed.length, 1);
  } finally {
    await db.query("DELETE FROM outbox WHERE id = $1", [id]);
  }
});

test("expired outbox leases can be reclaimed and attempts increment", { skip: !enabled }, async () => {
  const db = database();
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload, correlation_id,
                         status, attempts, lease_expires_at)
     VALUES ('test', $1, 'test.expired', '{}'::jsonb, $2, 'processing', 1, now() - interval '1 second')
     RETURNING id`,
    [randomUUID(), randomUUID()],
  );
  const id = inserted.rows[0]!.id;
  try {
    const rows = await claimOutbox<{ id: string; attempts: number }>(db, { limit: 1, leaseMs: 60_000 });
    const reclaimed = rows.find((row) => row.id === id);
    assert.ok(reclaimed);
    assert.equal(Number(reclaimed.attempts), 2);
  } finally {
    await db.query("DELETE FROM outbox WHERE id = $1", [id]);
  }
});
