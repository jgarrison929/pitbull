#!/usr/bin/env node
// Verifies a deployed v5 app: /health and /status report the expected commit and Database ok, then
// walks the real flows (login, portfolio from Postgres, one assistant action, sandbox reset) on
// desktop and phone viewports.
// Also crawls 4 roles × every app page (incl. /roadmap, also at 375/1440, and every seeded cost-item drill-down) × 320/390/768/1280, checks the M2/M4/M5 numbers, and checks main's CI
// (last green commit, red main HEAD) — see SKILL.md.
// Usage: node .cursor/skills/verify-v5/verify.mjs [--url URL] [--commit SHA] [--wait SECONDS] [--shots DIR]
//        [--main-ci auto|on|off] [--max-green-age-hours 24] [--page-budget-ms 1500] [--self-check]
//        [--rc SHA] [--rc-version 5.0.4] [--phone-checks]
// Writes evidence to .cursor/skills/verify-v5/evidence/<timestamp>/ and exits 1 on any failed check.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  bannedHits,
  evaluateCrawlRow,
  evaluateM2,
  evaluateM4,
  evaluateM5,
  commitResults,
  expectedCommitFor,
  MAX_GREEN_AGE_HOURS,
  newestV5Tag,
  resolveTarget,
  PAGE_BUDGET_MS,
  runStep,
  shaMatches,
  slowestRow,
} from "./checks.mjs";
import { crawl, CRAWL_ROLES, CRAWL_WIDTHS, expectedNavLoads, navCrawlPlan, ROADMAP_EXTRA_WIDTHS, roadmapCoverageFailures } from "./crawl.mjs";
import { DRILL_ROLE_ACCESS, drillCoverageFailures, drillDiscoveryFailures, drillItemCount, drillLoadPlan, expectedDrillLoads, loadSeedCrawlTargets, PART_C_CHECK_4, partCFailures, seedChildEnv } from "./drill.mjs";
import { resolveDefaultCommit } from "./default-commit.mjs";
import { readMainCi, readRelease, resolvePrefix } from "./main-ci.mjs";
import { runM2, runM4M5 } from "./numbers.mjs";
import { ciGateIsPass } from "./status-ci-gate.mjs";
import { PORTFOLIO_STEP, runPortfolioStep } from "./portfolio.mjs";
import { RESET_BUDGET_MS, RESET_STEP, runResetTimeStep } from "./reset-time.mjs";
import { redactText, safeJson, secretValues, setFailureEvidence } from "./evidence.mjs";
import {
  attributeChecks,
  browserFailureCheck,
  buildRcChecks,
  deployedForMainRule,
  evaluateAppliedJournal,
  evaluateRcHead,
  journalAppliesCleanly,
  phoneChecksEnabled,
  readRcHistory,
  resolveRcMode,
} from "./rc.mjs";

// Any crash prints one redacted line: never a DATABASE_URL, password or VERIFY_TOKEN from an error message.
for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (error) => {
    console.error(`verify-v5 crashed: ${redactText(String(error?.stack ?? error?.message ?? error), secretValues(process.env))}`);
    process.exit(1);
  });
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "https://pitbull-web-staging.up.railway.app" },
    commit: { type: "string" },
    wait: { type: "string", default: "0" },
    shots: { type: "string" },
    "self-check": { type: "boolean", default: false },
    // auto = on for any non-localhost URL (staging/production), off for a local CI build.
    "main-ci": { type: "string", default: "auto" },
    // auto = production for pcserp.app hosts (demo., app.), else staging. See SKILL.md "Production".
    target: { type: "string", default: "auto" },
    "max-green-age-hours": { type: "string", default: String(MAX_GREEN_AGE_HOURS) },
    "page-budget-ms": { type: "string", default: String(PAGE_BUDGET_MS) },
    // RC handover (from 5.0.4): staging must serve this exact rc/<version> head. Absent = per-PR flow.
    rc: { type: "string" },
    "rc-version": { type: "string", default: "5.0.4" },
    // Phone layout checks (overflow, tap, text, clipping, one-tap). Also on for --rc at 5.0.4+.
    // Default crawl and 5.0.2 / 5.0.3 per-PR verifies leave this off.
    "phone-checks": { type: "boolean", default: false },
  },
});

