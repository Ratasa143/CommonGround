# Step 2 checkpoint — YugabyteDB data layer

Date: 2026-11-01 (Asia/Calcutta)

## Scope

Added the initial schema migration for the nine runbook domain tables plus the `schema_migrations` bookkeeping table, a typed `pg` pool/transaction helper, bounded retries for verified YSQL transaction conflict codes only, and atomic outbox claiming with row locks, leases, and attempt counts. Added three database integration tests. No domain/API/UI implementation was started.

## Correctness evidence

- `npm run build -w @commonground/db` — passed.
- `npm run migrate:db` against local YSQL — `Applied migration 001_initial`.
- Repeated `npm run migrate:db` — `Already applied migration 001_initial`.
- `npm test` with `YB_URL` set — 3 passed, 0 failed, 0 skipped; 2.417 seconds total.
  - 50 concurrent same-key reports resolve to exactly one row/UUID.
  - Concurrent outbox workers claim a row only once.
  - An expired lease is reclaimed and attempts increments from 1 to 2.
- Repeated `npm test -w @commonground/db` with `yb-node3` stopped — 3 passed, 0 failed, 0 skipped; 10.481 seconds total. During the repeat, `yb-node1` reported Running, YSQL Ready, RF=3. `yb-node3` was restarted afterward; all three containers returned to Running, and `yb-node1` again reported Ready, RF=3.
- `npm run build` — passed across all workspaces, including the Next.js production build.
- `npm run lint` — passed: `MCP SDK import boundary passed.`
- `npm run check:spikes` — passed.

## Efficiency

Elapsed Step 2 implementation and verification was approximately 12 minutes. The image pull completed from cached partial data. A fresh named volume exposed the container's non-root `yugabyte` user permissions; the Step 1 experiment was switched to the official image's writable container layer. Persistent-volume ownership remains a Step 10 task.

## Decisions

- Domain tables: `incidents`, `reports`, `status_events`, `bridge_requests`, `bridge_circles`, `bridge_members`, `human_approvals`, `meko_call_log`, and `outbox`. `schema_migrations` is bookkeeping only.
- `reports.idempotency_key` is unique. Active incident uniqueness is a partial unique index on the `(category, location_id)` hash group while status is not `resolved`.
- `status_events` and `meko_call_log` use timestamp-bucketed, ordered indexes (`yb_hash_code(created_at) % 3`) with splits at buckets 1 and 2, matching the three-node test cluster.
- `claimOutbox()` claims pending or expired rows using `FOR UPDATE SKIP LOCKED`, increments attempts, and sets a lease in the same transaction.
- `withTransaction()` retries only `40001` serialization failures and `40P01` deadlocks, with bounded exponential delay. It does not replay connection errors or uncertain commit outcomes. Callbacks must contain database work only.
- One local database process was stopped while two remained; the tests continued to pass. This supports the local single-process interruption claim only. It does not establish rack/zone or host failure tolerance because all containers share one host and no placement zones were configured.

## Evidence and references

- Migration: `packages/db/migrations/001_initial.sql`.
- Transaction and outbox API: `packages/db/src/index.ts`.
- Integration tests: `packages/db/src/index.test.ts`.
- Migration runner: `scripts/migrate-db.ts`.
- Index syntax: [YSQL CREATE INDEX](https://docs.yugabyte.com/stable/api/ysql/the-sql-language/statements/ddl_create_index/) and [bucket-based YSQL indexes](https://docs.yugabyte.com/stable/develop/data-modeling/bucket-based-index-ysql/).
- Retry policy: [YSQL transaction error codes](https://docs.yugabyte.com/stable/develop/learn/transactions/transactions-errorcodes-ysql/) and [YSQL transaction retries](https://docs.yugabyte.com/stable/develop/learn/transactions/transactions-retries-ysql/).
