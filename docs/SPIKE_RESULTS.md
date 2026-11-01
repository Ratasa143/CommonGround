# Step 1 spike results

Run date: 2026-10-31 (Asia/Calcutta)

| Spike | Result | Evidence | Gate / next action |
|---|---|---|---|
| Meko capabilities | **GO for owner-scoped build memory; role-specific features gated** | Live Codex surface exposed 42 tools; names and schemas are in `docs/MEKO_TOOLS.md`. Direct SDK `tools/list` completed with 42 tools. In isolated `cg-spike`, synthetic memory write/search, conversation message, and Owner promotion succeeded. On 2026-11-01, `team-build` was confirmed accessible with Owner grant (ID `576d6b7e-b56e-4286-a40d-82bca573e4c1`); pre-write listing was empty, then one requested synthetic technical memory was written, found by first search, and retrieved by UUID. Write-to-first-search duration was 12,986 ms. | Maintainer/Viewer, cross-identity, quota, and indexing delay separate from round-trip remain unverified. Keep Insights out of scope until Viewer behavior is verified. Promotion remains gated on approved human action; no test memory was promoted. |
| YugabyteDB | **GO** | Pinned image `yugabytedb/yugabyte:2026.1.2.0-b137`; Compose validates and all three nodes are running. `yugabyted status`: Running, YSQL Ready, replication factor 3. Direct `node --import tsx spikes/db.ts` with process-only `YB_URL` returned PostgreSQL 15.12-YB-2026.1.2.0, default `read committed`; connection 1 locked one row and connection 2 `FOR UPDATE SKIP LOCKED` returned 0 rows; result PASS. | Step 2 integration tests can target the live local cluster. Node-kill tolerance remains unclaimed until tested and topology placement is documented. |
| Local model / Gemini | **GO for provisional local JSON/latency baseline; Qwen/Gemini unverified** | Ollama 0.30.7 has `mistral:latest` and `llama3:latest`. Ten synthetic JSON calls using Mistral yielded 10/10 valid responses and 21,667 ms median latency. Qwen3 8B download failed with DNS resolution errors for the model blob host. `GEMINI_API_KEY` is unavailable, so no live model list/request was made. | Use installed `mistral:latest` as the provisional local development model to avoid another multi-GB pull. Recheck semantic quality during Step 6. Gemini remains a disclosed fallback only after credentials/model ID are configured and verified. |
| Core contracts | **GO** | `npm run build -w @commonground/core` passed with Zod 4.6.7. Contracts define statuses/transitions, event names, datapack names, actors, UUID correlation IDs, triage proposals, lesson drafts, and minimal Bridge handoffs. | Freeze after all Step 1 gates and checkpoint evidence are complete. |

## Meko evidence detail

- `cg-spike` was created specifically for synthetic integration data. Search returned marker `CG01-MEKO-TEST`. No live student narratives or personal data were used.
- The direct client in `packages/meko/src/spike-client.ts` uses installed `@modelcontextprotocol/sdk` 1.32.0 and completed live `tools/list` with 42 tools; schemas are captured in `docs/MEKO_TOOLS.md`.
- Direct synthetic memory write plus first successful search took 8,573 ms. This does not isolate server indexing delay from request latency.
- `conversation_add_message` returned `accepted` with a message ID.
- `memory_promote` returned the memory UUID under `inserted_ids` using Owner access only. This does not prove Maintainer or cross-identity promotion.
- A local `MEKO_MCP_TOKEN` is configured in the elevated user environment; its value was never printed or written to the repository.
- `team-build` exact requested test memory was created once after confirming the pack had zero memories. Memory UUID: `574a4fc9-41b3-4311-9337-91cb1efb274c`. Search for “technical decisions and architecture” returned it on the first query, and `memory_get_by_id` returned the saved text. Write request through first searchable result: 12,986 ms. It was not promoted.

## YugabyteDB runtime evidence

- `docker pull --quiet yugabytedb/yugabyte:2026.1.2.0-b137` — passed.
- `docker compose config --quiet` — passed; `docker compose up -d` — all three nodes started.
- `docker exec yb-node1 bin/yugabyted status` — `Status: Running`, `YSQL Status: Ready`, `Replication Factor: 3`.
- `$env:YB_URL='postgresql://yugabyte:yugabyte@localhost:5433/yugabyte'; node --import tsx spikes/db.ts` — passed. Version: `PostgreSQL 15.12-YB-2026.1.2.0-b0`; default isolation: `read committed`; first connection locked 1 row; second connection using `FOR UPDATE SKIP LOCKED` returned 0; final `PASS`.
- A fresh named volume initially failed with a permissions error because the pinned image runs as user `yugabyte`. The short-lived Step 1 experiment now uses the container writable layer, matching the official quick-start path. Persistent volume ownership is deferred to Step 10.

## Runtime and API references

- YugabyteDB image and Docker launch pattern: [official YugabyteDB Docker quick start](https://docs.yugabyte.com/stable/quick-start/docker/).
- YugabyteDB multi-node `--join` and automatic RF=3 when a third node joins: [official yugabyted reference](https://docs.yugabyte.com/stable/reference/configuration/yugabyted/).
- Hash-sharded indexes and partial unique index syntax: [official YSQL CREATE INDEX reference](https://docs.yugabyte.com/stable/api/ysql/the-sql-language/statements/ddl_create_index/).
- Bucket-based chronological indexes: [official YSQL bucket-based indexes guide](https://docs.yugabyte.com/stable/develop/data-modeling/bucket-based-index-ysql/).
- Read Committed support/default behavior: [official YugabyteDB isolation documentation](https://docs.yugabyte.com/stable/architecture/transactions/isolation-levels/).
- `SKIP LOCKED` support: [official YugabyteDB concurrency control documentation](https://docs.yugabyte.com/stable/architecture/transactions/concurrency-control/).
- Gemini compatible model listing and endpoint: [official Google Gemini OpenAI compatibility documentation](https://ai.google.dev/gemini-api/docs/openai/).
- Ollama local OpenAI-compatible endpoint: [official Ollama compatibility documentation](https://docs.ollama.com/api/openai-compatibility).