const FULL_SHA = /^[0-9a-f]{40}$/;
const baseUrl = args.url.replace(/\/$/, "");
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(baseUrl);
if (!["auto", "on", "off"].includes(args["main-ci"])) {
  console.error(`--main-ci must be auto, on or off (got ${args["main-ci"]})`);
  process.exit(1);
}
// Production expects the newest v5 release tag; staging the last green main commit. No skip path:
// --target staging on a pcserp.app host and --main-ci off on production are refused here.
const { target, error: targetError } = resolveTarget(baseUrl, args.target, args["main-ci"]);
if (targetError) {
  console.error(targetError);
  process.exit(1);
}
const production = target === "production";
const { rc, error: rcError } = resolveRcMode({ version: args["rc-version"], sha: args.rc, commit: args.commit, target });
const phoneChecks = phoneChecksEnabled({ rc, flag: args["phone-checks"] });
if (rcError) {
  console.error(rcError);
  process.exit(1);
}
if (!args["self-check"]) {
  console.log(
    rc
      ? `target ${target} (RC ${rc.branch} head ${rc.sha})`
      : `target ${target} (${production ? "expects the newest v5 release tag" : "expects the last green main commit"})`,
  );
}
const mainCiOn = production || args["main-ci"] === "on" || (args["main-ci"] === "auto" && !isLocal && !args["self-check"]);

// main's CI: last green v5 commit (ci-gate success) and whether main HEAD is red. Read before the
// expected commit so the default expectation is the last green commit, not a red tip.
let mainCi = null;
let mainCiError = null;
if (mainCiOn) {
  try {
    mainCi = await readMainCi(repo);
  } catch (error) {
    mainCiError = String(error.message ?? error).split("\n")[0];
  }
}

// Production: the newest v5 release tag (semver) on origin, its ci-gate and whether it is on main.
let release = null;
let releaseError = null;
if (production) {
  try {
    release = await readRelease(repo, newestV5Tag);
  } catch (error) {
    releaseError = String(error.message ?? error).split("\n")[0];
  }
}

// Full 40-char SHA everywhere. Production: the newest v5 release tag's commit (never last green main).
// Staging: last green v5 commit on main when main CI is read, else the last origin/main commit
// touching v5/ (self-check and local runs, no network).
// RC handover: the --rc SHA itself. Staging must serve that commit, not last green main.
const expectedFull = (rc
  ? rc.sha
  : expectedCommitFor({ target, pinned: args.commit, release, mainCi, fallback: () => resolveDefaultCommit(repo) }))
  .trim()
  .toLowerCase();
const resolveSha = resolvePrefix(repo);
/** /health and /status show a 12-char prefix today; it must resolve unambiguously to expectedFull. */
const commitMatches = (shown) => shaMatches(shown, expectedFull, resolveSha);

// CI smoke: resolve default commit + prove execFileSync is bound (loadSeedDemoJobs needs it).
// Also refuse a short stamp payload — VERIFY_TOKEN staging would otherwise HTTP 400.
// No network, Playwright, or v5/node_modules — exits before those paths.
if (args["self-check"]) {
  execFileSync(process.execPath, ["-e", ""], { stdio: "ignore" });
  if (!FULL_SHA.test(expectedFull)) {
    console.error(
      `self-check failed: stamp commit must be full 40-char SHA, got length ${expectedFull.length} (${expectedFull || "(empty)"})`,
    );
    process.exit(1);
  }
  console.log(rc ? `self-check ok expected=${expectedFull} rc=${rc.version} branch=${rc.branch}` : `self-check ok expected=${expectedFull}`);
  process.exit(0);
}

const base = baseUrl;
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(here, "evidence", stamp);
mkdirSync(outDir, { recursive: true });

const shotDir = args.shots ? path.resolve(args.shots) : outDir;
mkdirSync(shotDir, { recursive: true });
/** Failed reset samples, crawl pages and drill-downs are captured here (evidence.mjs), secrets redacted. */
const failureDir = path.join(outDir, "failures");
/** Secret values (VERIFY_TOKEN, GH tokens, DATABASE_URL + password, …) never printed or written. */
const SECRETS = secretValues(process.env);
const safe = (x) => redactText(x, SECRETS);

