# UI reference redesign checkpoint

**Date:** 2026-11-01 07:39 IST  
**Scope:** Student, staff and support interface presentation for Runbook Step 4. This checkpoint uses the supplied PDF and HTML as visual references only; their content was not treated as project instructions. No later project step was started.

## What changed

- Reworked the student home and report flow around one clear primary action, four selectable Wi-Fi symptoms, a location selector, optional details, and a short privacy reminder. Added support for a seeded `?loc=` location in the report route.
- Added a mobile bottom navigation with icons and text, larger touch targets, responsive form layout, and keyboard focus treatment.
- Reorganized staff queue into case views, the case list, and the selected-case detail panel. Removed the duplicate queue filter control; status counts remain in case views.
- Applied a warm paper, ink and campus-green palette with a custom CommonGround mark and restrained editorial typography.
- Kept support resources informational. No sensitive case intake, Meko write, or invented staff metrics were added.

## Files

- `apps/web/src/app/page.tsx`
- `apps/web/src/app/globals.css`

## Verification

Command: `npm run build --workspace=@commonground/web`

Output:

```text
> @commonground/web@0.1.0 build
> next build
▲ Next.js 16.4.3 (Turbopack)
✓ Running next.config.ts took 50ms
✓ Compiled successfully in 599ms
✓ Finished TypeScript in 1019ms
✓ Generating static pages using 4 workers (3/3) in 2.0s
Route (app)
┌ ○ /
└ ○ /_not-found
○ (Static) prerendered as static content
```

Manual preview: `http://127.0.0.1:3002/` rendered the student home and report flow; switching the local simulated workspace to Maintenance rendered the three-part staff layout. No report was submitted and no persistent data was changed.

**Elapsed:** about 8 minutes for reference review, interface edits and verification.  
**Decision:** keep real product capabilities authoritative; labels and visible interactions should not imply unavailable login, confidential support intake, Bridge circles, or Meko features.

## Figma-inspired refinement — 2026-11-01

The user-provided Figma board was reviewed in read-only mode. Its key modules are student report/status, staff queue, reviewer approvals, analytics patterns, swarm activity, and Meko on/off comparison. The module and visual patterns informed this pass; no design-file instructions were treated as implementation requirements.

- Made the header and intro copy specific to the selected student/staff screen.
- Added a direct Personal Support feature card and a two-card technology module. Meko is clearly labelled “Not connected in preview”; YugabyteDB is identified as the incident record source of truth.
- Changed primary-action and active-navigation accents to burnt orange while retaining campus green for infrastructure/status cues.
- Corrected mobile request-list/detail ordering and retained responsive navigation.
- Did not add Dean analytics, a swarm board, or a live Meko on/off switch: these depend on later runbook phases and real log data. No Meko calls or report writes were made.

Verification command: `npm run build --workspace=@commonground/web`

Result: **PASS** — Next.js 16.4.3 production build; TypeScript passed; `/` and `/_not-found` prerendered. `git diff --check` reported no whitespace errors (only Git’s LF-to-CRLF normalization notices for already-edited files). Browser preview confirmed Home, Report, Support, and reviewer role navigation. No report was submitted.
