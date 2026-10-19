#!/usr/bin/env node
// Verifies a deployed v5 app: /health and /status report the expected commit and Database ok, then
// walks the real flows (login, portfolio from Postgres, one assistant action, sandbox reset) on
// desktop and phone viewports.
// Usage: node .cursor/skills/verify-v5/verify.mjs [--url URL] [--commit SHA] [--wait SECONDS] [--shots DIR]
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
    shots: { type: "string" },
  },
});

const base = args.url.replace(/\/$/, "");
const expected = (
  args.commit ?? execFileSync("git", ["rev-parse", "origin/main"], { cwd: repo, encoding: "utf8" })
).trim().slice(0, 12);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(here, "evidence", stamp);
mkdirSync(outDir, { recursive: true });

const shotDir = args.shots ? path.resolve(args.shots) : outDir;
mkdirSync(shotDir, { recursive: true });

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });
/** Runs one flow; a thrown error becomes a FAIL line instead of ending the run. */
async function step(name, fn) {
  try {
    await fn();
  } catch (error) {
    check(name, false, String(error.message ?? error).split("\n")[0]);
  }
}

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
  await page.close();
  await flows(browser);
} finally {
  await browser.close();
}

async function flows(browser) {
  const T = 20000;
  const shot = (page, name) => page.screenshot({ path: path.join(shotDir, `${name}.png`), fullPage: true });
  const signIn = async (page, role) => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await page.getByTestId(`role-${role}`).click();
    await page.waitForURL(/\/app(\?|$)/, { timeout: T });
  };
  const ask = async (scope, prompt) => {
    // The transcript streams in after navigation, so count runs only once the composer is there.
    await scope.getByTestId("assistant-input").waitFor({ timeout: T });
    const runs = scope.getByTestId("action-run");
    const before = await runs.count();
    await scope.getByTestId("assistant-input").fill(prompt);
    await scope.getByRole("button", { name: "Send" }).click();
    await runs.nth(before).waitFor({ timeout: T });
    return runs.nth(before);
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desk.newPage();
  let sandbox;

  await step("login as a role card", async () => {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await shot(page, "login-desktop");
    await signIn(page, "pm");
    const who = (await page.getByTestId("signed-in-as").textContent({ timeout: T }))?.trim();
    check("login as a role card", who === "Marcus Lee", `signed in as ${who}`);
  });

  await step("portfolio loads from Postgres", async () => {
    const source = (await page.getByTestId("data-source").textContent({ timeout: T })) ?? "";
    sandbox = (await page.getByTestId("sandbox-id").textContent())?.trim();
    const rows = await page.getByTestId("portfolio-table").getByTestId("job-link").filter({ visible: true }).count();
    const cpi = (await page.getByTestId("kpi-cpi").textContent())?.trim();
    const ok = source.includes("Live from Postgres") && source.includes(sandbox) && rows === 3 && /^\d\.\d\d$/.test(cpi);
    check("portfolio loads from Postgres", ok, `${rows} jobs, CPI ${cpi}, "${source.trim()}"`);
    await shot(page, "portfolio-desktop");
  });

  await step("assistant runs a typed action and logs it", async () => {
    const run = await ask(page.getByTestId("assistant-rail"), "Why is Cedar Creek over budget?");
    const name = (await run.getByTestId("action-name").textContent())?.trim();
    const summary = (await run.getByTestId("action-summary").textContent())?.trim();
    await shot(page, "assistant-rail-desktop");
    await page.reload({ waitUntil: "networkidle" });
    const persisted = await page.getByTestId("assistant-rail").getByTestId("action-run").count();
    check("assistant runs a typed action and logs it", name === "job.costVariance(25-031)" && persisted >= 1, `${name}: ${summary} (runs after reload: ${persisted})`);
  });

  await step("sandbox reset reseeds", async () => {
    await signIn(page, "foreman");
    const submit = await ask(page.getByTestId("assistant-rail"), "Submit tomorrow's plan");
    const action = await submit.getAttribute("data-action");
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const submitted = await page.getByTestId("plan-card").getAttribute("data-status", { timeout: T });
    await shot(page, "job-desktop");
    const seeded = await page.getByTestId("seeded-at").getAttribute("datetime");
    await page.getByTestId("user-menu").click();
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.waitForURL(/reset=1/, { timeout: T });
    const reseeded = await page.getByTestId("seeded-at").getAttribute("datetime");
    const runs = await page.getByTestId("assistant-rail").getByTestId("action-run").count();
    const same = (await page.getByTestId("sandbox-id").textContent())?.trim();
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const after = await page.getByTestId("plan-card").getAttribute("data-status", { timeout: T });
    const ok = action === "dailyPlan.submit" && submitted === "submitted" && after === "draft" && reseeded !== seeded && runs === 0 && same === sandbox;
    check("sandbox reset reseeds", ok, `${action}: plan ${submitted} → ${after}, seeded ${seeded} → ${reseeded}, runs ${runs}, sandbox ${sandbox} → ${same}`);
  });
  await desk.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mobile = await phone.newPage();
  await step("phone: foreman lands on chat", async () => {
    await signIn(mobile, "foreman");
    await mobile.getByTestId("foreman-phone").waitFor({ timeout: T });
    const run = await ask(mobile.getByTestId("assistant-page"), "Show tomorrow's plan for Cedar Creek");
    const action = await run.getAttribute("data-action");
    await shot(mobile, "foreman-chat-mobile");
    check("phone: foreman lands on chat", action === "dailyPlan.show", action);
  });
  await step("phone: cost codes do not scroll sideways", async () => {
    await signIn(mobile, "pm");
    await shot(mobile, "portfolio-mobile");
    await mobile.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const list = await mobile.getByTestId("cost-list").isVisible();
    const over = await overflow(mobile);
    await shot(mobile, "job-mobile");
    check("phone: cost codes do not scroll sideways", list && over <= 0, `cost-list visible ${list}, overflow ${over}px`);
  });
  await phone.close();
}

const passed = checks.every((c) => c.ok);
const result = { url: base, expectedCommit: expected, passed, checkedAt: new Date().toISOString(), checks };
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name} (${c.detail})`);
console.log(`${passed ? "VERIFIED" : "NOT VERIFIED"} ${base} at ${expected}`);
console.log(`evidence: ${path.relative(repo, outDir)}`);
if (shotDir !== outDir) console.log(`screenshots: ${shotDir}`);
process.exit(passed ? 0 : 1);