const checks = [];
const check = (name, ok, detail) => checks.push({ name, ok: Boolean(ok), detail });
/** Visible, non-failing results (e.g. main HEAD red). Printed as WARN and kept in result.json. */
const warnings = [];
/** Runs one flow; a thrown error becomes a FAIL line instead of ending the run. */
const step = (name, fn) => runStep(check, name, fn);

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
while (!commitMatches(health.body.commit).ok && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15000));
  health = await fetchHealth().catch((error) => ({ status: 0, body: { error: String(error) } }));
}
writeFileSync(path.join(outDir, "health.json"), safeJson(health, SECRETS));
check("/health returns 200", health.status === 200, health.status);
check("/health status ok", health.body.status === "ok", health.body.status);
check("/health db ok", health.body.db === "ok", health.body.db);
{
  const m = commitMatches(health.body.commit);
  check("/health commit matches (full SHA)", m.ok, m.detail);
}

if (mainCiOn) {
  const deployedFull = resolveSha(String(health.body.commit ?? "")) ?? null;
  // An RC deploy is not main's last green commit. The last-green comparison stays for every other run.
  const results = commitResults({ target, mainCi, mainCiError, release, releaseError, deployedFull: deployedForMainRule(rc?.sha, deployedFull), maxAgeHours: Number(args["max-green-age-hours"]) });
  writeFileSync(path.join(outDir, "main-ci.json"), safeJson({ target, ...mainCi, release, deployedFull, rc: rc ?? null, results }, SECRETS));
  for (const r of results) {
    if (r.severity === "WARN") warnings.push({ name: r.name, detail: r.detail });
    else check(r.name, r.severity === "PASS", r.detail);
  }
}

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
  const out = execFileSync(tsx, ["-e", script], {
    encoding: "utf8",
    cwd: path.join(repo, "v5"),
    env: seedChildEnv(process.env), // allowlist only: no VERIFY_TOKEN / DATABASE_URL / V5_SEED_STRESS
  });
  const numbers = JSON.parse(out.trim());
  if (!Array.isArray(numbers) || numbers.length === 0) {
    throw new Error(`seed returned no jobs: ${out.trim()}`);
  }
  return numbers;
}

const seedJobNumbers = loadSeedDemoJobs();
/** Seeded cost-item drill-downs per job (seed() leaves + seedActionHistory's approved COs / import) — never hardcoded. */
const seedTargets = loadSeedCrawlTargets(repo);
const seedDrill = seedTargets.items;
const expectedJobCount = seedJobNumbers.length;
const PHONE_W = 390;
const PHONE_H = 844;
const PHONE_ROLES = ["pm", "foreman", "executive", "superintendent"];
/** Visible-text banned hits across crawled pages (label: "matched"). */
const bannedHitList = [];

/** Scan document.body.innerText only — ignores HTML attributes like input placeholder=. */
async function scanBannedVisible(page, label) {
  const visible = await page.evaluate(() => document.body?.innerText ?? "");
  for (const h of bannedHits(visible)) bannedHitList.push(`${label}: "${h.match}" (${h.id})`);
}

/** RC handover reads these after the browser run. Unset on a per-PR run. */
let statusCommitShown = null;
let migrationsLabel = null;
const rcSignals = { crawlRan: false, crawlFailures: [] };

