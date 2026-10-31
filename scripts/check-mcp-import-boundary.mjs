import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const allowedDirectory = ["packages", "meko"].join(sep);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const skippedDirectories = new Set([".git", ".next", "dist", "node_modules"]);
const importPattern = /(?:\bfrom\s*|\bimport\s*\(|\brequire\s*\()\s*["']@modelcontextprotocol\//;
const violations = [];

function visit(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skippedDirectories.has(entry.name)) visit(join(directory, entry.name));
      continue;
    }

    const extension = entry.name.slice(entry.name.lastIndexOf("."));
    if (!sourceExtensions.has(extension)) continue;

    const file = join(directory, entry.name);
    const relativePath = relative(root, file);
    const normalizedPath = relativePath.split(sep).join("/");
    if (normalizedPath.startsWith("packages/meko/")) continue;

    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (importPattern.test(line)) violations.push(`${relativePath}:${index + 1}`);
    });
  }
}

visit(root);

if (violations.length > 0) {
  console.error("MCP SDK imports are allowed only in packages/meko:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("MCP SDK import boundary passed.");
}
