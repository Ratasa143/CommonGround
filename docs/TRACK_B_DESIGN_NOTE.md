# CommonGround — Track B design note

**Product promise.** A campus Wi-Fi fault should not become a lost or duplicate ticket that costs students a study night. One report starts an accountable repair trail; a student may opt into a short Bridge study circle at a working campus space while waiting. We measure **time to repair** from report to staff-confirmed fix and **time to relief** from report to the first meaningful human response. Bridge matching is a planned extension and is not active in the current preview.

## Who does what

- **Student:** reports the affected campus location and symptom, follows a timestamped status timeline, and can tell staff if a fix did not work. Bridge participation is voluntary; personal or safety-related concerns stay outside the ordinary Wi-Fi queue.
- **Maintenance staff:** reviews and owns repair work, posts progress, confirms a fix, and resolves the case. The API deduplicates reports about an active location fault so one shared incident can carry multiple reports.
- **Facilities staff:** adds site and infrastructure updates to the same incident record.
- **Reviewer:** approves or returns proposed triage actions and is the human gate for promoting reusable lessons.
- **Triage agent:** should retrieve relevant, non-identifying Wi-Fi repair lessons and return a structured action/ETA proposal. Staff retain authority over operational decisions.
- **Bridge Steward:** should coordinate a circle only after explicit student opt-in, using the selected study-space and time window. The handoff excludes report narrative and identity.
- **Curator / Approval Service:** drafts a non-identifying lesson after resolution; a human reviewer approves it before the separate approver promotes it to shared knowledge.

## Data and Meko

YugabyteDB is the operational source of truth for incidents, reports, status events, approvals, Bridge tables, and the redacted Meko call log. Meko supplies bounded agent context, not ticket state. The intended product datapacks are `cg-triage`, `cg-bridge`, and `cg-commons`, with role-specific product credentials and permissions. Triage recalls and writes operational lessons only within its allowed packs; Bridge sees only consented logistics; Curator and Approval Service have separate credentials and the promotion gate requires a persisted human approval. Meko calls are logged with role, datapack, tool, outcome, latency, correlation ID, and simulation status. If Meko is unavailable, the database-backed repair workflow continues.

## Preview status

The local app uses Next.js 16 / React 19, a Fastify 5 TypeScript API, YugabyteDB, and the Meko MCP SDK gateway. Technician and Reviewer screens include a synthetic Meko connection check that sends no ticket or student data. **Live product Meko calls require a Triage product token and datapack ID in the ignored local `.env`; these are not configured yet. Bridge matching is also not active in the preview.** The preview therefore demonstrates the repair workflow and integration boundary, not a completed live Track B S1–S7 Meko flow.