let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  check("/ redirects to /login", new URL(page.url()).pathname === "/login", page.url());
  await scanBannedVisible(page, "login");
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
  statusCommitShown = status.commit;
  // Every run (per PR, post-merge, production, RC). A missing test id must not abort the crawl.
  migrationsLabel = await page.getByTestId("status-migrations").textContent({ timeout: 5000 }).then((t) => t?.trim() ?? "").catch(() => null);
  status.migrations = migrationsLabel;
  writeFileSync(path.join(outDir, "status.json"), safeJson(status, SECRETS));
  await page.screenshot({ path: path.join(outDir, "status.png"), fullPage: true });
  check("/status shows Operational", status.health === "Operational", status.health);
  {
  const m = commitMatches(status.commit);
  check("/status commit matches (full SHA)", m.ok, m.detail);
}
  if (rc) {
    const head = evaluateRcHead({ rcSha: rc.sha, shown: status.commit, resolve: resolveSha });
    check("staging /status serves the rc head", head.ok, head.ok ? head.detail : head.failures.join("; "));
  }
  check("/status database ok", status.database === "ok", status.database);
  check(
    "/status shows version",
    Boolean(status.version) && status.version !== "0.0.0",
    status.version,
  );
  check("/status ci-gate is pass", ciGateIsPass(status.ciGate), status.ciGate);
  {
    // Journal at the expected commit. `when` must rise in entry order, and every tag must be on
    // /status and /health with nothing applied that the journal does not have. Not only an RC run.
    let journal = null;
    let readError = null;
    try {
      const raw = execFileSync("git", ["show", `${expectedFull}:v5/drizzle/meta/_journal.json`], { cwd: repo, encoding: "utf8" });
      journal = JSON.parse(raw).entries ?? [];
    } catch (error) {
      const text = `${error?.stderr ?? ""}\n${error?.message ?? error}`;
      readError = `journal at ${expectedFull} could not be read: ${text.split("\n").map((s) => s.trim()).find(Boolean) ?? "git show failed"}`;
    }
    const migFails = evaluateAppliedJournal({
      journal,
      statusLabel: migrationsLabel,
      healthMigrations: health.body?.migrations,
      readError,
    });
    const last = journal?.at?.(-1)?.tag ?? journal?.[journal.length - 1]?.tag;
    check(
      "journal migrations applied in order",
      migFails.length === 0,
      migFails.length === 0
        ? `${journal.length} tags${last ? ` ending ${last}` : ""}; when increases; every tag is on /status and /health`
        : migFails.join("; "),
    );
  }
  check(
    "/status shows last-verify field",
    Boolean(status.lastVerify),
    status.lastVerify,
  );
  await scanBannedVisible(page, "status");
  await page.goto(`${base}/changelog`, { waitUntil: "networkidle" });
  check("/changelog returns 200", page.url().includes("/changelog"), page.url());
  await scanBannedVisible(page, "changelog");
  {
    const roadmapRes = await page.goto(`${base}/roadmap`, { waitUntil: "networkidle" });
    check("/roadmap returns 200", roadmapRes?.status() === 200, roadmapRes?.status());
    const roadmapText = (await page.locator("main").innerText()).trim();
    check(
      "/roadmap lists 5.0.0 as shipped",
      /\b5\.0\.0\b/.test(roadmapText) && /Shipped/i.test(roadmapText),
      roadmapText.slice(0, 200),
    );
    check(
      "/roadmap lists 5.0.1 as shipped",
      /\b5\.0\.1\b/.test(roadmapText) &&
        /Shipped[\s\S]*\b5\.0\.1\b/i.test(roadmapText) &&
        !/\bNext\b[\s\S]*\b5\.0\.1\b/.test(roadmapText),
      roadmapText.slice(0, 280),
    );
    check(
      "/roadmap uses Next (no dates on unshipped)",
      /\bNext\b/.test(roadmapText) &&
        !/coming\s+soon/i.test(roadmapText) &&
        !/\bTBD\b/i.test(roadmapText),
      roadmapText.includes("Next") ? "Next" : "missing Next",
    );
    await scanBannedVisible(page, "roadmap");
  }
  await page.close();
  await flows(browser);
  await navCrawl(browser);
  await numberChecks(browser);
} catch (error) {
  // A dead deploy used to reach only the process crash handler, which prints "verify-v5 crashed"
  // and never writes rc.json. Name the failure and let the RC block below still write it.
  const failed = browserFailureCheck(statusCommitShown, error?.message ?? error);
  check(failed.name, false, failed.detail);
} finally {
  await browser?.close();
}

check(
  "no banned visible strings on crawled pages",
  bannedHitList.length === 0,
  bannedHitList.length === 0 ? "clean" : bannedHitList.slice(0, 8).join("; "),
);

/**
 * 4 roles × every page (incl. /roadmap) × 320/390/768/1280, plus /roadmap × 375/1440. Fails on 4xx/5xx,
 * error boundary, console/page error, overflow, banned word, unallowed empty state, or a page over budget.
 */
