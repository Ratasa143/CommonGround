# Swarm reference integration — incident aggregation

Date: 2026-11-01 (Asia/Calcutta)

## Scope

Adapted the grievance-swarm pattern of grouping multiple student reports under one campus incident. CommonGround already creates/reuses authoritative incidents in YugabyteDB; the API now returns a derived `reportCount` in incident detail and staff queue responses. The interface labels the count as reports linked to the case. It does not expose another student's narrative or reporter identity.

## Files

- `apps/api/src/app.ts`: count projection for incident and staff queue responses.
- `apps/web/src/app/page.tsx`: aggregate count in staff cards and case details.
- `apps/api/src/app.test.ts`: checks aggregation and existing per-student report-text isolation.

## Verification

No build or test command was run for this focused change. Run the repository build and API integration tests in the normal verification window; API integration tests require local YugabyteDB `YB_URL` as noted in `docs/checkpoints/step-4.md`.

Implementation elapsed: approximately 5 minutes. Scope remains the existing Wi-Fi incident workflow; no new grievance category or Meko/model dependency was introduced.`r`n`r`n## Decisions / limits

- No Figma assets or swarm backend were copied: those use a separate FastAPI/SQLite demo architecture and local-Meko stand-in.
- No Meko/LLM/swarm visualization or fake peer count was added. These remain gated by the Step 5 live permission verification and later runbook steps.
- This local preview still uses demo personas, not production authentication.
