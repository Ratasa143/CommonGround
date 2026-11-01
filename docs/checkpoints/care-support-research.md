# Care Track research and safe-preview checkpoint

Date: 2026-11-01

## Scope

Read the owner-supplied redesign guide as reference, inspected the current runbook and app, and verified primary-source guidance for Indian higher-education grievance routes, anti-ragging resources, emergency support, and survivor-centered first-line support. Added a separate Care Track design document and an explicit runbook scope update. The running UI now has a Support destination with emergency and support contacts, configurable ICC/SGRC route guidance, and an explicit statement that this preview is not a confidential case-reporting channel. Replaced the decorative hero/caption with a concise purpose-led introduction and a custom CommonGround mark. Added a collapsible, accurate description of YugabyteDB/Meko roles. Student status labels are plain language, API errors are visibly distinct from success, and location identifiers are not rendered as student-facing locations.

This pass does not add a case narrative form, store sensitive personal data, call Meko, call Gemini, or add any new database/service dependency. Care Track intake remains gated on identity, isolated storage, encryption/key management, audit, policy and security review.

## Correctness evidence

- `npm run build` — all workspaces passed; Next.js rendered `/` as a static route.
- `npm test` with local `YB_URL` — API 4 passed, DB 3 passed, domain 5 passed, Meko 10 passed; total 22 passed, 0 failed, 0 skipped.
- `npm run lint` — `MCP SDK import boundary passed.`
- Runtime read-only check — API `/health` returned 200; homepage returned 200 and contained the Support entry, omitted the old `01 / 03` caption, and included the Meko connection disclosure.
- Research sources and product/security decisions are recorded in `docs/CARE_TRACK_DESIGN.md`.

Elapsed research, interface and verification time: approximately 25 minutes. The project remains within ordinary Wi-Fi case scope plus a separate support-resource screen. No Care Track intake, legal classification, or case handling is claimed as implemented. The public-preview workspace selector remains simulated and is not authentication.

## Decisions

- Follow separate institution-defined routes for sexual-harassment, ragging, and other grievance concerns; do not route them into the Wi-Fi incident queue.
- Provide verified support information before asking for any details. Do not accept sensitive details until the care module's security and campus governance gates have evidence.
- Treat Meko/Gemini integration for Care Track content as prohibited. Show Meko's implementation status transparently; do not imply the product is live-connected.
- Do not add TigerData, MongoDB, Solana, or dual cloud hosting without a measured need and a security/architecture case.
