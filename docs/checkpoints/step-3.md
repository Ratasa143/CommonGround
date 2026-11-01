# Step 3 checkpoint — Domain services

Date: 2026-11-01 (Asia/Calcutta)

## Scope

Implemented the state-transition/domain layer with no HTTP or Meko imports. `reportGrievance` atomically reuses incidents, enforces report idempotency, stores the report, and writes status/outbox events. Added triage proposal, staff approval/rejection, staff/facilities updates, fix confirmation, explicit resolution, resident fix-failure reporting, and text redaction. Redaction runs before free text enters event/outbox rows; original report text remains only in the authoritative reports table.

## Correctness evidence

- `npm run build` — passed across all workspaces, including the Next.js production build.
- `npm test` with the local three-node Yugabyte `YB_URL` — 8 passed, 0 failed, 0 skipped; 3.971 seconds total across workspaces.
  - DB tests: 50 concurrent same-key inserts return one report; two workers claim an outbox row once; expired lease is reclaimed and attempts increments.
  - Domain tests: 50 identical concurrent reports create one incident/report/outbox event; valid triage, approval, fix, resident failure, and resolution flow; agent cannot approve; staff can reject a proposal; staff text is redacted before outbox/event persistence; unauthorized facilities notice is refused.
- `npm run lint` — passed: `MCP SDK import boundary passed.`
- `npm run check:spikes` — passed.

## Efficiency

Elapsed Step 3 implementation and verification was approximately 7 minutes. One redaction test initially failed because replacing a known name before email detection corrupted the email address; the order was corrected, and the complete test suite passed afterward.

## Decisions

- Keep the complete state sequence explicit: `new → triage_proposed → in_progress → fix_applied → resolved`; `fix_applied → in_progress` is allowed only for the student failure report.
- `confirmFix` transitions to `fix_applied`; `resolveIncident` separately records the staff transition to `resolved`.
- Persist approval before the state transition in the same transaction; a failed transition rolls back the approval row.
- Redaction replaces provided known names and detects common email, Indian phone, and room-number forms. Callers handling free text must pass names from structured identity data; generic single-word names cannot be reliably inferred from arbitrary text.
- No additional domain tables were added; the service uses Step 2's schema.

## Evidence index

Domain implementation and integration tests are in `packages/domain/src/index.ts` and `packages/domain/src/index.test.ts`. The database schema and transaction/claim logic are documented in `docs/checkpoints/step-2.md`.
