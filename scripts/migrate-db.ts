import { readFile } from "node:fs/promises";
import { applyInitialMigration, createPool } from "../packages/db/src/index.ts";

const pool = createPool();
try {
  const sql = await readFile(new URL("../packages/db/migrations/001_initial.sql", import.meta.url), "utf8");
  const applied = await applyInitialMigration(pool, sql);
  process.stdout.write(`${applied ? "Applied" : "Already applied"} migration 001_initial\n`);
} finally {
  await pool.end();
}
