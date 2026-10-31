# Step 1 checkpoint — Spikes and frozen contracts

Date: 2026-10-31 (Asia/Calcutta)

## Scope

Completed the core Zod contracts and live direct Meko SDK tool/schema and synthetic round-trip spikes. The Yugabyte runtime spike is blocked on downloading the pinned image. The model spike has a substitute Mistral benchmark; the requested Qwen and Gemini checks remain unavailable. No Step 2 data-layer implementation started because Step 1 gates are not complete.

## Correctness evidence

- `npm run check:spikes` — passed (`tsc -p tsconfig.spikes.json`).
- `npm run lint` — passed: `MCP SDK import boundary passed.`
- `npm run build` — passed across all workspaces; Next.js production build compiled, type-checked, generated static pages, and finalized successfully.
- `npm run build -w @commonground/core` — passed earlier; contracts compile.
- `docker compose config --quiet` — passed.
- `docker info --format '{{.ServerVersion}}'` — `29.6.2`.
- `docker compose up -d` — attempted with pinned image `yugabytedb/yugabyte:2026.1.2.0-b137`. Image transfer advanced to 109.1 MB on an active layer over about 45 minutes and was interrupted; `docker compose ps --format '{{.Name}} {{.State}}'` returned no containers. No SQL or transaction evidence exists.
- Meko direct SDK `tools/list` — 42 tools; live schemas saved in `docs/MEKO_TOOLS.md`. Synthetic memory round trip found the test marker; write plus first successful search took 8,573 ms. Synthetic conversation message accepted. Owner-only promotion succeeded in isolated `cg-spike`.
- Meko Maintainer, Viewer, cross-identity, and quota checks — unverified; no suitable identities/credentials were available. Dedicated team build datapack ID — not supplied; no project memory saved in any datapack.
- Ollama Mistral substitute — 10/10 valid synthetic JSON responses, 21,667 ms median. Qwen3 8B pull failed DNS resolution; Gemini model listing/live call not run because no API key was available.

## Efficiency

Elapsed work for this continuation was approximately 45–50 minutes, driven by the Docker image transfer. This exceeds the Step 1 target's 2-hour upper bound only if combined with the earlier Step 1 work; do not add scope. Do not start Step 2 until the blocked Step 1 gates are either verified or explicitly revised in the runbook.

## Decisions and outstanding gates

- Keep the verified contracts as the current core candidate, but do not freeze them as a completed Step 1 checkpoint until all required evidence and decisions are addressed.
- Keep Meko project knowledge out of the default and `cg-spike` datapacks. Need the team-created build datapack's real ID. Retest identity-sensitive Meko checks with correct roles before relying on those permissions.
- Do not select Mistral as the product model from this substitute run. Need the Qwen benchmark or an approved change to the local-model gate; Gemini requires a configured key and model listing.
- Retry the Yugabyte image pull when registry/blob transfer is reliable; then run `npm run spike:db` and record version, isolation, and two-connection lock output.
- `docs/SPIKE_RESULTS.md` records current evidence and failures.
