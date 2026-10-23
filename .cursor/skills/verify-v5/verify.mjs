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

/** Demo job numbers from the default seed (no V5_SEED_STRESS) — never hardcode the count. */
function loadSeedDemoJobs() {
  const tsx = path.join(repo, "v5", "node_modules", ".bin", "tsx");
  const seedPath = path.join(repo, "v5", "src", "seed", "index.ts");
  const script = `
    import { seed } from ${JSON.stringify(seedPath)};
    const rows = seed("00000000-0000-4000-8000-000000000099", new Date("2026-10-19T00:00:00Z"));
    process.stdout.write(JSON.stringify(rows.jobs.map((j) => j.number)));
  `;
  const env = { ...process.env };
  delete env.V5_SEED_STRESS;
  const out = execFileSync(tsx, ["-e", script], {
    encoding: "utf8",
    cwd: path.join(repo, "v5"),
    env,
  });
  const numbers = JSON.parse(out.trim());
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error(`seed returned no jobs: ${out.trim()}`);
  }
  return numbers;
}

const seedJobNumbers = loadSeedDemoJobs();
const expectedJobCount = seedJobNumbers.length;
const PHONE_W = 390;
const PHONE_H = 844;
const PHONE_ROLES = ["pm", "foreman", "executive", "superintendent"];

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
    ciGate: await text("status-ci-gate"),
    lastVerify: await text("status-last-verify"),
    built: await text("status-built"),
    database: await text("status-database"),
  };
  writeFileSync(path.join(outDir, "status.json"), JSON.stringify(status, null, 2));
  await page.screenshot({ path: path.join(outDir, "status.png"), fullPage: true });
  check("/status shows Operational", status.health === "Operational", status.health);
  check("/status commit matches", status.commit === expected, status.commit);
  check("/status database ok", status.database === "ok", status.database);
  check(
    "/status shows version",
    Boolean(status.version) && status.version !== "0.0.0",
    status.version,
  );
  check(
    "/status shows ci-gate",
    ["pass", "fail", "pending", "unknown"].includes(status.ciGate ?? ""),
    status.ciGate,
  );
  check(
    "/status shows last-verify field",
    Boolean(status.lastVerify),
    status.lastVerify,
  );
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
  /**
   * Phone overflow must not use layout `innerWidth` alone — it can grow with wide
   * content, hiding a 508px table inside a 390px viewport. Bound against the
   * intended phone width and visualViewport.width (whichever is tighter).
   */
  const phoneLayout = (page) =>
    page.evaluate(
      ({ intendedW, intendedH }) => {
        const doc = document.documentElement;
        const body = document.body;
        const vv = window.visualViewport;
        const viewportW = Math.min(intendedW, vv?.width ?? intendedW);
        const viewportH = Math.min(intendedH, vv?.height ?? intendedH);
        const scrollWidth = Math.max(
          doc.scrollWidth,
          body?.scrollWidth ?? 0,
          doc.clientWidth,
        );
        const nav = [...document.querySelectorAll('nav[aria-label="Main"]')].find(
          (n) => getComputedStyle(n).position === "fixed",
        );
        const r = nav?.getBoundingClientRect();
        const expectedTabs = ["Portfolio", "Assistant", "Status", "Changelog"];
        const labels = nav
          ? [...nav.querySelectorAll("a")].map((a) => a.textContent?.replace(/\s+/g, " ").trim() ?? "")
          : [];
        const tabBarOnScreen = Boolean(
          r &&
            r.width > 0 &&
            r.height > 0 &&
            r.left >= -1 &&
            r.top >= -1 &&
            r.right <= viewportW + 1 &&
            r.bottom <= viewportH + 1 &&
            expectedTabs.every((t) => labels.some((l) => l.includes(t))),
        );
        return {
          scrollWidth,
          viewportW,
          viewportH,
          overflowPx: scrollWidth - viewportW,
          tabBarOnScreen,
          labels,
        };
      },
      { intendedW: PHONE_W, intendedH: PHONE_H },
    );

  await step("signed out, /app redirects to /login", async () => {
    const anon = await browser.newContext();
    const p = await anon.newPage();
    await p.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const where = new URL(p.url()).pathname;
    check("signed out, /app redirects to /login", where === "/login", p.url());
    await anon.close();
  });

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
    await page.getByTestId("user-menu").click();
    sandbox = (await page.getByTestId("sandbox-id").textContent({ timeout: T }))?.trim();
    await page.keyboard.press("Escape");
    const rows = await page.getByTestId("portfolio-table").getByTestId("job-link").filter({ visible: true }).count();
    const cpi = (await page.getByTestId("kpi-cpi").textContent())?.trim();
    const noDevFooter = (await page.getByText("Live from Postgres").count()) === 0;
    const ok =
      Boolean(sandbox) &&
      rows === expectedJobCount &&
      /^\d\.\d\d[+−]\$/.test(cpi ?? "") &&
      noDevFooter;
    check(
      "portfolio loads from Postgres",
      ok,
      `${rows} jobs (seed expects ${expectedJobCount}: ${seedJobNumbers.join(", ")}), CPI ${cpi}, sandbox ${sandbox}`,
    );
    await shot(page, "portfolio-desktop");
  });

  await step("assistant runs a typed action and logs it", async () => {
    const run = await ask(page.getByTestId("assistant-rail"), "Why is Cedar Creek over budget?");
    const name = (await run.getByTestId("action-name").textContent())?.trim();
    const summary = (await run.getByTestId("action-summary").textContent())?.trim();
    await shot(page, "assistant-rail-desktop");
    await page.reload({ waitUntil: "networkidle" });
    const persisted = await page.getByTestId("assistant-rail").getByTestId("action-run").count();
    check("assistant runs a typed action and logs it", name === "Cost variance on 25-031" && persisted >= 1, `${name}: ${summary} (runs after reload: ${persisted})`);
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
    const rail = page.getByTestId("assistant-rail");
    // Visitor submit must be gone; seedActionHistory may leave the foreman's note run.
    const submitRuns = await rail
      .locator('[data-testid="action-run"][data-action="dailyPlan.submit"]')
      .count();
    const same = (await page.getByTestId("sandbox-id").textContent())?.trim();
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const after = await page.getByTestId("plan-card").getAttribute("data-status", { timeout: T });
    // Post #665: submit issues the plan (status "issued"); reset restores seed "draft".
    const ok =
      action === "dailyPlan.submit" &&
      submitted === "issued" &&
      after === "draft" &&
      reseeded !== seeded &&
      submitRuns === 0 &&
      same === sandbox;
    check(
      "sandbox reset reseeds",
      ok,
      `${action}: plan ${submitted} → ${after}, seeded ${seeded} → ${reseeded}, submit runs after reset ${submitRuns}, sandbox ${sandbox} → ${same}`,
    );
  });
  await step("an unknown job number is refused", async () => {
    // The sandbox was just reset, so Cedar Creek's plan is a draft that a wrong match would submit.
    const run = await ask(page.getByTestId("assistant-rail"), "Submit the plan for 99-999");
    const summary = (await run.getByTestId("action-summary").textContent())?.trim();
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const status = await page.getByTestId("plan-card").getAttribute("data-status", { timeout: T });
    check("an unknown job number is refused", summary?.includes("There is no job 99-999") && status === "draft", `${summary} (Cedar plan ${status})`);
  });
  const pour = () => page.locator('[data-testid="plan-line"][data-code="04-210"]');
  const pourMh = async () => (await pour().getByTestId("line-mh").textContent({ timeout: T }))?.trim();
  const resetDemo = async () => {
    await page.getByTestId("user-menu").click();
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.waitForURL(/reset=1/, { timeout: T });
  };
  await step("foreman changes the pour 60 → 80 on screen and it persists", async () => {
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const before = await pourMh();
    await pour().getByTestId("edit-line").click();
    const form = pour().getByTestId("line-form");
    await form.getByLabel("Man-hours").fill("80");
    await form.getByRole("button", { name: "Save" }).click();
    await form.waitFor({ state: "hidden", timeout: T });
    await page.reload({ waitUntil: "networkidle" });
    const after = await pourMh();
    const run = page.getByTestId("assistant-rail").getByTestId("action-run").last();
    await run.waitFor({ timeout: T });
    const action = await run.getAttribute("data-action");
    const summary = (await run.getByTestId("action-summary").textContent())?.trim();
    const ok = before === "60" && after === "80" && action === "dailyPlan.updateLine" && summary?.includes("man-hours 60 → 80");
    check("foreman changes the pour 60 → 80 on screen and it persists", ok, `${before} → ${after} after reload, ${action}: ${summary}`);
  });
  await step("foreman changes the pour 60 → 80 through the assistant and it persists", async () => {
    await resetDemo();
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const before = await pourMh();
    const run = await ask(page.getByTestId("assistant-rail"), "Change the pour to 80 man-hours");
    const action = await run.getAttribute("data-action");
    const summary = (await run.getByTestId("action-summary").textContent())?.trim();
    await page.reload({ waitUntil: "networkidle" });
    const after = await pourMh();
    const ok = before === "60" && after === "80" && action === "dailyPlan.updateLine" && summary?.includes("man-hours 60 → 80");
    check("foreman changes the pour 60 → 80 through the assistant and it persists", ok, `${before} → ${after} after reload, ${action}: ${summary}`);
  });
  await step("switching roles starts a fresh chat and keeps the audit trail", async () => {
    // The foreman just changed the pour through the rail; the PM must not see that chat.
    await signIn(page, "pm");
    const rail = page.getByTestId("assistant-rail");
    await rail.getByTestId("assistant-input").waitFor({ timeout: T });
    const pmPourRuns = await rail
      .getByTestId("action-run")
      .filter({ hasText: "Change the pour to 80 man-hours" })
      .count();
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    const changes = (await page.getByTestId("job-changes").textContent({ timeout: T })) ?? "";
    const audited = changes.includes("Luis Ortega") && changes.includes("man-hours 60 → 80");
    await signIn(page, "foreman");
    await rail.getByTestId("assistant-input").waitFor({ timeout: T });
    const foremanRuns = await rail.getByTestId("action-run").filter({ hasText: "Change the pour to 80 man-hours" }).count();
    // PM may have other seed runs in the rail; the pour edit must not appear there.
    const ok = pmPourRuns === 0 && audited && foremanRuns === 1;
    check("switching roles starts a fresh chat and keeps the audit trail", ok, `PM pour-edit runs ${pmPourRuns}, job changes list the foreman's edit ${audited}, foreman rail still has it ${foremanRuns}`);
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
    await mobile.getByTestId("portfolio-table").waitFor({ timeout: T });
    await shot(mobile, "portfolio-mobile");
    await mobile.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    await mobile.getByTestId("cost-list").waitFor({ timeout: T });
    const list = await mobile.getByTestId("cost-list").isVisible();
    const layout = await phoneLayout(mobile);
    await shot(mobile, "job-mobile");
    check(
      "phone: cost codes do not scroll sideways",
      list && layout.overflowPx <= 0,
      `cost-list visible ${list}, overflow ${layout.overflowPx}px (scrollWidth ${layout.scrollWidth} vs viewport ${layout.viewportW})`,
    );
  });

  await step("phone: every role×job fits width with tab bar on screen", async () => {
    const failures = [];
    for (const role of PHONE_ROLES) {
      await signIn(mobile, role);
      for (const job of seedJobNumbers) {
        await mobile.goto(`${base}/app/jobs/${job}`, { waitUntil: "networkidle" });
        // Job pages always expose the cost list (or tree) once loaded; wait for main content.
        await mobile.locator("main").waitFor({ timeout: T });
        const layout = await phoneLayout(mobile);
        if (layout.overflowPx > 0 || !layout.tabBarOnScreen) {
          failures.push(
            `${role}@${job}: overflow ${layout.overflowPx}px (scrollWidth ${layout.scrollWidth}/${layout.viewportW}), tabBar ${layout.tabBarOnScreen} [${layout.labels.join("|")}]`,
          );
        }
      }
    }
    check(
      "phone: every role×job fits width with tab bar on screen",
      failures.length === 0,
      failures.length === 0
        ? `${PHONE_ROLES.length} roles × ${seedJobNumbers.length} jobs ok`
        : failures.slice(0, 8).join("; "),
    );
  });
  await phone.close();
}

