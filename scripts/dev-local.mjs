import { spawn } from "node:child_process";

const root = process.cwd();
const windows = process.platform === "win32";
const npm = windows ? "npm.cmd" : "npm";
const apiEnv = { ...process.env, HOST: "127.0.0.1", PORT: "3001" };
const webEnv = { ...process.env, COMMONGROUND_API_URL: "http://127.0.0.1:3001" };
const services = [
  { label: "API", args: ["run", "dev", "--workspace=@commonground/api"], env: apiEnv },
  { label: "Web", args: ["run", "dev", "--workspace=@commonground/web"], env: webEnv },
];
const children = [];
let stopping = false;

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (windows) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 250).unref();
}

for (const service of services) {
  const child = spawn(npm, service.args, {
    cwd: root,
    env: service.env,
    stdio: "inherit",
    shell: windows,
  });
  children.push(child);
  child.on("error", (error) => { console.error(`${service.label} failed to start: ${error.message}`); stopAll(1); });
  child.on("exit", (code) => {
    if (!stopping) {
      console.log(`${service.label} stopped${code == null ? "" : ` (${code})`}.`);
      stopAll(code ?? 1);
    }
  });
}
console.log("CommonGround is starting at http://localhost:3000. Press Ctrl+C to stop the app services.");
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
