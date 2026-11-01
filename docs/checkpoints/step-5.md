# Step 5 checkpoint — Meko gateway

Date: 2026-11-01 (Asia/Calcutta)

## Scope

Added typed `recall`, `remember`, `openCase`, `promote`, and `uploadDocument` gateway operations in `packages/meko`. They use the tool names/schemas captured in `docs/MEKO_TOOLS.md`: memory search/add, conversation creation, memory promotion, and knowledgebase upload request. “Case opening” maps to `conversation_create`; there is no distinct case-opening MCP tool. Document upload invokes the supported upload request and expects its caller to complete the signed transfer/indexing workflow.

Every MCP call routes through one wrapper that records actor, datapack, tool, redacted request/response, outcome, elapsed time, correlation ID, and simulated flag in Step 2's `meko_call_log`. `MEKO_MODE=off` records a bypass. Recall results cache for 60 seconds by incident, datapack, and query. Retries are configurable and clamped to at most two; timeout is bounded to 15 seconds. Promotion requires `approval-service`, an approver credential, and a persisted `approved` row for the memory being promoted. Product datapack IDs and agent/approver credentials are environment-configured; none are currently configured in this workspace.

## Correctness evidence

- `npm run build --workspace=@commonground/meko` — passed.
- `npm test --workspace=@commonground/meko` — 5 passed, 0 failed, 0 skipped. Covers redacted call logging and 60-second cache behavior, off-mode bypass, approval/credential gate, missing datapack fail-closed behavior, and bad-token failure logging.
- `npm run lint` — passed: `MCP SDK import boundary passed.`
- `npm run check:spikes` — passed.
- Environment check: `MEKO_MCP_URL=missing`, `MEKO_AGENTS_TOKEN=missing`, `MEKO_APPROVER_TOKEN=missing`, `MEKO_TRIAGE_DATAPACK_ID=missing`, `MEKO_BRIDGE_DATAPACK_ID=missing`, `MEKO_COMMONS_DATAPACK_ID=missing`, `local .env=missing`.

## Blockers and decisions

- A live, gated product-datapack round trip cannot be run until the product datapack IDs and product agent/approver credentials are available as local environment variables. The coding-agent `team-build` datapack is not used for product operations.
- The verified account quota values and cross-identity promotion behavior remain unverified from Step 1, so no quota comparison or cross-identity claim is made. Promotion remains code-gated.
- Generic email, phone, and room identifiers are redacted in gateway logs. Known names must be redacted by the caller before submitting free text; this module does not infer arbitrary personal names.
- `STUB_MEKO=true` is supported for local tests/load tests only; it is marked simulated and does not claim remote success.

Elapsed implementation and focused verification: approximately 6 minutes. Scope supports the future S1–S7 integration but does not yet connect the product agents because credentials/datapacks are missing. Do not start Step 6 until the live integration gate is resolved or the runbook is explicitly revised.

## Evidence index

- Gateway: `packages/meko/src/index.ts`.
- Tests: `packages/meko/src/index.test.ts`.
- Verified schemas: `docs/MEKO_TOOLS.md`.
- Product environment variable names: `.env.example`.

## Role-separation implementation update — 2026-11-01

Replaced the shared product-agent token with fixed Triage, Bridge, Curator, and Approval Service facades; configured a separate token and Meko `agent_id` per role; blocked out-of-policy role/datapack/tool combinations; and require conversation IDs returned by that role's `conversation_create`. `MEKO_APPROVER_TOKEN` remains separate, and promotion still checks the approved `human_approvals` row before transport. Knowledge-base upload is not exposed until a role and required Maintainer grant are explicitly authorized.

Verification: `npm run build --workspace=@commonground/meko`, `npm test --workspace=@commonground/meko` (10 passed, 0 failed, 0 skipped), `npm run lint`, and `npm run check:spikes` passed. No live Meko calls or writes were performed. Cross-account promotion of a Curator-created private memory by the Approval Service remains an unverified live permission gate; Step 1 previously verified only Owner self-promotion. Keep Step 6 and live product wiring gated until that behavior is safely verified.
