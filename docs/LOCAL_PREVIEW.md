# Run CommonGround locally

## Open the current preview

With the local services running, visit **http://localhost:3000** in your browser. The UI is served by Next.js, the API runs on port 3001, and YugabyteDB runs through Docker Compose on port 5433.

## Start it again in PowerShell

Open three PowerShell windows in `C:\Users\prish\Alchemy` and keep them open:

1. Start the local database:

   ```powershell
   docker compose up -d
   ```

2. Start the API:

   ```powershell
   $env:YB_URL = 'postgresql://yugabyte:yugabyte@127.0.0.1:5433/yugabyte'
   $env:HOST = '127.0.0.1'
   $env:PORT = '3001'
   npm run dev --workspace=@commonground/api
   ```

3. Start the browser app:

   ```powershell
   $env:COMMONGROUND_API_URL = 'http://127.0.0.1:3001'
   npm run dev --workspace=@commonground/web -- -p 3000
   ```

Then open **http://localhost:3000**. To stop either Node service, press `Ctrl+C` in its PowerShell window. The database can remain running; shut it down only when you want to stop the local database with `docker compose down`.

## Product Meko credentials

The product gateway is in `packages/meko` and records redacted calls in YugabyteDB. Configure the product role credentials and datapack IDs listed in `.env.example` in a local, ignored `.env` file before enabling live Meko calls. A Codex Meko connection is not a product credential. Without those product settings, the app continues to use its database-backed workflow; it must not claim that live Meko is active. Never commit `.env` or paste credentials into source files.

## Preview boundaries

The role switcher is a demo preview, not authentication. Do not expose this local build publicly as a production service. Personal support options are informational and are not a confidential case-reporting channel. Personal reports must remain outside the ordinary Wi-Fi queue and Meko until the institution-specific Care Track safeguards in `CARE_TRACK_DESIGN.md` are implemented and reviewed.


## Connect Meko for an evaluator check

The app includes a **Run Meko check** button in the Technician and Reviewer workspaces. It calls Meko with a fixed synthetic Wi-Fi query only. It does not send a ticket, campus location, student identity, or Bridge data. The check makes a `conversation_create` and `memory_search` call in the Triage datapack and shows whether Meko answered.

1. In the Meko console, use or create a product datapack for campus Wi-Fi repair guidance (the configured Triage datapack). Create a product API token with access to that datapack. Do not use the Codex coding-agent token.
2. Copy the repo template and edit the local file:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

3. Fill these four values in `.env`; leave `STUB_MEKO=false` and set `MEKO_MODE=on`:

   ```dotenv
   MEKO_TRIAGE_TOKEN=<product-token>
   MEKO_TRIAGE_AGENT_ID=commonground-preview-triage
   MEKO_TRIAGE_DATAPACK_ID=<triage-datapack-uuid>
   MEKO_MODE=on
   STUB_MEKO=false
   ```

   `YB_URL` should be `postgresql://yugabyte:yugabyte@127.0.0.1:5433/yugabyte`. The API workspace now loads the root `.env` automatically. Never paste the token into chat or commit `.env`.

4. Restart the API (`Ctrl+C`, then `npm run dev --workspace=@commonground/api`) and reload the browser app. Switch to **Technician** or **Reviewer**, then click **Run Meko check**. A live result says `Meko responded · live · 2 tool calls`; a setup/API error explains what is missing.

This smoke-check proves the product API can reach Meko. It is intentionally separate from incident handling; the Triage/Bridge product flows and Bridge matching are not activated by this synthetic check.
