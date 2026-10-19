#!/usr/bin/env node
// Verifies a deployed v5 app: /health and /status report the expected commit and Database ok.
// Usage: node .cursor/skills/verify-v5/verify.mjs [--url URL] [--commit SHA] [--wait SECONDS]
// Writes evidence to .cursor/skills/verify-v5/evidence/<timestamp>/ and exits 1 on any failed check.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "https://pitbull-web-staging.up.railway.app" },
    commit: { type: "string" },
    wait: { type: "string", default: "0" },
  },
});

const base = args.url.replace(/\/$/, "");
const expected = (
  args.commit ?? execFileSync("git", ["rev-parse", "origin/main"], { cwd: repo, encoding: "utf8" })
).trim().slice(0, 12);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(here, "evidence", stamp);
mkdirSync(outDir, { recursive: true });

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });

async function fetchHealth() {
  const res = await fetch(`${base}/health`, { cache: "no-store" });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { unparsed: text.slice(0, 500) };
  }
  return { status: res.status, body };
}

// After a merge Railway waits for CI before it deploys, so --wait polls until the commit lands.
const deadline = Date.now() + Number(args.wait) * 1000;
let health = await fetchHealth().catch((error) => ({ status: 0, body: { error: String(error) } }));
while (health.body.commit !== expected && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15000));
  health = await fetchHealth().catch((error) => ({ status: 0, body: { error: String(error) } }));
}
writeFileSync(path.join(outDir, "health.json"), JSON.stringify(health, null, 2));
check("/health returns 200", health.status === 200, health.status);
check("/health status ok", health.body.status === "ok", health.body.status);
check("/health db ok", health.body.db === "ok", health.body.db);
check("/health commit matches", health.body.commit === expected, health.body.commit);

const require = createRequire(path.join(repo, "v5", "package.json"));
const { chromium } = require("@playwright/test");
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  check("/ redirects to /login", new URL(page.url()).pathname === "/login", page.url());
  await page.goto(`${base}/status`, { waitUntil: "networkidle" });
  const text = async (id) => (await page.getByTestId(id).textContent({ timeout: 15000 }))?.trim();
  const status = {
    health: await text("health-status"),
    version: await text("status-version"),
    commit: await text("status-commit"),
    built: await text("status-built"),
    database: await text("status-database"),
  };
  writeFileSync(path.join(outDir, "status.json"), JSON.stringify(status, null, 2));
  await page.screenshot({ path: path.join(outDir, "status.png"), fullPage: true });
  check("/status shows Operational", status.health === "Operational", status.health);
  check("/status commit matches", status.commit === expected, status.commit);
  check("/status database ok", status.database === "ok", status.database);
} finally {
  await browser.close();
}

const passed = checks.every((c) => c.ok);
const result = { url: base, expectedCommit: expected, passed, checkedAt: new Date().toISOString(), checks };
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name} (${c.detail})`);
console.log(`${passed ? "VERIFIED" : "NOT VERIFIED"} ${base} at ${expected}`);
console.log(`evidence: ${path.relative(repo, outDir)}`);
process.exit(passed ? 0 : 1);
