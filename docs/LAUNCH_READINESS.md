# CommonGround launch readiness — DigitalOcean and response clocks

Reviewed: 1 November 2026

## What is implemented now

- Ordinary Wi-Fi reports, staff actions, status history, SSE updates, and incident aggregation are persisted in YugabyteDB.
- Case timelines show two clocks. **Time to relief (preview proxy)** is measured from the incident's first report to the first human `staff.update_posted` event. **Time to repair** is measured from that report to the first staff `fix.confirmed` event. Open cases show elapsed time and completed cases show the measured duration. These are service-operation measures, not legal deadlines, student safety outcomes, or a promise that the repair is complete for every reporter.
- Care & Support is signposting only. It does not take personal allegations or promise confidentiality.
- The API defaults to `0.0.0.0`, which is needed inside a hosted container.

## Do not call this production-ready yet

The current demo trusts a caller-controlled `x-demo-persona` header and exposes a persona picker. Anyone who can reach the API can claim a staff/reviewer persona. Replace it with institution-approved SSO/OIDC, validated identities, server-side role grants, CSRF protections for browser mutations, and audit access before public release. The app also has no institution-configured Care Track intake, conflict recusal workflow, separate encrypted case store, notification process, or tested retention/deletion and incident response. Keep sensitive personal disclosures out of this preview and direct students to verified campus contacts.

The Meko gateway is implemented, but the last Step 5 checkpoint says product datapack credentials are not configured and cross-identity promotion is unverified. `MEKO_MCP_TOKEN` is a coding-agent credential and does not configure product operations. Do not expose a Meko-enabled demo as a live product until those checks are completed. The worker package is currently a stub, and the demo triage endpoint is explicitly simulated.

## DigitalOcean App Platform setup for the current ordinary Wi-Fi preview

Deploy from the repository root because all components use npm workspaces and import shared packages. Do not set `apps/web` or `apps/api` as the source directory; App Platform documents that source files outside it are unavailable at runtime.

1. Push the reviewed repository branch to GitHub. In DigitalOcean App Platform, create an app from that repository with the source directory `/`.
2. Add a Node.js **API service** with build command `npm ci && npm run build --workspace=@commonground/api`, run command `npm run start --workspace=@commonground/api`, HTTP port `3001`, and health path `/health`. Set `HOST=0.0.0.0`, `PORT=3001`, `NODE_ENV=production`, and encrypted `YB_URL` for a reachable, production YugabyteDB cluster. Run the checked-in migration once against that database before routing traffic. Do not create a DigitalOcean PostgreSQL database and treat it as a Yugabyte replacement.
3. Add a Node.js **web service** with build command `npm ci && npm run build --workspace=@commonground/web`, run command `npm run start --workspace=@commonground/web`, and the platform-assigned port. Set `COMMONGROUND_API_URL` to the API service's public HTTPS origin at build time; the Next.js rewrite is compiled from this value. Configure HTTPS/custom domain and redeploy the web component after setting it.
4. Set resource sizes and autoscaling from a measured load test. Add the API and web health checks, alerts, backups and restore drills. Keep product Meko credentials encrypted and least-privileged; do not set the coding-agent key as a product token.
5. Run the smoke test only after identity has been replaced. Until then, keep the deployment access-restricted for internal preview; the demo identities are not a safe public access model.

Current environment has no `doctl` command and Docker access is denied, so no cloud app or container/database is configured from this machine. A deployment also requires the repository's pushed GitHub branch, an institution-approved YugabyteDB endpoint, and DigitalOcean account access.

## Sensitive support pathway design decision

Research and policy mapping are in `CARE_TRACK_DESIGN.md`. The production design keeps ICC, anti-ragging and SGRC/other concerns on separately configured, human-led routes; routes and alternates are supplied and verified by each institution. Before intake, implement institution SSO, case-scoped least privilege, conflict recusal, an encrypted isolated content store, append-only access audit, disclosed privacy limits, retention/deletion, breach response, trained ownership and policy/legal review. Do not send case details to Meko, models, general analytics or the ordinary incident queue. Use plain-language resource choices and immediate safety contacts first. The WHO LIVES framework informs supportive design language; it is guidance for trained first-line support and must not be presented as an AI counselling script.

## Verification note

This launch pass has not completed a DigitalOcean deployment or production load/penetration test. Local build and automated checks should be recorded in the latest checkpoint after running them with an available YugabyteDB test instance.

## Interface reference update

The supplied 12-screen Figma-exported PDF was visually reviewed. The current app now follows its white-and-orange direction across the implemented report, request, case-detail, staff queue, and approval interactions. The reference also shows patterns, Meko comparison, and swarm pages; this repository does not yet have those flows wired to persisted product-agent data, so they are not exposed as if functional.
