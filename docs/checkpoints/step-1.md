# Step 1 checkpoint — Spikes and frozen contracts

Date: 2026-11-01 (Asia/Calcutta)

## Scope and status

Step 1 is complete and `packages/core` contracts are frozen for downstream implementation. Evidence and GO/NO-GO decisions per spike are recorded in `docs/SPIKE_RESULTS.md`. Meko role-specific and model fallback checks remain explicit limitations; dependent product behaviors stay gated.

## Correctness evidence

- `npm run check:spikes` — passed (`tsc -p tsconfig.spikes.json`).
- `npm run lint` — passed: `MCP SDK import boundary passed.`
- `npm run build` — passed across workspaces; Next.js production build compiled, type-checked, generated static pages, and finalized successfully.
- `npm run build -w @commonground/core` — passed; contracts compile.
- `docker pull --quiet yugabytedb/yugabyte:2026.1.2.0-b137` — passed.
- `docker compose config --quiet` — passed. Three-node cluster started; `docker exec yb-node1 bin/yugabyted status` reported Running, YSQL Ready, Replication Factor 3.
- `$env:YB_URL='postgresql://yugabyte:yugabyte@localhost:5433/yugabyte'; node --import tsx spikes/db.ts` — passed. Server: PostgreSQL 15.12-YB-2026.1.2.0-b0. Default isolation: `read committed`. Connection one locked a row; connection two's `FOR UPDATE SKIP LOCKED` returned zero rows; result `PASS`.
- Live Meko SDK list: 42 tools; schemas in `docs/MEKO_TOOLS.md`. Synthetic write/search/conversation/Owner promotion passed in `cg-spike`.
- `team-build` ID `576d6b7e-b56e-4286-a40d-82bca573e4c1` is accessible with Owner grant. After confirming it was empty, the user-requested test memory (UUID `574a4fc9-41b3-4311-9337-91cb1efb274c`) was written, found by the first query and fetched by ID in 12,986 ms through search. It was not promoted.
- Meko Maintainer/Viewer/cross-identity/quota behavior remains unverified. Keep Insights and automatic cross-identity promotion out of scope; preserve human approval in application code.
- Mistral substitute benchmark: 10/10 synthetic JSON responses valid, median 21,667 ms. Use installed `mistral:latest` as provisional local development model; validate proposal quality in Step 6. Qwen download failed DNS; Gemini wasn't tested due missing API key.

## Efficiency

Elapsed Step 1 work was approximately 1 hour 55 minutes against its 0.5–2 hour estimate. The Docker image transfer initially stalled; the retry later succeeded. A named data volume failed due to image-user permissions, so the temporary spike uses the container writable layer. Persistent-volume setup is deferred to Step 10.

## Decisions

- Freeze the compiled core contracts.
- Keep coding-agent knowledge in the confirmed `team-build` datapack; keep product `cg-*` packs separate.
- Treat Mistral as a local development baseline, not a final quality decision. Gemini is not pinned.
- Keep permission-dependent Insights and promotion integrations gated until Maintainer/Viewer credentials and cross-identity behavior are verified.
- Three-node YSQL runtime is verified; Step 2 may proceed. Do not claim node-kill tolerance before its dedicated test.

## Evidence index

`docs/SPIKE_RESULTS.md` contains full outputs and official references. `docs/MEKO_TOOLS.md` contains the live MCP input schemas.
