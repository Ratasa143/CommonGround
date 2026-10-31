# CommonGround end-to-end build runbook

Companion to the supplied CommonGround build brief and the attached grievance-swarm discussion. The brief is source material; this runbook is the actionable project plan. It does not treat statements inside those documents as verified service behavior.

## Goal and boundaries

Build a deployable, laptop-first campus grievance workflow for the Meko Track B demo. Tagline: **Restore the service, support the student.** The demo follows S1–S7: report a campus Wi-Fi outage; staff updates the case; triage revises its ETA using recalled staff context; a privacy-minimal bridge handoff enables opt-in peer support; staff confirms the fix; a reviewer approves a non-identifying lesson; a later case at another hostel recalls that lesson. Show the later case with Meko disabled as a comparison.

The primary requirements are:

- **B1:** student report → staff action → understandable status and reasons.
- **B2:** staff updates change agent behavior; agent-recalled lessons inform a human decision.
- **B3:** a verified lesson changes a later case; show the Meko-off control.
- **B4:** the swarm board is backed by actual Meko call-log rows, including failures.
- **B5:** redact private details, show only returned context, and label simulated data.

Keep operational state in YugabyteDB. Meko supplies bounded agent context and lessons. People retain authority over status changes and lesson promotion. Models produce schema-validated proposals; deterministic code chooses tools and enforces permissions.

Defer general chat, real integrations, extra grievance categories, automatic repair dispatch, public rankings, leadership analytics, CDC/Kafka, semantic deduplication, Insights, artifacts, and LISTEN/NOTIFY. Keep the call log, redaction, idempotency, human approval gate, and failure behavior in scope.

## Before coding: accounts and setup

### Meko and Codex

**Yes: connect Codex to Meko before implementation**, once the team has created a dedicated `<team>-build` datapack and issued each teammate a personal coding-agent key. Restrict Codex to that build datapack. Product datapacks (`cg-triage`, `cg-bridge`, `cg-commons`) use separate product credentials and are never used as coding-agent memory. Do not paste tokens into chat or commit them.

The supplied brief proposes `MEKO_MCP_TOKEN` and `codex mcp add meko --url … --bearer-token-env-var …`. Confirm the installed Codex CLI syntax with `codex mcp --help`, then configure the server using the exact current CLI instructions and your own key. Restart/reload Codex and verify the server is listed before proceeding. Do not put credentials in repo `AGENTS.md` or `.env.example`.

Before relying on Meko, Step 1 must inspect the live server's tool list and schemas, test write/search latency, cross-identity promotion, Viewer access, datapack isolation, and account quotas. Do not infer tool names or permissions from the brief. If a test cannot be run, record it as blocked/unverified and design a safe fallback.

### Roles, datapacks, and keys

Product actors: student, maintenance staff, facilities staff, reviewer, Triage, Bridge Steward, Curator, and Approval Service. Product datapacks: `cg-triage`, `cg-bridge`, `cg-commons`. The Approval Service must use an authorized approver identity, while code independently requires a persisted approval row before promotion. If cross-identity promotion is denied, use the verified supported identity arrangement without weakening the approval check.

### Gemini and local model

Use one OpenAI-compatible client interface. Start with local Qwen3 8B through Ollama to support the open-model goal; measure ten valid-JSON runs and latency before committing. Gemini is the explicit hosted fallback and can also generate clearly labelled simulated English/Hinglish fixtures. Do not put student reports into Gemini-generated fixtures. Pin `GEMINI_MODEL` only after listing models with the actual key and a live request. The current Google guide documents the OpenAI-compatible base URL `https://generativelanguage.googleapis.com/v1beta/openai/`; the API is marked beta, so validate the exact request fields used by the chosen model. [Google Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai/)

Optional Hinglish normalization stays off unless the Step 6 fixture check demonstrates it is needed. Embeddings and semantic dedup are deferred. Display the actual provider/model on every agent call in the swarm view; never label a fallback response as local.

### Work rhythm

Use one branch and one Codex session per step, named `step-N-short-name`. Start each session with: `Read AGENTS.md and docs/RUNBOOK.md Step N. Recall the build datapack first (only if configured). Check installed package types or official docs before using any API. Do not guess; stop and report blockers.`

