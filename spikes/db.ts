import { randomUUID } from "node:crypto";
import { Client } from "pg";

const connectionString = process.env.YB_URL;
if (!connectionString) throw new Error("Set YB_URL in the process environment.");

const first = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
const second = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
const table = `cg_spike_skip_locked_${randomUUID().replaceAll("-", "")}`;

try {
  await Promise.all([first.connect(), second.connect()]);

  const version = await first.query("SELECT version() AS version");
  console.log(JSON.stringify({ query: "SELECT version()", rows: version.rows }, null, 2));

  const isolation = await first.query("SHOW default_transaction_isolation");
  console.log(JSON.stringify({ query: "SHOW default_transaction_isolation", rows: isolation.rows }, null, 2));

  await first.query(`CREATE TABLE ${table} (id uuid PRIMARY KEY)`);
  const id = randomUUID();
  await first.query(`INSERT INTO ${table} (id) VALUES ($1)`, [id]);

  await first.query("BEGIN");
  const locked = await first.query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
  console.log(JSON.stringify({ connection: "first", query: "SELECT ... FOR UPDATE", rowCount: locked.rowCount }, null, 2));

  await second.query("BEGIN");
  const skipped = await second.query(`SELECT id FROM ${table} WHERE id = $1 FOR UPDATE SKIP LOCKED`, [id]);
  console.log(JSON.stringify({ connection: "second", query: "SELECT ... FOR UPDATE SKIP LOCKED", rowCount: skipped.rowCount }, null, 2));
  if (skipped.rowCount !== 0) throw new Error("SKIP LOCKED did not skip the row held by the first connection.");

  await second.query("COMMIT");
  await first.query("COMMIT");
  console.log(JSON.stringify({ result: "PASS", explanation: "The second connection skipped the row locked by the first." }, null, 2));
} finally {
  await Promise.allSettled([first.query("ROLLBACK"), second.query("ROLLBACK")]);
  await first.query(`DROP TABLE IF EXISTS ${table}`).catch(() => undefined);
  await Promise.allSettled([first.end(), second.end()]);
}