const passed = checks.every((c) => c.ok);
const checkedAt = new Date().toISOString();
const result = { url: base, expectedCommit: expected, passed, checkedAt, checks };
writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));

// Stamp the deploy so /status can show last-verify (requires VERIFY_STAMP_TOKEN on the app).
if (passed && process.env.VERIFY_STAMP_TOKEN) {
  try {
    const res = await fetch(`${base}/api/verify/stamp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VERIFY_STAMP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ at: checkedAt, commit: expected }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(
      res.ok
        ? `stamped last-verify ${body.lastVerifyAt ?? checkedAt}`
        : `stamp failed HTTP ${res.status}: ${JSON.stringify(body)}`,
    );
  } catch (error) {
    console.log(`stamp failed: ${error.message ?? error}`);
  }
} else if (passed && !process.env.VERIFY_STAMP_TOKEN) {
  console.log("VERIFY_STAMP_TOKEN unset — /status last-verify not stamped");
}

for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"} ${c.name} (${c.detail})`);
console.log(`${passed ? "VERIFIED" : "NOT VERIFIED"} ${base} at ${expected}`);
console.log(`evidence: ${path.relative(repo, outDir)}`);
if (shotDir !== outDir) console.log(`screenshots: ${shotDir}`);
process.exit(passed ? 0 : 1);