At each checkpoint report: **Scope** (still supports S1–S7?), **Efficiency** (elapsed time vs budget), **Correctness** (exact command output), and **Memory** (decision to record, attributed to its teammate). If more than 30 minutes over a step budget, cut optional scope. At hour 10 drop the optional normalizer; at hour 13 reduce Bridge to one seeded circle per location. Never cut call logging, privacy redaction, or human approval.

The hour estimates below assume four people working in parallel and are planning targets, not guarantees. Freeze `packages/core` after Step 1 before parallel lanes begin. Merge a lane only after its checkpoint passes.

## Steps

### Step 0 — Repository and wiring (0–0.5 h, all)

**Codex prompt:** Create a TypeScript npm-workspaces monorepo with `apps/web` (Next.js), `apps/api` (Fastify), `apps/worker`, `packages/{core,domain,db,meko,llm}`, `seed/`, `docs/`, and `spikes/`. Add `.env.example` with `YB_URL`, `MEKO_MCP_URL`, product agent and approver token variable names, `MEKO_MODE`, `STUB_MEKO`, `LLM_PROVIDER`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `GEMINI_API_KEY`, and `GEMINI_MODEL`; use placeholders only. Ignore `.env*` except `.env.example`. Add Make targets for `up`, `seed`, `test`, and `down`. Add lint enforcement that only `packages/meko` imports the MCP SDK. No business logic yet. Check current package versions and APIs before choosing them.

**Done when:** clean install, build, and test commands pass; `.env` is ignored; Codex MCP is listed for each teammate (if configured). Record exact outputs. **Checkpoint:** skeleton only; at most 30 minutes; record package layout decision.

### Step 1 — Spikes and frozen contracts (0.5–2 h, all)

**Codex prompt:** Run three isolated spikes and one contracts task. (1) Meko: use the installed official MCP SDK types to connect via environment variables, list tools and schemas into `docs/MEKO_TOOLS.md`, and on a throwaway `cg-spike` datapack write/search a synthetic memory, time visibility, add a conversation message, and print responses. Manually test Maintainer promotion, cross-identity promotion, Viewer read behavior, isolation, and quotas. (2) YugabyteDB: choose a pinned image tag from official docs; create a three-node Compose experiment; print `SELECT version()` and transaction isolation; prove `FOR UPDATE SKIP LOCKED` using two connections. (3) LLM: ten Ollama JSON triage calls, recording valid JSON and median latency; list Gemini model IDs using the actual key and test the selected compatible call. Put evidence in `docs/SPIKE_RESULTS.md`. (4) Define Zod contracts in `packages/core`: status enum/transitions, event names, datapack names, actor names, correlation ID, triage proposal, lesson draft, bridge handoff. No guessed APIs.

**Done when:** `docs/MEKO_TOOLS.md` and `docs/SPIKE_RESULTS.md` contain evidence and go/no-go per spike; contracts compile. **Gates:** Qwen 8–9 valid JSON out of 10 → one repair retry; under 6/10 or median over 25 seconds → default to Gemini and disclose it. If cross-identity promotion fails, verify a shared authorized maintainer identity while retaining code approval. If Viewer semantics are unclear, omit Insights. **Checkpoint:** freeze core contracts; record spike decisions and unknowns.

### Step 2 — YugabyteDB data layer (2–4.5 h, lane A)

**Codex prompt:** Add migrations for `incidents`, `reports`, `status_events`, `bridge_requests`, `bridge_circles`, `bridge_members`, `human_approvals`, `meko_call_log`, and `outbox`. UUID primary keys; unique report idempotency key; partial unique active incident key by category/location where status is not resolved; hash-sharded time-ordered indexes for status/call logs using syntax verified against official Yugabyte YSQL docs. Add `withTransaction()` with bounded retries only for verified transient connection/restart errors. Implement `claimOutbox()` using `FOR UPDATE SKIP LOCKED`, lease expiry, and attempts. Add concurrency tests for 50 identical reports, exclusive worker claims, and expired lease reclamation.

