# Step 0 checkpoint — Repository and wiring

Date: 2026-10-31 (Asia/Calcutta)

## Scope

Created the npm workspaces scaffold only: Next.js web shell, Fastify API workspace, worker workspace, shared package shells (`core`, `domain`, `db`, `meko`, `llm`), environment template, Makefile, seed placeholder, and MCP SDK import boundary check. No product routes, database schema, agent behavior, or Meko adapter logic were added.

## Correctness evidence

- `npm install` — passed; 83 packages added, 92 audited, 0 vulnerabilities; lockfile created.
- `npm run build` — passed with elevated filesystem access. Next.js 16.4.3 compiled and type-checked; all remaining TypeScript workspaces compiled.
- `npm test` — exited 0. No test scripts or tests exist in the Step 0 scaffold yet.
- `npm run lint` — passed: `MCP SDK import boundary passed.`
- `git check-ignore .env` — returned `.env`.
- `codex mcp list` — local CLI lists `meko` at `https://mcp.mekodata.ai/mcp`, enabled with bearer token authentication. Teammate configurations have not been checked.
- Meko datapack list — only `meko_default_datapack` was returned. No team `<team>-build` datapack was identified, so no project memory was recalled or saved.

## Efficiency

Within the 30-minute Step 0 target. Dependency installation took about three minutes after registry access was approved. A first Next.js build hit `EPERM` while creating generated `.next` files in the sandbox; the isolated elevated build and the full monorepo build both passed.

## Decisions

- Workspace names are `@commonground/{web,api,worker,core,domain,db,meko,llm}`.
- Dependency versions are pinned in workspace manifests and `package-lock.json`.
- The Codex CLI MCP entry exists locally; per-teammate Meko wiring remains to be confirmed by each teammate.
- Step 0 memory promotion remains pending until the team creates its build datapack and provides its real ID. Do not use the default datapack for project memory.

## Gate

Local scaffold checks pass. Before Step 1, provide the dedicated team build datapack ID so Codex can recall and save project decisions in the correct pack. The Meko spike datapack and actual server tool schemas must still be verified in Step 1.
