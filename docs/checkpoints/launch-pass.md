# Launch-focused pass — deployment binding and response clocks

Date: 2026-11-01 (Asia/Calcutta)

## Scope

Added case-level response clocks in `apps/web/src/app/page.tsx` and compact responsive styling in `apps/web/src/app/globals.css`:
- `TIME TO RELIEF` is currently a preview proxy: time from the first incident report to the first human `staff.update_posted` event. Open cases show elapsed time; cases with a post show the measured duration.
- `TIME TO REPAIR` is time from the first report to staff `fix.confirmed`. Open/unconfirmed cases show elapsed time; confirmed cases show the measured duration.

Updated `apps/api/src/index.ts` to bind to `0.0.0.0` by default for container networking. Added `tsx` to `apps/api` production dependencies so its existing TypeScript start command is not dependent on a root-only dev dependency. Added `docs/LAUNCH_READINESS.md` with App Platform commands, response metric definitions, Care Track integration plan, and explicit production gates.

## Verification

- `npm run build` — exit 0; all workspaces built, Next.js production build and typecheck passed.
- `npm test` — exit 0; 11 passed, 0 failed, 11 skipped. All skipped tests require `YB_URL`; no YugabyteDB URL was available. The 11 passing tests were one domain redaction test plus 10 Meko gateway tests.
- `npm run lint` — exit 0; MCP SDK import boundary passed.
- `npm run check:spikes` — exit 0.
- `npm install --workspace=@commonground/api --save-exact tsx@4.23.15 --offline` — exit 0, no vulnerabilities reported; npm warned that the esbuild install script is not in the local allow-scripts list.
- No Docker/database or DigitalOcean deploy/load test: Docker engine access was denied, `doctl` was unavailable, and no DigitalOcean app/repository integration is configured here.

## Release blockers

- Current `x-demo-persona` identity is caller-controlled and must not be exposed publicly. Add and test institution SSO/OIDC and server-side authorization before production traffic.
- No production YugabyteDB endpoint/backup/restore drill is configured.
- Product Meko datapack credentials are not configured in this environment; the last Step 5 checkpoint also leaves cross-identity promotion unverified. Meko gateway code exists, but this does not verify live product operation.
- Worker package remains a stub; triage is a simulated API route. Do not claim real agent routing/learning is live.
- Sensitive personal case intake remains unavailable by design until the security, institution-policy, role, recusal, support staffing, privacy and legal gates in `docs/CARE_TRACK_DESIGN.md` are completed. Keep signposting-only mode.
- Response clocks are not yet independent relief outcomes or service-level objectives. For personal support, configure and separately record a human-confirmed support connection before reporting a real time-to-relief KPI.
- User-supplied Figma page could not be loaded by the available browser/search channel; the HTML attachment is a large site bootstrap payload, not an inspectable frame export. The current UI therefore has not been verified against Figma.

## Decision

This is an internal preview improvement and deployment preparation, not a startup production release. A DigitalOcean app can only be safely launched after authentication and a production database are configured. `docs/LAUNCH_READINESS.md` contains the current App Platform setup path and safe release gates.

## Figma PDF update

The supplied 12-screen PDF was inspected. Updated `apps/web/src/app/globals.css` to use its white canvas, orange primary actions, clearer contrast and selected state. Existing report/request/timeline/queue/approval actions remain API-backed. The PDF's patterns, comparison, and swarm pages are not implemented as working app screens because the current repo has no corresponding routes/data. The HTML paste is not required for this visual pass.

Latest verification after the palette update: `npm run build` exit 0; `npm test` exit 0 (11 passed, 11 skipped for absent `YB_URL`); `npm run lint` exit 0; `npm run check:spikes` exit 0.
