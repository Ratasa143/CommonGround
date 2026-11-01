# Step 4 checkpoint — API, SSE, student/staff interface

Date: 2026-11-01 (Asia/Calcutta)

## Scope

Added a Fastify API, demo persona permissions, report and incident routes, staff queue/actions, facilities notices, proposal approval/rejection, fix confirmation/resolution, resident fix-failure reporting, and SSE with `Last-Event-ID` resume. Added a Next.js report/status timeline and staff queue/action UI, plus seeded campus hostels, locations, and study spaces. No real login, model, or Meko call is used in this slice.

## Correctness evidence

- `npm run build` — passed across all workspaces, including Next.js production build.
- `npm test` with local YSQL configured — 12 passed, 0 failed, 0 skipped (4 API, 3 DB, 5 domain tests).
  - 50 concurrent Fastify HTTP-injection report requests with the same idempotency key returned one incident/report/outbox event.
  - Student A can read their report; Student B receives 403. Student access to staff queue receives 403; maintenance staff receives 200.
  - Simulated manual report → demo proposal → reviewer approval → maintenance fix confirmation → resolution flow passed without Meko/model.
  - SSE test resumed after the supplied `Last-Event-ID` and emitted the subsequent staff update without replaying the report event.
- `npm run lint` — passed: MCP SDK import boundary.
- `npm run check:spikes` — passed.

## API, personas, and stream events

- Personas selected with the local demo `x-demo-persona` header: `student-a`, `student-b`, `maintenance`, `facilities`, `reviewer`. SSE uses a `persona` query value because browser `EventSource` cannot set custom headers.
- Routes: `POST /reports`; `GET /incidents/:id`; `GET /staff/queue`; `POST /incidents/:id/demo-triage`; `POST /incidents/:id/staff-updates`; `POST /incidents/:id/facilities-notices`; `POST /incidents/:id/proposal/approve`; `POST /incidents/:id/proposal/reject`; `POST /incidents/:id/confirm-fix`; `POST /incidents/:id/resolve`; `POST /incidents/:id/report-failure`; `GET /incidents/:id/events` (SSE); `GET /locations`; `GET /demo/personas`; `GET /health`.
- SSE emits `incident.reported`, `incident.triage_proposed`, `incident.status_changed`, `staff.update_posted`, `facilities.notice_posted`, `proposal.approved`, `proposal.rejected`, and `fix.confirmed`.
- `Last-Event-ID` encodes the full database timestamp plus event UUID so microsecond timestamps resume without duplicate replay.

## Efficiency and decisions

Elapsed Step 4 implementation and verification was approximately 8 minutes. The UI talks to Fastify through a Next.js rewrite at `/api`; set `COMMONGROUND_API_URL` for a non-local API host. Demo personas are only for this local demo slice and are not authentication. The demo proposal is deterministic and explicitly marked simulated.

## Evidence index

- API routes and SSE: `apps/api/src/app.ts`.
- API integration tests: `apps/api/src/app.test.ts`.
- UI: `apps/web/src/app/page.tsx` and `apps/web/src/app/globals.css`.
- Seeded campus data: `seed/campus.ts`.

## Step 4 usability and persistence update — 2026-11-01

Added a student-owned `GET /my/reports` endpoint and a persistent request list so students can return to existing cases after navigating or refreshing. Redesigned the Next.js workspace around clear student, maintenance, facilities, and reviewer tasks; added readable progress labels/timeline, privacy guidance, queue filters, proposal review view, editable team updates, and responsive layouts. The persona picker remains explicitly a local preview, not authentication. Scope remains campus Wi-Fi reporting and restoration; no new grievance categories or automated decisions were introduced. The remote font import was removed so the interface does not depend on an external font service.

## Correctness evidence

- `npm run build` — passed across all workspaces.
- `npm test` with `YB_URL=postgres://yugabyte@127.0.0.1:5433/yugabyte` — 22 passed (API 4, DB 3, domain 5, Meko 10), 0 failed, 0 skipped.
- `npm run lint` — passed: `MCP SDK import boundary passed.`
- `npm run migrate:db` — “Already applied migration 001_initial”; no schema change.
- Runtime HTTP checks — `/health` returned 200; `/my/reports` as `student-a` returned 200 with `{"incidents":[]}`; `/api/my/reports` through Next.js returned 200; homepage returned 200 and included the new navigation.
- Initial test run without `YB_URL` skipped database-backed API tests; reran with the project’s local YugabyteDB URL and all suites passed.

Implementation and verification took approximately 10 minutes for this pass. The local three-node Compose database and app processes are running. Product authentication remains a simulated persona selector until a real identity provider is implemented. Step 6 and subsequent agent/worker work remain gated by the unresolved Step 5 live Meko permission preflight.
