# Step 1 spike results

Run date: 2026-10-31 (Asia/Calcutta)

| Spike | Result | Evidence | Gate / next action |
|---|---|---|---|
| Meko capabilities | **Partial GO** | Live Codex surface exposed 42 tools; names and schemas are in `docs/MEKO_TOOLS.md`. Direct SDK `tools/list` completed with 42 tools. In isolated `cg-spike`, synthetic memory write/search, conversation message, and Owner promotion succeeded. Direct write plus first successful search took 8,573 ms. | Maintainer, Viewer, cross-identity, quota, and indexing latency as a separate measure remain unverified. Build datapack is not available; do not store project knowledge in default or `cg-spike`. |
| YugabyteDB | **Blocked on image transfer** | Pinned Compose file passes `docker compose config --quiet`; Docker 29.6.2 server is responsive. `docker compose up -d` advanced to 109.1 MB on an image layer after a long transfer, then was interrupted. `docker compose ps` returned no containers. No SQL result yet. | Retry when Docker registry/blob transfer is reliable; then record server version, default isolation, and two-connection `SKIP LOCKED` output from `npm run spike:db`. |
| Local model / Gemini | **Partial** | Ollama 0.30.7 has `mistral:latest` and `llama3:latest`. Ten synthetic JSON calls using Mistral yielded 10/10 valid responses and 21,667 ms median latency. Qwen3 8B download failed with DNS resolution errors for the model blob host. `GEMINI_API_KEY` is unavailable, so no live model list/request was made. | Qwen target remains unverified. Do not pin Mistral as the product model based on this substitute benchmark. Gemini ID and request fields remain unverified pending key access. |
| Core contracts | **GO** | `npm run build -w @commonground/core` passed with Zod 4.6.7. Contracts define statuses/transitions, event names, datapack names, actors, UUID correlation IDs, triage proposals, lesson drafts, and minimal Bridge handoffs. | Freeze after all Step 1 gates and checkpoint evidence are complete. |

## Meko evidence detail

- `cg-spike` was created specifically for synthetic integration data. Search returned marker `CG01-MEKO-TEST`. No live student narratives or personal data were used.
- The direct client in `packages/meko/src/spike-client.ts` uses installed `@modelcontextprotocol/sdk` 1.32.0 and completed live `tools/list` with 42 tools; schemas are captured in `docs/MEKO_TOOLS.md`.
- Direct synthetic memory write plus first successful search took 8,573 ms. This does not isolate server indexing delay from request latency.
- `conversation_add_message` returned `accepted` with a message ID.
- `memory_promote` returned the memory UUID under `inserted_ids` using Owner access only. This does not prove Maintainer or cross-identity promotion.
- A local `MEKO_MCP_TOKEN` is configured in the elevated user environment; its value was never printed or written to the repository.

## Runtime and API references

- YugabyteDB image and Docker launch pattern: [official YugabyteDB Docker quick start](https://docs.yugabyte.com/stable/quick-start/docker/).
- Read Committed support/default behavior: [official YugabyteDB isolation documentation](https://docs.yugabyte.com/stable/architecture/transactions/isolation-levels/).
- `SKIP LOCKED` support: [official YugabyteDB concurrency control documentation](https://docs.yugabyte.com/stable/architecture/transactions/concurrency-control/).
- Gemini compatible model listing and endpoint: [official Google Gemini OpenAI compatibility documentation](https://ai.google.dev/gemini-api/docs/openai/).
- Ollama local OpenAI-compatible endpoint: [official Ollama compatibility documentation](https://docs.ollama.com/api/openai-compatibility).
