# CommonGround build guidance

- Read `docs/RUNBOOK.md` and the relevant step before changing code.
- Work on one step at a time. Do not start a later step until the current step's checkpoint has evidence.
- Verify library APIs from installed types or official documentation; do not invent Meko tool names, YugabyteDB syntax, or model IDs.
- Keep secrets in local environment variables or ignored `.env` files. Never add credentials, personal data, or live student narratives to source control, logs, prompts, or Meko.
- Keep the MCP SDK isolated to `packages/meko`. The model proposes structured data; application code selects tools and enforces permissions.
- Keep incident state authoritative in YugabyteDB. Meko/model failures must not prevent the core report and status flow from working.
- Add a checkpoint note with command output, scope, elapsed time, and decisions before moving on.
- Use the build datapack only after the team creates it and supplies its real ID. Never guess IDs or use product `cg-*` datapacks for coding-agent memory.
