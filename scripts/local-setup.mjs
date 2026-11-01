import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import net from "node:net";

const root = process.cwd();
const envFile = `${root}/.env`;
if (!existsSync(envFile)) {
  copyFileSync(`${root}/.env.example`, envFile);
  console.log("Created ignored .env from .env.example.");
}
const content = readFileSync(envFile, "utf8").replace(/^\uFEFF/, "");
const databaseUrl = content.match(/^\s*YB_URL\s*=\s*([^\r\n#]+)/m)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
if (!databaseUrl) throw new Error("Set YB_URL in .env before continuing.");
const database = new URL(databaseUrl);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: database.hostname, port: Number(database.port || 5433) });
    socket.setTimeout(1500);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => { socket.destroy(); resolve(false); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}

if (run("docker", ["compose", "up", "-d"]) !== 0) throw new Error("Could not start YugabyteDB. Check Docker Desktop and try again.");
console.log("Waiting for YugabyteDB on the configured YSQL port…");
let ready = false;
for (let attempt = 0; attempt < 90; attempt += 1) {
  if (await canConnect()) { ready = true; break; }
  await delay(2000);
}
if (!ready) throw new Error("YugabyteDB did not open its YSQL port within 3 minutes.");

for (let attempt = 0; attempt < 30; attempt += 1) {
  const status = run(process.execPath, ["--env-file-if-exists=.env", "--import", "tsx", "scripts/migrate-db.ts"]);
  if (status === 0) {
    console.log("Local setup complete. Next run: npm run dev:local");
    process.exit(0);
  }
  if (attempt === 29) throw new Error("Database migration did not succeed after 30 attempts.");
  await delay(3000);
}