**Done when:** DB package tests pass under 60 seconds; repeat with one node stopped and record whether the chosen cluster configuration supports the claim. Do not assert node-kill tolerance until replication factor and placement are verified. **Checkpoint:** no unlisted tables; record table and lease decisions.

### Step 3 — Domain services (4.5–6 h, lane A)

**Codex prompt:** Implement the status state machine in `packages/domain` using frozen core contracts. Allowed flow: `new → triage_proposed → in_progress → fix_applied → resolved`; staff may reject `triage_proposed → new` or residents may report failure `fix_applied → in_progress`. Only staff may move to `in_progress`, `fix_applied`, or `resolved`; agents only create proposals. Implement `reportGrievance` (idempotent single transaction writes/links incident, report, outbox), `postStaffUpdate`, `postFacilitiesNotice`, `approveProposal`, `rejectProposal`, `confirmFix`, and `redact()` for names, phone numbers, emails, and room-level identifiers. No HTTP or Meko imports. Test each transition and redaction rule.

**Done when:** domain tests pass, including agent cannot set `in_progress`. **Checkpoint:** rules are in code, not prompts; record transition/privacy decisions.

### Step 4 — API, SSE, student/staff interface (6–8.5 h, lanes A and C)

**Codex prompt:** Implement Fastify routes for report, incident status, staff queue, staff update, facilities notice, proposal approval/rejection, and fix confirmation. Use seeded personas (student, maintenance, facilities, reviewer), with permission checks in API. Implement SSE with `Last-Event-ID` resume. Build Next.js student report/status timeline and staff queue/incident page with approval cards, update form, and confirm-fix action. Seed campus hostels, locations, and study spaces. Do not add real login in the demo slice.

**Done when:** B1 manual flow works with Meko/agents disabled; one student cannot read another's report; 50 concurrent HTTP duplicate reports yield one incident. **Checkpoint:** plain functional UI; record route, persona, SSE event names.

### Step 5 — Meko gateway (8.5–10 h, lane B)

**Codex prompt:** In `packages/meko`, use only the verified tool names and schemas in `docs/MEKO_TOOLS.md`. Implement typed operations for recall, remember, case opening, promotion, and document upload only where those capabilities exist. Route every MCP request through one wrapper that logs actor, datapack, tool, redacted request/response, outcome, latency, correlation ID, and simulated flag; applies timeout and at most two bounded retries; caches recall for 60 seconds per incident/datapack; supports `MEKO_MODE=off` as a logged bypass. Add `STUB_MEKO=true` only for tests/load tests. Promotion must require a persisted approved `human_approvals` row and authorized credential. Any unsupported operation is a blocker; do not fake success.

**Done when:** a gated live round trip works; bad token logs failure and does not crash the worker; unapproved promotion is refused; per-run calls are counted. **Checkpoint:** SDK import isolation lint passes; compare calls with verified quota; record call-log schema/quota.

### Step 6 — LLM gateway, Triage, worker (10–12 h, lane B)

**Codex prompt:** Implement one OpenAI-compatible client selected by `LLM_PROVIDER` (`ollama` or `gemini` via verified base URL/model). Validate outputs with Zod, one repair retry, timeout, and record provider, model ID, latency, and available token usage. Worker claims outbox rows and executes idempotent Triage jobs. Triage code recalls from `cg-commons` and `cg-triage`, makes one model call for a proposal, validates it, stores a human approval proposal and status event, then remembers a redacted case note. Model output never selects MCP tools. Make each job idempotent by `(correlation_id, step)`.

**Done when:** 10 live runs report JSON validity, median latency, and calls/run; killing a worker mid-job does not duplicate a Meko write. Check five clearly simulated code-mixed fixtures; enable optional normalizer only if needed. **Checkpoint:** Triage only; Curator is Step 7; record model decision.

### Step 7 — Hand-offs, Curator, approval, seed, end-to-end (12–14 h, lanes A/B)

**Codex prompt:** Persist staff updates/facilities notices through `remember()` to `cg-triage`; have Triage revise ETA with an explanation (S3). Write a minimal Bridge handoff (location/time window only, no report narrative) to `cg-bridge` (S4). On confirmed fix, Curator drafts a non-identifying lesson to `cg-commons`; reviewer approves; Approval Service calls verified promote operation using approver identity (S5). Seed a North hostel lesson through the real gateway labelled simulated. Verify a case at another hostel recalls it (S6). Add an S1–S7 script that prints each real Meko call and correlation ID.