async function navCrawl(browser) {
  const plan = navCrawlPlan(seedJobNumbers);
  const pages = plan[0].pages;
  const crawlShots = path.join(shotDir, "crawl");
  mkdirSync(crawlShots, { recursive: true });
  const budgetMs = Number(args["page-budget-ms"]);
  // Cost-item drill-downs ride the main pass (every role × CRAWL_WIDTHS): discovered on each seeded job page,
  // then each role loads every seeded item once, spread over the 4 widths (drillLoadPlan).
  const drill = {
    seedItems: seedDrill,
    plan: drillLoadPlan(seedDrill, { roles: CRAWL_ROLES, widths: CRAWL_WIDTHS }),
    records: [],
    access: DRILL_ROLE_ACCESS,
    // Part C crawl check 4: one cost item page + one plan page per active job, every role × width.
    partC: { active: seedTargets.active, planLinked: seedTargets.planLinked, records: [] },
  };
  await step("nav crawl: 4 roles × pages × 320/390/768/1280", async () => {
    const rows = [];
    for (const [i, pass] of plan.entries()) rows.push(...(await crawl(browser, base, { pages: pass.pages, widths: pass.widths, shotDir: crawlShots, drill: i === 0 ? drill : undefined, phoneChecks, evidence: { dir: failureDir, budgetMs, secrets: SECRETS } })));
    const failures = rows.flatMap((r) => evaluateCrawlRow(r, { budgetMs, phoneChecks }));
    rcSignals.crawlRan = true;
    rcSignals.crawlFailures = failures;
    const slow = slowestRow(rows);
    const drillRows = rows.filter((r) => r.drill);
    const pageRows = rows.filter((r) => !r.drill && !r.partC);
    const partCRows = rows.filter((r) => r.partC);
    const partC = partCFailures(rows, drill.partC.records, drill.records, seedTargets.active, { roles: CRAWL_ROLES, widths: CRAWL_WIDTHS, budgetMs });
    const slowPartC = slowestRow(partCRows);
    const slowDrill = slowestRow(drillRows);
    const discoveryFailures = drillDiscoveryFailures(drill.records, seedDrill, { roles: CRAWL_ROLES, widths: CRAWL_WIDTHS });
    const coverageFailures = drillCoverageFailures(rows, seedDrill, { roles: CRAWL_ROLES, budgetMs });
    writeFileSync(
      path.join(outDir, "crawl.json"),
      safeJson({ pages, plan, roles: CRAWL_ROLES, widths: CRAWL_WIDTHS, budgetMs, slowest: slow && { ...slow, text: undefined }, slowestDrill: slowDrill && { ...slowDrill, text: undefined }, drill: { seedItems: seedDrill, itemCount: drillItemCount(seedDrill), access: DRILL_ROLE_ACCESS, plan: Object.fromEntries([...drill.plan].map(([k, v]) => [k, v.map((x) => x.path)])), discovery: drill.records, discoveryFailures, coverageFailures }, partC: { name: PART_C_CHECK_4, active: seedTargets.active, planLinked: seedTargets.planLinked, records: drill.partC.records, failures: partC, slowest: slowPartC && { ...slowPartC, text: undefined } }, failures, rows: rows.map((r) => ({ ...r, text: undefined, textChars: r.text.length })) }, SECRETS),
    );
    const expectedLoads = expectedNavLoads(plan);
    check(
      "nav crawl: 4 roles × pages × 320/390/768/1280",
      failures.length === 0 && pageRows.length === expectedLoads,
      `${pageRows.length}/${expectedLoads} page loads + ${drillRows.length} drill-down loads + ${partCRows.length} Part C check 4 loads, ${failures.length} failures; slowest ${slow?.idleMs} ms (${slow?.role}@${slow?.width} ${slow?.path}), budget ${budgetMs} ms` +
        (failures.length ? ` — ${failures.slice(0, 6).join("; ")}` : ""),
    );
    // /roadmap gets the same per-load checks; this names its coverage (5.0.1 acceptance check 12).
    const roadmapRows = rows.filter((r) => r.path === "/roadmap");
    const roadmapFailures = roadmapCoverageFailures(rows, { budgetMs, phoneChecks });
    check(
      "nav crawl includes /roadmap",
      roadmapFailures.length === 0,
      roadmapFailures.length === 0
        ? `${CRAWL_ROLES.length} roles × ${[...CRAWL_WIDTHS, ...ROADMAP_EXTRA_WIDTHS].join("/")} (${roadmapRows.length} loads)`
        : roadmapFailures.slice(0, 8).join("; "),
    );
    // #706 cost-item drill-downs: the discovered set must equal the seed on every seeded job page for every role × width.
    const n = drillItemCount(seedDrill);
    check(
      "nav crawl discovers every seeded cost-item drill-down",
      discoveryFailures.length === 0 && drill.records.length === CRAWL_ROLES.length * CRAWL_WIDTHS.length * Object.keys(seedDrill).length,
      discoveryFailures.length === 0
        ? `${n} seeded items on ${Object.keys(seedDrill).length} jobs found by ${CRAWL_ROLES.length} roles × ${CRAWL_WIDTHS.join("/")} (${drill.records.length} job-page discoveries)`
        : `seed has ${n}; ${discoveryFailures.length} short/wrong — ${discoveryFailures.slice(0, 6).join("; ")}`,
    );
    const expectedDrill = expectedDrillLoads(seedDrill, CRAWL_ROLES);
    check(
      "nav crawl loads every seeded cost-item drill-down",
      coverageFailures.length === 0 && drillRows.length === expectedDrill,
      `${drillRows.length}/${expectedDrill} drill-down loads (each role loads all ${n} once across ${CRAWL_WIDTHS.join("/")}); slowest ${slowDrill?.idleMs} ms (${slowDrill?.role}@${slowDrill?.width} ${slowDrill?.path})` +
        (coverageFailures.length ? ` — ${coverageFailures.slice(0, 6).join("; ")}` : ""),
    );
    // 5.0.2 Part C acceptance check 4 (spec docs/v5/specs/5.0.2-crew-rates-and-field-history.md).
    const expectedPartC = CRAWL_ROLES.length * CRAWL_WIDTHS.length * seedTargets.active.length * 2;
    check(
      `${PART_C_CHECK_4}: one cost item page + one plan page per active job, 4 roles × 4 viewports`,
      partC.length === 0 && partCRows.length === expectedPartC,
      `active jobs ${seedTargets.active.join(", ")} (seed); ${partCRows.length}/${expectedPartC} loads (${partCRows.filter((r) => r.partC === "cost-item").length} cost item, ${partCRows.filter((r) => r.partC === "plan").length} plan), ${partC.length} failures; slowest ${slowPartC?.idleMs} ms (${slowPartC?.role}@${slowPartC?.width} ${slowPartC?.path})` +
        (partC.length ? ` — ${partC.slice(0, 6).join("; ")}` : ""),
    );
  });
}

