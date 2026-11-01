# CommonGround

CommonGround turns a campus fault, such as an evening hostel Wi-Fi outage, into one accountable repair record. Students can follow **time to repair** and **time to relief**; the product design also includes an opt-in Bridge study circle while students wait. Bridge matching is not active in this preview.

## Local setup (5 commands)

Requires Node.js 20.9+ and Docker Desktop. The setup command creates an ignored `.env`, starts the three-node YugabyteDB Compose cluster, waits for the database and applies migrations. It does not configure live product Meko credentials.

```powershell
git clone https://github.com/Ratasa143/Alchemy.git
cd Alchemy
npm ci
npm run local:setup
npm run dev:local
```

Open http://localhost:3000. Press `Ctrl+C` to stop the API and web servers; `docker compose down` stops the local database. To run a live Meko check, add a product Triage token, agent ID, and datapack UUID to the ignored `.env`, set `STUB_MEKO=false`, restart the API, and use **Technician → Swarm → Run synthetic Meko check**. The check sends only a fixed synthetic query; see [the local preview guide](docs/LOCAL_PREVIEW.md).

## Architecture

- **Web:** Next.js, React, TypeScript.
- **API:** Fastify, Node.js, TypeScript, Zod.
- **Operational store:** YugabyteDB / YSQL.
- **Knowledge gateway:** Meko MCP SDK with separate product-role configuration; live product credentials are not included in this repository.
- **Live updates:** Server-Sent Events.

For Track B roles, data boundaries, and preview limitations, see [the design note](docs/TRACK_B_DESIGN_NOTE.md). The role selector is a local demo preview, not production authentication. Do not deploy it publicly as a production service without real identity and authorization.