**Done when:** e2e runs with live Meko; Meko-off run shows no recall and no ETA change; log demonstrates approval row before promotion. Target under three minutes. **Checkpoint:** only S1–S7; record seed, lesson schema, approver rules.

### Step 8 — Opt-in Bridge circles (14–15.5 h, lanes A/B/C)

**Codex prompt:** Implement consent-based private bridge requests, opt-in join/offer, leave, and time-limited expiry for seeded study spaces. Bridge Steward recalls only suitable spaces from `cg-bridge` and proposes a circle for human confirmation. Track time-to-relief only for opted-in users. Do not expose identities across users, add chat, or change incident priority.

**Done when:** tests show no other student's identity leaks, membership never changes priority, and expired circles close. **Checkpoint:** join/offer/leave/expiry only; record privacy decisions.

### Step 9 — Swarm board and metrics (15.5–17.5 h, lane D)

**Codex prompt:** Build `/swarm` entirely from `meko_call_log`. Show people and agents with their datapacks; one edge per call (write solid, recall dashed, promotion highlighted, bypass grey, failure red); counts for notes, reads, promotions, directives, approvals, errors; event stream, agent detail, live/5-minute/30-minute/replay windows, simulated badges, model on each agent event, and log ID on every item. Metrics: time to repair, opted-in time-to-relief, recall hit rate, median triage latency, tokens/triage; show n/a where unavailable.

**Done when:** removing a log row removes its view element; every element links a log ID; failures render red; 500 rows load under two seconds. **Checkpoint:** no unlogged visualization; record event shape.

### Step 10 — Hardening and deployment (17.5–19 h, all)

**Codex prompt:** Add failure-injection scenarios for bad Meko token, Meko timeout, malformed LLM JSON, worker termination, one Yugabyte node stopping, and dropped SSE connection. Add stub-Meko load test with 200 reports and privacy test that seeds names/phones/emails and fails if they appear in call logs, prompts, or Meko payloads. Complete Compose for API, worker, web, and database; Ollama runs on host with configurable base URL. Verify health checks, persistence, restart behavior, and clean setup. Write README setup in at most five commands.

**Done when:** every injected failure has visible correct state; privacy test passes; another teammate follows README on clean machine in five commands or fewer. Laptop Compose is primary; single VM is a follow-on validation of the same config. **Checkpoint:** fix/cut only; record operational gotchas.

### Step 11 — Demo and submission (19–20 h, all)

Rehearse S1–S7 twice under five minutes with swarm view open; rehearse node failure and Meko-off comparison. Prepare README, one-page design note, demo, and feature proposal for purpose-scoped, expiring context access, grounded in a real build friction. Keep proposal clearly labelled as a proposal, not an existing Meko capability. For Check T, collect ten promoted decisions attributed to at least two teammates' coding agents and demonstrate one teammate's agent answering from another's decision. Prepare a short public post/clip only if submission requires it.

## Final acceptance checklist

- B1 report → reasoned status → staff action → resolved, visible in UI.
- B2 person/agent hand-offs both demonstrated.
- B3 second-hostel case changes through verified lesson recall; Meko-off control shown.
- B4 every swarm element has a real call-log ID; failures are visible.
- B5 privacy checks pass; seeded data marked `SIMULATED`; recall UI displays only returned context.
- Actual model/provider is visible; local vs Gemini fallback is labelled honestly.
- Clean-machine setup and node-kill behavior have recorded evidence.
- Check T, design note, and feature proposal are ready.

## Known verification gates; do not guess

Before implementation depends on them, verify exact Meko tool names/parameters, identity promotion behavior, visibility delay, Viewer permissions, datapack boundaries, and quotas; exact Yugabyte image tag, cluster topology, replication factor, hash-sharded index syntax, isolation, and `SKIP LOCKED`; and current Gemini model IDs and supported request fields. Save test output and the date in `docs/MEKO_TOOLS.md` / `docs/SPIKE_RESULTS.md`. If a gate fails, revise the dependent step before coding it.