/** M2 / M4 / M5 numbers, read from the job page the user sees. */
async function numberChecks(browser) {
  const fixtures = path.join(here, "fixtures");
  const expectedM2 = JSON.parse(readFileSync(path.join(fixtures, "m2-awkward-expected.json"), "utf8"));
  const numbers = {};
  await step("M2: 26-010 import + approve totals 10,071,336¢, 0 per-code mismatches", async () => {
    const m2 = await runM2(browser, base, { csv: path.join(fixtures, "m2-awkward-estimate.csv"), shotDir });
    const r = evaluateM2(m2, expectedM2);
    numbers.m2 = { observed: m2, ...r };
    check(
      "M2: 26-010 import + approve totals 10,071,336¢, 0 per-code mismatches",
      r.failures.length === 0,
      `original ${m2.original}¢, current ${m2.current}¢, estimate ${m2.estimate}¢ (want ${expectedM2.total}¢), ${r.mismatches.length} per-code mismatches of ${Object.keys(expectedM2.tree).length}` +
        (r.failures.length ? ` — ${r.failures.join("; ")}` : ""),
    );
  });
  await step("M4/M5: 25-031 EAC = AC + (CB − EV); CO-001 approve moves CB and EAC +6,000,000¢, OB 0; reset restores", async () => {
    const o = await runM4M5(browser, base, { shotDir });
    const m4 = evaluateM4(o.before);
    const m5 = evaluateM5(o);
    numbers.m4m5 = { observed: o, m4, m5 };
    check(
      "M4: 25-031 EAC = AC + (CB − EV) exactly",
      m4.failures.length === 0,
      `EV ${o.before.ev}¢, AC ${o.before.ac}¢, CB ${o.before.cb}¢, EAC ${o.before.eac}¢ (expect ${m4.expectEac}¢)` +
        (m4.failures.length ? ` — ${m4.failures.join("; ")}` : ""),
    );
    check(
      "M5: approve CO-001 on 25-031 moves CB and EAC +6,000,000¢, OB 0; reset restores seed",
      m5.failures.length === 0,
      `CO-001 ${o.coCents}¢ (${o.coStatus}); ΔCB ${m5.deltas.cb}¢, ΔEAC ${m5.deltas.eac}¢, ΔOB ${m5.deltas.ob}¢; after reset CB ${o.afterReset.cb}¢, EAC ${o.afterReset.eac}¢, OB ${o.afterReset.ob}¢` +
        (m5.failures.length ? ` — ${m5.failures.join("; ")}` : ""),
    );
  });
  writeFileSync(path.join(outDir, "numbers.json"), safeJson(numbers, SECRETS));
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
    await scanBannedVisible(page, "login-desktop");
    await signIn(page, "pm");
    const who = (await page.getByTestId("signed-in-as").textContent({ timeout: T }))?.trim();
    check("login as a role card", who === "Marcus Lee", `signed in as ${who}`);
  });

  await step(PORTFOLIO_STEP, async () => {
    // One call, driven by portfolio-mustfail.test.mjs against fake late/flapping pages: waits for the
    // rows to settle at the seed count instead of counting right after Escape (the #701 race).
    const r = await runPortfolioStep(page, { expected: expectedJobCount, seedJobNumbers, textTimeoutMs: T });
    sandbox = r.sandbox;
    check(PORTFOLIO_STEP, r.ok, r.detail);
    await scanBannedVisible(page, "portfolio-desktop");
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
    await scanBannedVisible(page, "job-desktop");
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
  setFailureEvidence(page, { dir: failureDir, secrets: SECRETS });
  await step(RESET_STEP, async () => {
    // Hard FAIL, every target: median of 5 timed resets (click → new seeded-at + main content rendered)
    // ≤ RESET_BUDGET_MS (reset-time.mjs). No flag. Idle-inclusive times are information only.
    const r = await runResetTimeStep(page, base, { expectedRows: expectedJobCount });
    writeFileSync(
      path.join(outDir, "reset-times.json"),
      safeJson(
        {
          budgetMs: RESET_BUDGET_MS,
          ready: "path <base>/app with reset=1 + new seeded-at + <main> visible with exactly the seeded job rows, all within 20 s of the click",
          samples: r.samples,
          values: r.values,
          median: r.median,
          ok: r.ok,
          failures: r.failures,
          infoOnlyNotInPassRule: { definition: "ready + no request in flight for 500 ms, watched at most 3000 ms after ready (capped)", idleValues: r.idleValues, idleMedian: r.idleMedian },
        },
        SECRETS,
      ),
    );
    check(RESET_STEP, r.ok, r.detail);
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
    await scanBannedVisible(mobile, "portfolio-mobile");
    await shot(mobile, "portfolio-mobile");
    await mobile.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" });
    await mobile.getByTestId("cost-list").waitFor({ timeout: T });
    const list = await mobile.getByTestId("cost-list").isVisible();
    const layout = await phoneLayout(mobile);
    await scanBannedVisible(mobile, "job-mobile");
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
        await scanBannedVisible(mobile, `phone-${role}@${job}`);
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

if (rc) {
  let history = null;
  let historyError = null;
  try {
    let present = false;
    try {
      execFileSync("git", ["cat-file", "-e", `${rc.sha}^{commit}`], { cwd: repo, stdio: "ignore" });
      present = true;
    } catch {
      present = false;
    }
    if (!present) execFileSync("git", ["fetch", "origin", rc.branch], { cwd: repo, encoding: "utf8" });
    history = readRcHistory({
      version: rc.version,
      sha: rc.sha,
      mainRef: "origin/main",
      git: (gitArgs) => execFileSync("git", gitArgs, { cwd: repo, encoding: "utf8" }),
    });
  } catch (error) {
    historyError = String(error.message ?? error).split("\n")[0];
  }
  const healthOk = health.status === 200 && health.body?.status === "ok" && health.body?.db === "ok";
  checks.push(...buildRcChecks({
    history,
    historyError,
    crawlRan: rcSignals.crawlRan,
    crawlFailures: rcSignals.crawlFailures,
    migrationsLabel,
    healthOk,
  }));
  const merges = history?.merges ?? [];
  const attributed = attributeChecks(checks, merges);
  checks.splice(0, checks.length, ...attributed);
  writeFileSync(
    path.join(outDir, "rc.json"),
    safeJson({
      version: rc.version,
      sha: rc.sha,
      branch: rc.branch,
      statusCommit: statusCommitShown,
      migrationsLabel,
      merges,
      added: history?.added ?? [],
      journalApplies: history ? journalAppliesCleanly(history.journal) : null,
      specPath: history?.specPath ?? null,
      attributions: checks.filter((c) => !c.ok).map((c) => ({ name: c.name, prs: c.prs ?? [], detail: c.detail })),
    }, SECRETS),
  );
}

const passed = checks.every((c) => c.ok);
const checkedAt = new Date().toISOString();
const result = {
  url: base,
  expectedCommit: expectedFull,
  passed,
  checkedAt,
  checks,
  warnings,
};
writeFileSync(path.join(outDir, "result.json"), safeJson(result, SECRETS));

// Stamp the deploy so /status can show last-verify (requires VERIFY_TOKEN on the app + runner).
// When VERIFY_TOKEN is set, a stamp failure fails the run (non-zero exit).
let stampFailed = false;
if (passed && process.env.VERIFY_TOKEN) {
  if (!FULL_SHA.test(expectedFull)) {
    stampFailed = true;
    console.log(
      `stamp failed: commit must be full 40-char SHA (got length ${expectedFull.length})`,
    );
  } else {
    try {
      const res = await fetch(`${base}/api/verify/stamp`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.VERIFY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ at: checkedAt, commit: expectedFull }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        console.log(`stamped last-verify ${body.lastVerifyAt ?? checkedAt}`);
      } else {
        stampFailed = true;
        console.log(`stamp failed HTTP ${res.status}: ${safeJson(body, SECRETS, 0)}`);
      }
    } catch (error) {
      stampFailed = true;
      console.log(`stamp failed: ${safe(error.message ?? error)}`);
    }
  }
} else if (passed && !process.env.VERIFY_TOKEN) {
  console.log("VERIFY_TOKEN unset — /status last-verify not stamped");
}

const verified = passed && !stampFailed;
for (const c of checks) console.log(safe(`${c.ok ? "PASS" : "FAIL"} ${c.name} (${c.detail})`));
for (const w of warnings) console.log(safe(`WARN ${w.name} (${w.detail})`));
if (stampFailed) console.log("FAIL stamp last-verify (VERIFY_TOKEN set but stamp failed)");
const failedCount = checks.filter((c) => !c.ok).length;
console.log(
  `summary: ${checks.length - failedCount}/${checks.length} checks passed, ${failedCount} failed, ${warnings.length} warning(s)` +
    (warnings.length ? ` — ${warnings.map((w) => w.name).join("; ")}` : ""),
);
console.log(`${verified ? "VERIFIED" : "NOT VERIFIED"} ${base} at ${expectedFull}${warnings.length ? ` (${warnings.length} WARN)` : ""}`);
console.log(`evidence: ${path.relative(repo, outDir)}`);
if (existsSync(failureDir)) console.log(`failure evidence: ${path.relative(repo, failureDir)} (${readdirSync(failureDir).filter((f) => f.endsWith(".json")).length} captures)`);
if (shotDir !== outDir) console.log(`screenshots: ${shotDir}`);
process.exit(verified ? 0 : 1);
