#!/usr/bin/env node
// Must-fail test for the browser crawl: serves fake pages on localhost and runs the real crawl()
// (Playwright from v5/node_modules) + evaluateCrawlRow over them. Every bad page must FAIL for the
// right reason, and the good pages and the two named seeded empty states must PASS.
// Run: node .cursor/skills/verify-v5/crawl-mustfail.test.mjs
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCrawlRow } from "./checks.mjs";
import { captureFailure, REDACTED, redactedDocumentHtml, redactText, startFailureRecorder } from "./evidence.mjs";
import { crawl, CRAWL_WIDTHS, ROADMAP_EXTRA_WIDTHS, roadmapCoverageFailures } from "./crawl.mjs";
import { drillCoverageFailures, drillDiscoveryFailures, drillLoadPlan, drillPath, loadSeedCrawlTargets, partCFailures } from "./drill.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");

// Slow fixtures sit just over the 1.5 s budget: networkidle adds a 500 ms quiet window after the response,
// so a 1050 ms response measures >= 1550 ms (typically ~1.6 s). A budget loosened by even 500 ms lets them pass,
// which this file then reports as MUST-FAIL WENT GREEN (the old 1.8 s fixtures measured ~2.3 s).
const SLOW_MS = 1050;
const shell = (body, extra = "") => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${extra}</head><body><main>${body}</main></body></html>`;
const job = (body) => shell(`<h1>Job</h1><div data-testid="cost-tree-row">03-210 Footing concrete</div>${body}`);
const co = (status, n = "CO-001") => `<article data-testid="co-card" data-co-number="${Number(n.slice(3))}" data-status="${status}"><h3>${n} · Wall</h3><p>No lines yet. Price it per cost item.</p></article>`;
const PAGES = {
  "/login": () => shell(`<button data-testid="role-pm" onclick="location.href='/app'">Project Manager</button>`),
  "/app": () => shell(`<a data-testid="job-link" href="/app/jobs/good">25-031</a>`),
  "/roadmap": () => shell("<h1>Roadmap</h1><h2>Shipped</h2><p>5.0.0</p><h2>Next</h2><p>5.0.1</p>"),
  "/roadmap-nomain": () => "<!doctype html><html><body><h1>Roadmap</h1></body></html>",
  "/app/jobs/good": () => job("<p>Cedar Creek. Superintendent notes. Stubborn clay.</p>"),
  "/app/jobs/24-077": () => job(co("voided")),
  "/app/jobs/24-118": () => job(co("draft")),
  "/app/jobs/coming": () => job("<p>Schedule — Coming soon</p>"),
  "/app/jobs/stub": () => job("<p>Forecast stub</p>"),
  "/app/jobs/wip": () => job("<p>WIP</p>"),
  "/app/jobs/http500": () => [500, job("<p>oops</p>")],
  "/app/jobs/sub500": () => job(`<script>fetch('/api/broken')</script>`),
  "/app/jobs/slow": () => [200, job("<p>slow</p>"), SLOW_MS],
  "/app/jobs/console": () => job(`<script>console.error("boom from page")</script>`),
  "/app/jobs/throw": () => job(`<script>setTimeout(() => { throw new Error("uncaught") })</script>`),
  "/app/jobs/boundary": () => job("<h2>Application error: a client-side exception has occurred</h2>"),
  "/app/jobs/wide": () => job(`<div style="width:2000px">wide table</div>`),
  "/app/jobs/empty": () => job("<p>No changes yet.</p>"),
  "/app/jobs/wrong-status": () => job(co("priced")),
  "/app/jobs/norows": () => shell("<h1>Job</h1>"),
  "/app/jobs/bounce": () => [302, "", 0, "/login"],
  // Error boundaries that answer HTTP 200 and render a <main>: the app's own PR #15 fallback
  // (route-error-fallback.tsx: "Page load failed" / "Shell load failed", data-testid route-error /
  // global-error) and Next 16's built-in error screen. Each must fail the load as an error boundary.
  "/app/jobs/route-error": () => layout(boundary("route-error", "Page load failed")),
  // The #15 verification's fault: /status answers 200 with the boundary inside <main>, no console error.
  // Nothing but the boundary check can catch it (no seeded-row rule applies to /status).
  "/status-fault": () => layout(boundary("route-error", "Page load failed")),
  "/app/jobs/route-error-marker": () => layout(boundary("route-error", "Could not show this job")), // marker only
  "/app/jobs/global-error": () => `<!doctype html><html><head><title>Load failed · Pitbull</title></head><body>${boundary("global-error", "Shell load failed")}</body></html>`,
  "/app/jobs/next-builtin": () => `<!doctype html><html><head><meta charset="utf-8"></head><body><div><h2>This page couldn’t load</h2><p>A server error occurred. Reload to try again.</p></div></body></html>`,
  // Evidence redaction: a failing page that sets a cookie, prints a canary token, and makes a request with
  // an Authorization header and a token in the query.
  "/app/jobs/leaky": () => job(`<p>${CANARY_TOKEN}</p><script>document.cookie = "sid=${CANARY_COOKIE}; path=/"; console.error("leak ${CANARY_TOKEN}"); fetch("/api/broken?access_token=${CANARY_QUERY}", { headers: { Authorization: "Bearer ${CANARY_TOKEN}" } });</script>`),
  "/app/jobs/77-005": () => drillJob("77-005", ["01-ok", "07-boundary"]), // seed also has 08-gone: discovery short
  // #706 drill-down: job pages whose cost tree is a short scroll box that renders links only as they
  // scroll into view (like the app's virtualized tree), so discovery has to scroll to find them all.
  "/app/jobs/77-001": () => drillJob("77-001", ["01-ok", "02-500", "03-slow", "04-ban", "05-deep"]),
  "/app/jobs/77-002": () => drillJob("77-002", ["01-ok"]), // seed says 01-ok and 02-gone: one is missing
  "/app/jobs/77-003": () => drillJob("77-003", ["01-noplan"]), // Part C check 4: no plan link anywhere
  "/app/jobs/77-004": () => drillJob("77-004", ["01-ok"]), // Part C check 4: plan page returns 500
  // Part C check 4 plan pages: 77-001's cost item links a good plan, 77-002's a slow one, 77-004's a 500.
  "/app/jobs/77-001/plans/p-good": () => planPage("Bridge Crew 2"),
  "/app/jobs/77-002/plans/p-slow": () => [200, planPage("Slow Crew"), SLOW_MS],
  "/app/jobs/77-004/plans/p-500": () => [500, planPage("Broken Crew")],
};
const CANARY_TOKEN = "canary-verify-token-1111-not-real";
const CANARY_COOKIE = "canarycookie1111notreal";
const CANARY_QUERY = "qtok1111canary1111notreal1111";
const layout = (body) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><nav aria-label="Main"><a href="/app">Portfolio</a></nav>${body}</body></html>`;
const boundary = (testid, title) => `<main data-testid="${testid}"><div><span>Pitbull</span><h1>${title}</h1><p>This screen failed to render. Try again. If it keeps failing, open the demo login and pick a role.</p><button type="button">Try again</button><a href="/login">Demo login</a></div></main>`;
const planPage = (crew) => shell(`<h1>Daily plan · ${crew}</h1><span data-testid="plan-detail-status">Approved</span><a data-testid="plan-detail-back" href="/app">back</a>`);
const PLAN_FOR = { "77-001": "p-good", "77-002": "p-slow", "77-004": "p-500" };
function drillJob(job, codes) {
  const rows = JSON.stringify(codes.map((c) => ({ c, href: `/app/jobs/${job}/cost-items/${c}` })));
  return shell(`<h1>Job ${job}</h1><p data-testid="estimate-status" data-status="approved">Estimate: approved</p><div data-testid="cost-tree-row">01 Earthwork</div>
<div data-testid="cost-tree-scroll" style="height:120px;overflow-y:auto"><div id="inner" style="position:relative;height:${codes.length * 60}px"></div></div>
<script>
const rows = ${rows}, box = document.querySelector('[data-testid="cost-tree-scroll"]'), inner = document.getElementById("inner");
function paint() {
  const first = Math.floor(box.scrollTop / 60), last = Math.ceil((box.scrollTop + box.clientHeight) / 60);
  inner.innerHTML = rows.slice(first, last).map((r, i) => '<a data-testid="cost-code-link-' + r.c + '" href="' + r.href + '" style="position:absolute;top:' + (first + i) * 60 + 'px;display:block;height:60px">' + r.c + '</a>').join("");
}
box.addEventListener("scroll", paint); paint();
</script>`);
}
const costItem = (title, job) =>
  shell(`<h1>${title}</h1><div data-testid="cost-item-cb"><span data-cents="100">$1.00</span></div><a data-testid="cost-item-back" href="/app">back</a>` +
    (PLAN_FOR[job] ? `<table><tr data-testid="cost-entry-labor"><td><a data-testid="cost-entry-plan-link" href="/app/jobs/${job}/plans/${PLAN_FOR[job]}">Crew</a></td></tr></table>` : ""));
const DRILL_PAGES = {
  "01-ok": (job) => costItem("01-ok Clearing", job),
  "01-noplan": (job) => costItem("01-noplan Mobilization", job),
  "05-deep": () => costItem("05-deep Deep item"),
  "02-500": () => [500, costItem("02-500")],
  "03-slow": () => [200, costItem("03-slow Slow item"), SLOW_MS],
  "04-ban": () => costItem("04-ban Export to ERP"),
  "07-boundary": () => layout(boundary("route-error", "Page load failed")), // drill-down lands on the PR #15 boundary
};
const server = http.createServer((req, res) => {
  const p = req.url.split("?")[0];
  const dm = p.match(/^\/app\/jobs\/(77-00\d)\/cost-items\/([^/]+)$/);
  const route = PAGES[p] ?? (dm && DRILL_PAGES[dm[2]] ? () => DRILL_PAGES[dm[2]](dm[1]) : undefined);
  if (!route) {
    res.writeHead(p === "/api/broken" ? 500 : 404, { "content-type": "text/plain" });
    return res.end("no");
  }
  const out = route();
  const [status, body, delay = 0, loc] = Array.isArray(out) ? out : [200, out];
  setTimeout(() => {
    res.writeHead(status, { "content-type": "text/html", ...(loc ? { location: loc } : {}) });
    res.end(body);
  }, delay);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// The fake /login → /app hop needs /app to match signInRole's waitForURL(/\/app(\?|$)/).
const expectFail = {
  "/app/jobs/coming": /banned "Coming soon"/,
  "/app/jobs/stub": /banned "stub"/,
  "/app/jobs/wip": /banned "WIP"/,
  "/app/jobs/http500": /navigation HTTP 500/,
  "/app/jobs/sub500": /HTTP 500 .*\/api\/broken/,
  "/app/jobs/slow": /ms > 1500 ms budget/,
  "/app/jobs/console": /console error boom from page/,
  "/app/jobs/throw": /page error uncaught/,
  "/app/jobs/boundary": /error boundary/,
  "/app/jobs/wide": /horizontal overflow/,
  "/app/jobs/empty": /empty state "No changes yet\."/,
  "/app/jobs/wrong-status": /empty state "No lines yet.*CO-001 \(priced\)/,
  "/app/jobs/norows": /job has no cost rows/,
  "/app/jobs/bounce": /landed on \/login/,
  "/app/jobs/route-error": /error boundary "Page load failed"/,
  "/app/jobs/route-error-marker": /error boundary marker \[data-testid="route-error"\]/,
  "/app/jobs/global-error": /error boundary "Shell load failed"/,
  "/app/jobs/next-builtin": /error boundary "This page couldn.t load"/,
};
const expectPass = ["/app", "/app/jobs/good", "/app/jobs/24-077", "/app/jobs/24-118"];
// Clean 200 twin of /status-fault: same layout, real content instead of the boundary.
PAGES["/status-ok"] = () => layout(`<main><h1>Status</h1><p>Operational</p></main>`);

const DRILL_SEED = { "77-001": ["01-ok", "02-500", "03-slow", "04-ban", "05-deep"], "77-002": ["01-ok", "02-gone"] };
const DRILL_ROLES = ["pm"];
const DRILL_WIDTHS = [390, 1280];
const drill = { seedItems: DRILL_SEED, plan: drillLoadPlan(DRILL_SEED, { roles: DRILL_ROLES, widths: DRILL_WIDTHS }), records: [] };

const browser = await chromium.launch();
let rows;
let roadmapRows;
let noMainRows;
let drillRows;
let partCRows;
let evRows;
// Failure evidence through the real crawl (as verify.mjs runs it): failing loads, a failing drill-down and
// a short discovery are captured; passing loads are not.
const evRoot = mkdtempSync(path.join(os.tmpdir(), "crawl-evidence-"));
const EV_SEED = { "77-005": ["01-ok", "07-boundary", "08-gone"] };
const evDrill = { seedItems: EV_SEED, plan: drillLoadPlan(EV_SEED, { roles: ["pm"], widths: [1280] }), records: [] };
// Part C crawl check 4 on fake active jobs: 77-001 good, 77-002 plan page slow, 77-003 no reachable plan page, 77-004 plan page 500.
const PART_C_ACTIVE = ["77-001", "77-002", "77-003", "77-004"];
const PART_C_SEED = { "77-001": ["01-ok"], "77-002": ["01-ok"], "77-003": ["01-noplan"], "77-004": ["01-ok"] };
const partCDrill = { seedItems: PART_C_SEED, plan: new Map(), records: [], partC: { active: PART_C_ACTIVE, planLinked: PART_C_SEED, records: [] } };
try {
  drillRows = await crawl(browser, base, { pages: ["/app/jobs/77-001", "/app/jobs/77-002"], roles: DRILL_ROLES, widths: DRILL_WIDTHS, drill });
  partCRows = await crawl(browser, base, { pages: PART_C_ACTIVE.map((j) => `/app/jobs/${j}`), roles: DRILL_ROLES, widths: DRILL_WIDTHS, drill: partCDrill });
  rows = await crawl(browser, base, { pages: [...expectPass, ...Object.keys(expectFail), "/status-fault", "/status-ok"], roles: ["pm"], widths: [390, 1280] });
  // /roadmap at every main-crawl width plus the extra 375/1440, as verify.mjs's nav crawl runs it.
  roadmapRows = await crawl(browser, base, { pages: ["/roadmap"], roles: ["pm"], widths: [...CRAWL_WIDTHS, ...ROADMAP_EXTRA_WIDTHS] });
  noMainRows = await crawl(browser, base, { pages: ["/roadmap-nomain"], roles: ["pm"], widths: [1440] });
  evRows = await crawl(browser, base, { pages: ["/app", "/app/jobs/good", "/app/jobs/http500", "/app/jobs/route-error", "/app/jobs/leaky", "/app/jobs/77-005"], roles: ["pm"], widths: [1280], drill: evDrill, evidence: { dir: evRoot, secrets: [CANARY_TOKEN] } });
} finally {
  await browser.close();
  server.close();
}
const lines = [];
for (const width of [390, 1280]) {
  for (const p of expectPass) {
    const f = evaluateCrawlRow(rows.find((r) => r.path === p && r.width === width));
    assert.deepEqual(f, [], `good page ${p}@${width} must pass`);
    lines.push(`passes: ${p}@${width}`);
  }
  for (const [p, re] of Object.entries(expectFail)) {
    const f = evaluateCrawlRow(rows.find((r) => r.path === p && r.width === width));
    assert.ok(f.some((x) => re.test(x)), `${p}@${width} must fail with ${re}; got ${JSON.stringify(f)}`);
    lines.push(`FAILS as expected: ${p}@${width} → ${f.find((x) => re.test(x))}`);
  }
}
{
  const f = roadmapCoverageFailures(roadmapRows, { roles: ["pm"] });
  assert.deepEqual(f, [], `/roadmap at 6 widths must pass; got ${JSON.stringify(f)}`);
  lines.push(`passes: /roadmap @ ${roadmapRows.map((r) => r.width).join("/")} (hasMain ${roadmapRows.every((r) => r.hasMain)})`);
  const missing = roadmapCoverageFailures(roadmapRows.filter((r) => r.width !== 1440), { roles: ["pm"] });
  assert.ok(missing.some((x) => /pm@1440 \/roadmap not crawled/.test(x)), `missing 1440 must fail; got ${JSON.stringify(missing)}`);
  lines.push(`FAILS as expected: /roadmap without the 1440 load → ${missing[0]}`);
  // Same row shape with no <main>, relabeled as /roadmap: the coverage check must reject it.
  const nm = roadmapCoverageFailures([...roadmapRows.filter((r) => r.width !== 1440), { ...noMainRows[0], path: "/roadmap", final: "/roadmap" }], { roles: ["pm"] });
  assert.ok(nm.some((x) => /no <main>/.test(x)), `no <main> must fail; got ${JSON.stringify(nm)}`);
  lines.push(`FAILS as expected: /roadmap with no <main> → ${nm.find((x) => /no <main>/.test(x))}`);
}
{
  // #706 drill-downs through the real crawl: discovery scrolls the tree, then the planned drill-downs load.
  // Every expectation is checked and all misses are reported together, so a regression names each must-fail it breaks.
  const missed = [];
  const expectTrue = (ok, msg, line) => (ok ? lines.push(line) : missed.push(msg));
  const opts = { roles: DRILL_ROLES, widths: DRILL_WIDTHS };
  for (const width of DRILL_WIDTHS) {
    const r = drill.records.find((x) => x.width === width && x.job === "77-001");
    const got = [...(r?.hrefs ?? [])].sort();
    const want = DRILL_SEED["77-001"].map((c) => drillPath("77-001", c));
    expectTrue(JSON.stringify(got) === JSON.stringify(want), `scrolling discovery must find all 5 on 77-001@${width}; got ${JSON.stringify(got)}`, `passes: discovery scrolls the cost tree and finds all 5 links on 77-001@${width} (only 2 render at a time)`);
  }
  const disc = drillDiscoveryFailures(drill.records, DRILL_SEED, opts);
  for (const width of DRILL_WIDTHS) {
    const re = new RegExp(`pm@${width} /app/jobs/77-002: found 1 of 2 seeded cost-item drill-downs; missing 02-gone`);
    const hit = disc.find((x) => re.test(x));
    expectTrue(hit, `MUST-FAIL WENT GREEN: discovery finds fewer than seeded @${width}; got ${JSON.stringify(disc)}`, `FAILS as expected: discovery finds fewer than seeded → ${hit}`);
  }
  expectTrue(!disc.some((x) => /77-001/.test(x)), `77-001 discovery must pass; got ${JSON.stringify(disc)}`, "passes: 77-001 discovery equals the seed");
  const cov = drillCoverageFailures(drillRows, DRILL_SEED, opts);
  const all = drillRows.flatMap((r) => evaluateCrawlRow(r)); // the per-load check verify.mjs applies to every crawl row
  const expect = [
    ["drill-down returns HTTP 500", /\/app\/jobs\/77-001\/cost-items\/02-500: navigation HTTP 500/],
    ["drill-down over budget", /\/app\/jobs\/77-001\/cost-items\/03-slow: \d+ ms > 1500 ms budget/],
    ["drill-down shows banned ERP", /\/app\/jobs\/77-001\/cost-items\/04-ban: banned "ERP" \(ERP\)/],
    ["undiscovered seeded drill-down never loaded", /pm \/app\/jobs\/77-002\/cost-items\/02-gone: seeded cost item never loaded/],
  ];
  for (const [name, re] of expect) {
    const hit = cov.find((x) => re.test(x));
    expectTrue(hit, `MUST-FAIL WENT GREEN: ${name} (coverage); got ${JSON.stringify(cov)}`, `FAILS as expected: ${name} → ${hit}`);
    if (!/never loaded/.test(name)) expectTrue(all.some((x) => re.test(x)), `MUST-FAIL WENT GREEN: ${name} (crawl rows)`, `FAILS as expected: ${name} (crawl rows too)`);
  }
  for (const ok of ["/app/jobs/77-001/cost-items/01-ok", "/app/jobs/77-001/cost-items/05-deep", "/app/jobs/77-002/cost-items/01-ok"]) {
    const loaded = drillRows.some((r) => r.drill && r.path === ok);
    expectTrue(loaded && !cov.some((x) => x.includes(ok + ":")), `${ok} must be loaded and pass; got ${JSON.stringify(cov)}`, `passes: drill-down ${ok}`);
  }
  for (const l of missed) console.log(l);
  assert.deepEqual(missed, [], `${missed.length} drill-down expectation(s) broken`);
}
{
  // 5.0.2 Part C crawl check 4 through the real crawl.
  const missed = [];
  const f = partCFailures(partCRows, partCDrill.partC.records, partCDrill.records, PART_C_ACTIVE, { roles: DRILL_ROLES, widths: DRILL_WIDTHS });
  const expect = [
    ["Part C check 4: missing plan page", /^Part C crawl check 4: pm@390 77-003 has no reachable plan page \(no plan link on the cost item's labor rows or the job page\)/],
    ["Part C check 4: slow plan page (~1.6 s)", /^Part C crawl check 4: pm@\d+ \/app\/jobs\/77-002\/plans\/p-slow: \d+ ms > 1500 ms budget/],
    ["Part C check 4: plan page HTTP 500", /^Part C crawl check 4: pm@\d+ \/app\/jobs\/77-004\/plans\/p-500: navigation HTTP 500/],
  ];
  for (const [name, re] of expect) {
    const hit = f.find((x) => re.test(x));
    if (hit) lines.push(`FAILS as expected: ${name} → ${hit}`);
    else missed.push(`MUST-FAIL WENT GREEN: ${name}; got ${JSON.stringify(f)}`);
  }
  for (const w of DRILL_WIDTHS) {
    const ok = partCRows.some((r) => r.width === w && r.partC === "plan" && r.path === "/app/jobs/77-001/plans/p-good") && !f.some((x) => x.includes(`@${w} 77-001`) || x.includes(`@${w} /app/jobs/77-001`));
    if (ok) lines.push(`passes: Part C check 4 on 77-001@${w} (cost item + plan page from its labor row)`);
    else missed.push(`Part C check 4 on 77-001@${w} must pass; got ${JSON.stringify(f)}`);
  }
  for (const l of missed) console.log(l);
  assert.deepEqual(missed, [], `${missed.length} Part C check 4 expectation(s) broken`);
}
{
  // The fake slow pages must stay close enough to the budget that a loosened budget is caught:
  // under budget + 500 ms, a `budgetMs + 500` regression would let them pass.
  const groups = [rows.filter((r) => r.path === "/app/jobs/slow"), drillRows.filter((r) => r.path.endsWith("/03-slow")), partCRows.filter((r) => r.path.endsWith("/p-slow"))];
  const slow = groups.flat();
  const ms = slow.map((r) => r.idleMs);
  assert.ok(groups.every((g) => g.length > 0) && ms.every((x) => x > 1500 && x < 2000), `slow fixtures must measure in (1500, 2000) ms to pin the budget; got ${JSON.stringify(ms)}`);
  lines.push(`passes: slow fixtures measured ${Math.min(...ms)}–${Math.max(...ms)} ms (just over the 1500 ms budget)`);
}
{
  // Seed subprocess env: run the real seed loader with a canary VERIFY_TOKEN / DATABASE_URL in the parent env
  // and check the child's own env (reported by the child) has neither; a leaking env must throw.
  const repo = path.join(here, "../../..");
  const canary = "canary-not-a-real-secret";
  const parentEnv = { ...process.env, VERIFY_TOKEN: canary, DATABASE_URL: canary, V5_SEED_STRESS: "1" };
  const t = loadSeedCrawlTargets(repo, { parentEnv });
  for (const k of ["VERIFY_TOKEN", "DATABASE_URL", "V5_SEED_STRESS"]) assert.ok(!t.childEnvKeys.includes(k), `seed child env must lack ${k}; got ${t.childEnvKeys}`);
  assert.ok(Object.keys(t.items).length > 0 && t.active.length > 0, "seed loader still derives items and active jobs with the minimal env");
  lines.push(`passes: seed subprocess env has ${t.childEnvKeys.length} keys [${t.childEnvKeys.join(", ")}], no VERIFY_TOKEN / DATABASE_URL / V5_SEED_STRESS`);
  assert.throws(() => loadSeedCrawlTargets(repo, { parentEnv, childEnv: parentEnv }), /seed subprocess env leaked parent vars: .*VERIFY_TOKEN/, "a seed child that sees VERIFY_TOKEN must throw");
  lines.push("FAILS as expected: seed subprocess given the full parent env → seed subprocess env leaked parent vars (… VERIFY_TOKEN …)");
}
for (const width of [390, 1280]) {
  // 200 + <main> + no console error + "Page load failed": only the boundary check stands between it and a pass.
  const row = rows.find((r) => r.path === "/status-fault" && r.width === width);
  assert.ok(row.status === 200 && row.hasMain && row.consoleErrors.length === 0 && row.pageErrors.length === 0, `fixture must be a quiet 200 with <main>; got ${JSON.stringify({ status: row.status, hasMain: row.hasMain, c: row.consoleErrors, p: row.pageErrors })}`);
  const f = evaluateCrawlRow(row);
  assert.deepEqual(f, [`pm@${width} /status-fault: error boundary "Page load failed"`, `pm@${width} /status-fault: error boundary marker [data-testid="route-error"]`], `quiet 200 boundary page must fail only as an error boundary; got ${JSON.stringify(f)}`);
  lines.push(`FAILS as expected: quiet 200 /status-fault@${width} with <main>, no console error → ${f.join("; ")}`);
  const ok = evaluateCrawlRow(rows.find((r) => r.path === "/status-ok" && r.width === width));
  assert.deepEqual(ok, [], `its clean twin /status-ok@${width} must pass; got ${JSON.stringify(ok)}`);
  lines.push(`passes: /status-ok@${width} (same layout, no boundary)`);
}
{
  // The PR #15 boundary on a drill-down fails that drill-down's load (200, <main>, no console error).
  const row = evRows.find((r) => r.drill && r.path === "/app/jobs/77-005/cost-items/07-boundary");
  assert.ok(row && row.status === 200 && row.hasMain && row.consoleErrors.length === 0, "boundary drill-down fixture is a quiet 200 with <main>");
  const f = row ? evaluateCrawlRow(row) : [];
  assert.ok(f.some((x) => /error boundary "Page load failed"/.test(x)) && f.some((x) => /error boundary marker \[data-testid="route-error"\]/.test(x)), `drill-down on the boundary must fail; got ${JSON.stringify(f)}`);
  lines.push(`FAILS as expected: drill-down lands on the PR #15 boundary → ${f.find((x) => /error boundary/.test(x))}`);
  const ok = evRows.find((r) => r.drill && r.path === "/app/jobs/77-005/cost-items/01-ok");
  assert.deepEqual(ok ? evaluateCrawlRow(ok) : ["not loaded"], [], "the clean drill-down next to it passes");
}
{
  // Failure evidence: what was captured, for which loads, and that no secret reached any text file.
  const files = readdirSync(evRoot);
  const recs = files.filter((f) => f.endsWith(".json")).map((f) => ({ f, ...JSON.parse(readFileSync(path.join(evRoot, f), "utf8")) }));
  const byLabel = (re) => recs.filter((r) => re.test(r.label));
  for (const r of recs) for (const ext of [".png", ".html"]) assert.ok(files.includes(r.f.replace(/\.json$/, ext)), `${r.f} needs its ${ext}`);
  const want = [
    ["crawl", /pm-w1280-\/app\/jobs\/http500$/, /navigation HTTP 500/],
    ["crawl", /pm-w1280-\/app\/jobs\/route-error$/, /error boundary "Page load failed"/],
    ["crawl", /pm-w1280-\/app\/jobs\/leaky$/, /HTTP 500 .*\/api\/broken/],
    ["drill", /pm-w1280-\/app\/jobs\/77-005\/cost-items\/07-boundary$/, /error boundary/],
    ["drill-discovery", /pm-w1280-\/app\/jobs\/77-005$/, /found 2 of 3 seeded cost-item drill-downs; missing 08-gone/],
  ];
  for (const [kind, label, reason] of want) {
    const hit = byLabel(label).filter((r) => r.kind === kind && reason.test(r.reason));
    assert.equal(hit.length, 1, `one ${kind} capture for ${label} with ${reason}; got ${JSON.stringify(recs.map((r) => [r.kind, r.label, r.reason]))}`);
    lines.push(`passes: evidence captured for ${kind} ${hit[0].label} (${hit[0].f} + png + html)`);
  }
  assert.equal(recs.length, want.length, `only failing loads are captured; got ${JSON.stringify(recs.map((r) => r.label))}`);
  for (const r of evRows.filter((x) => /http500|route-error|leaky|07-boundary/.test(x.path))) assert.ok(r.evidence && files.includes(r.evidence), `${r.path} row points at its capture`);
  const leaky = byLabel(/leaky$/)[0];
  assert.equal(leaky.url, `${base}/app/jobs/leaky`);
  const req = leaky.failedRequests.find((x) => x.status === 500);
  assert.ok(req && req.method === "GET" && req.url === `${base}/api/broken?access_token=REDACTED` && req.requestHeaders.authorization === "[redacted]", `failed request recorded with method/URL/status, token + Authorization redacted; got ${JSON.stringify(leaky.failedRequests)}`);
  assert.ok(leaky.consoleErrors.some((x) => x === "leak [redacted]"), `console error recorded, redacted; got ${JSON.stringify(leaky.consoleErrors)}`);
  const text = files.filter((f) => !f.endsWith(".png")).map((f) => readFileSync(path.join(evRoot, f), "utf8"));
  for (const secret of [CANARY_TOKEN, CANARY_COOKIE, CANARY_QUERY]) assert.ok(!text.some((t) => t.includes(secret)), `evidence must never contain ${secret}`);
  lines.push("passes: crawl evidence has no VERIFY_TOKEN canary, cookie value or token query value; Authorization redacted; clean loads not captured");
  rmSync(evRoot, { recursive: true, force: true });
}
// ---- Next.js flight script, failing request URLs, URLSearchParams, lowercase hex, srcdoc (lead re-review 5647038738) ----
// A mock Next-style page: the flight payload in self.__next_f.push is JSON inside JSON with < > & written
// as \u003c \u003e \u0026; failing fetches put the secret in the path and the query, which Chromium
// path- / query-encodes before they land in the .json; links carry it in URLSearchParams form and in
// lowercase hex; iframes carry it double- and triple-HTML-escaped in srcdoc. The page itself is opened at
// a URL with the secret in its path and query (the top-level `url`). Every form must be gone from the
// .html, the .json and a log line, both by the exact strings and by a brute-force decoder.
let flightCases = 0;
{
  const PASSWORDS = [`x</>&"y'z`, `x</>&"y`, `a&"b12`, `p<'q12`, `n\u00a0b<"&12`, `ab&cd1234`];
  const hex4 = (c) => c.charCodeAt(0).toString(16).padStart(4, "0");
  const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const json = (x) => JSON.stringify(x).slice(1, -1);
  const uNext = (x) => x.replace(/[&<>\u2028\u2029]/g, (c) => `\\u${hex4(c)}`); // Next.js htmlEscapeJsonString
  const lower = (x) => x.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
  const usp = (x) => new URLSearchParams({ note: x }).toString();
  const BASE = "http://pv-redact.test";
  const dec = [
    (t) => t.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);?/gi, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0" })[e.toLowerCase()] ?? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1))),
    (t) => t.replace(/\\(u[0-9a-f]{4}|["\\/'])/gi, (m, e) => (e.length === 5 ? String.fromCharCode(parseInt(e.slice(1), 16)) : e)),
    (t) => t.replace(/(%[0-9a-f]{2})+/gi, (m) => { try { return decodeURIComponent(m); } catch { return m; } }),
    (t) => t.replace(/\+/g, " "),
  ];
  const decodesTo = (t, pw) => {
    let frontier = new Set([t]);
    const seen = new Set(frontier);
    for (let d = 0; d <= 4; d++) {
      for (const x of frontier) if (x.includes(pw)) return true;
      const next = new Set();
      for (const x of frontier) for (const f of dec) { const o = f(x); if (!seen.has(o)) (seen.add(o), next.add(o)); }
      frontier = next;
    }
    return false;
  };
  const browser = await chromium.launch();
  const evRoot = mkdtempSync(path.join(os.tmpdir(), "flight-evidence-"));
  try {
    for (const pw of PASSWORDS) {
      const flight = uNext(JSON.stringify([1, `0:${JSON.stringify({ title: pw })}\n`]));
      const body = [
        `<h1>Job</h1>`,
        `<a id="usp" href="/s?${usp(pw)}">s</a>`,
        `<a id="low" href="/s?note=${lower(encodeURIComponent(pw))}">l</a>`,
        `<iframe srcdoc="${esc(`<p>${esc(pw)}</p>`)}"></iframe>`,
        `<iframe srcdoc="<p>${esc(esc(esc(pw)))}</p>"></iframe>`,
        `<script>self.__next_f=self.__next_f||[];self.__next_f.push(${flight})</script>`,
        `<script>(() => { const pw = ${uNext(JSON.stringify(pw))}; const low = (x) => x.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase());
          console.error("render failed for " + pw);
          for (const u of ["/api/p/" + pw, "/api/q?note=" + pw, "/api/e?note=" + encodeURIComponent(pw), "/api/u?" + new URLSearchParams({ note: pw }), "/api/l/" + low(encodeURIComponent(pw))]) fetch(u).catch(() => {});
        })()</script>`,
      ].join("");
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.route(`${BASE}/**`, (r) => (r.request().url().includes("/api/") ? r.fulfill({ status: 404, contentType: "text/plain", body: "nf" }) : r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: `<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body><main>${body}</main></body></html>` })));
      const rec = startFailureRecorder(page);
      await page.goto(`${BASE}/p/${pw}?note=${encodeURIComponent(pw)}`);
      for (let t = 0; t < 50 && rec.since(0).filter((e) => e.kind === "request").length < 5; t++) await page.waitForTimeout(50);
      const reqUrls = rec.since(0).filter((e) => e.kind === "request").map((e) => e.url);
      assert.equal(reqUrls.length, 5, `fixture must fail 5 requests; got ${JSON.stringify(reqUrls)}`);
      const raw = await page.content();
      // The exact forms, and sanity that Chromium really produced each one where the fixture puts it.
      const pathForm = new URL(`${BASE}/api/p/${pw}`).pathname.slice("/api/p/".length);
      const queryForm = new URL(`${BASE}/s?note=${pw}`).search.slice("?note=".length);
      const forms = {
        "flight (JSON twice, <>& as \\u)": [uNext(json(json(pw))), raw],
        "URL path (browser encoding)": [pathForm, reqUrls.join(" ") + page.url()],
        "URL query (browser encoding)": [queryForm, reqUrls.join(" ")],
        "URLSearchParams": [usp(pw).slice(5), raw + reqUrls.join(" ")],
        "lowercase hex": [lower(encodeURIComponent(pw)), raw + reqUrls.join(" ")],
        "srcdoc double-escaped": [esc(esc(pw)), raw],
        "srcdoc triple-escaped": [esc(esc(esc(pw))), raw],
      };
      const sanity = Object.entries(forms).filter(([, [f, where]]) => f !== pw && where.includes(f)).map(([n]) => n);
      for (const n of ["URL path (browser encoding)", "URLSearchParams", "lowercase hex", ...(/\u00a0/.test(pw) ? [] : ["srcdoc double-escaped", "srcdoc triple-escaped"])].filter((n) => forms[n][0] !== pw)) assert.ok(sanity.includes(n), `Chromium must write the ${n} form of ${JSON.stringify(pw)} (${JSON.stringify(forms[n][0])}); saw ${JSON.stringify(sanity)}`);
      if (/[<>&]/.test(pw)) assert.ok(sanity.includes("flight (JSON twice, <>& as \\u)"), `the page must hold the flight form ${JSON.stringify(forms["flight (JSON twice, <>& as \\u)"][0])}`);
      assert.ok(decodesTo(raw, pw) && reqUrls.every((u) => decodesTo(u, pw)) && decodesTo(page.url(), pw), "every raw source must hold the secret in some form (fixture sanity)");
      const exact = Object.values(forms).map(([f]) => f).filter((f) => f.length >= 2);
      const leaks = (t) => [...exact.filter((f) => t.includes(f)), ...(decodesTo(t, pw) ? ["(decodes to the secret)"] : [])];
      // Backstop text redaction over Chromium's serialization, and the DOM-level pass.
      assert.deepEqual(leaks(redactText(raw, [pw])), [], `redactText(page.content()) must leave no form of ${JSON.stringify(pw)}`);
      const dom = await redactedDocumentHtml(page, [pw]);
      assert.ok(typeof dom === "string" && dom.includes("self.__next_f.push(") && dom.includes(REDACTED), `redactedDocumentHtml must return the page with the flight script, redacted; got ${String(dom).slice(0, 200)}`);
      assert.deepEqual(leaks(dom), [], `redactedDocumentHtml must leave no form of ${JSON.stringify(pw)}`);
      // captureFailure .html and .json.
      const dir = path.join(evRoot, `f${flightCases}`);
      const files = await captureFailure(page, { dir, kind: "crawl", label: `flight-${flightCases}`, reason: `failed on ${page.url()}`, recorder: rec, secrets: [pw] });
      for (const f of [files.html, files.json]) {
        const t = readFileSync(path.join(dir, f), "utf8");
        assert.deepEqual(leaks(t), [], `${f} must hold no form of ${JSON.stringify(pw)}`);
      }
      const rec0 = JSON.parse(readFileSync(path.join(dir, files.json), "utf8"));
      assert.equal(rec0.failedRequests.length, 5, `.json lists the 5 failed requests; got ${JSON.stringify(rec0.failedRequests)}`);
      assert.ok(rec0.url.startsWith(`${BASE}/p/`) && rec0.failedRequests.every((r) => r.url.startsWith(`${BASE}/api/`) && r.url.includes(REDACTED)), `URLs keep their shape with the secret redacted; got ${rec0.url} ${JSON.stringify(rec0.failedRequests.map((r) => r.url))}`);
      // A log line as verify.mjs prints it (redactText): page URL, request URLs and console text.
      const log = redactText(`FAIL crawl ${page.url()}: ${reqUrls.join(" ")} console: ${rec.since(0).filter((e) => e.kind === "console").map((e) => e.text).join(" | ")}`, [pw]);
      assert.deepEqual(leaks(log), [], `a log line must hold no form of ${JSON.stringify(pw)}; got ${log}`);
      assert.ok(await page.evaluate(() => self.__next_f.length === 1), "the live page is not changed by redaction");
      await ctx.close();
      flightCases += 1;
      lines.push(`passes: real Chromium flight/URL capture of ${JSON.stringify(pw)} (forms seen: ${sanity.join(", ")}) has none of them, nor anything decoding to it: backstop, DOM-level, captureFailure html + json, log line`);
    }
  } finally {
    await browser.close();
    rmSync(evRoot, { recursive: true, force: true });
  }
}
// ---- .html capture vs real Chromium serialization (lead re-review 5646855343) ----
// page.content() escapes text nodes as & nbsp < > only (quotes raw) and attribute values as & nbsp " (and
// < > in newer Chromium), so a password mixing a quote with & < > survived a single all-five-escaped form.
// Made-up passwords; each goes into text nodes (title, p, span, comment), attributes and a script.
let htmlCases = 0;
{
  const PASSWORDS = [`x</>&"y'z`, `x</>&"y`, `a&"b12`, `p<'q12`, `n\u00a0b<"&12`];
  const nb = (x) => x.replace(/\u00a0/g, "&nbsp;");
  const textForm = (x) => nb(x.replace(/&/g, "&amp;")).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const attrForm = (x) => nb(x.replace(/&/g, "&amp;")).replace(/"/g, "&quot;");
  const leakForms = (pw) => [...new Set([pw, textForm(pw), attrForm(pw), attrForm(pw).replace(/</g, "&lt;").replace(/>/g, "&gt;"), textForm(pw).replace(/"/g, "&quot;").replace(/'/g, "&#39;"), JSON.stringify(pw).slice(1, -1)])];
  const leaks = (text, pw) => leakForms(pw).filter((f) => text.includes(f));
  const browser = await chromium.launch();
  const evRoot = mkdtempSync(path.join(os.tmpdir(), "html-evidence-"));
  try {
    for (const pw of PASSWORDS) {
      const page = await browser.newPage();
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><title>t</title></head><body><main><h1>Job</h1><p id="p"></p><span id="s"></span><a id="a" href="/x">link</a><input id="i"><template id="t"><b></b></template></main></body></html>`);
      await page.evaluate((pw) => {
        document.title = `Job ${pw}`;
        document.getElementById("p").textContent = pw;
        document.getElementById("s").textContent = `before ${pw} after`;
        document.getElementById("a").setAttribute("title", pw);
        document.getElementById("a").setAttribute("data-x", `pre ${pw} post`);
        document.getElementById("i").setAttribute("value", pw);
        document.getElementById("t").content.firstChild.textContent = pw;
        document.querySelector("main").append(document.createComment(` ${pw} `));
        const sc = document.createElement("script");
        sc.type = "application/json";
        sc.textContent = JSON.stringify({ pw });
        document.body.append(sc);
      }, pw);
      const raw = await page.content();
      // Sanity: Chromium really writes the mixed forms (this is what slipped through before).
      const seen = leaks(raw, pw);
      assert.ok(seen.length >= 2, `fixture must make Chromium serialize ${JSON.stringify(pw)} in escaped forms; saw ${JSON.stringify(seen)}`);
      // Layer 1 (backstop): redactText over Chromium's own serialization catches every form.
      const backstop = redactText(raw, [pw]);
      assert.deepEqual(leaks(backstop, pw), [], `redactText(page.content()) must leave no form of ${JSON.stringify(pw)}; Chromium wrote ${JSON.stringify(seen)}`);
      // Layer 2: DOM-level redaction before serializing.
      const dom = await redactedDocumentHtml(page, [pw]);
      assert.ok(typeof dom === "string" && dom.startsWith("<!DOCTYPE html>") && dom.includes("<main>") && dom.includes(REDACTED), `redactedDocumentHtml must return the page HTML with [redacted]; got ${String(dom).slice(0, 200)}`);
      assert.deepEqual(leaks(dom, pw), [], `redactedDocumentHtml must leave no form of ${JSON.stringify(pw)}`);
      assert.equal(await page.textContent("#p"), pw, "the live page is not changed by redaction");
      // End to end: captureFailure's .html and .json.
      const dir = path.join(evRoot, String(htmlCases));
      const files = await captureFailure(page, { dir, kind: "crawl", label: `html-${htmlCases}`, reason: `failed on ${pw}`, secrets: [pw], extra: { pw } });
      for (const f of [files.html, files.json]) {
        const t = readFileSync(path.join(dir, f), "utf8");
        assert.deepEqual(leaks(t, pw), [], `${f} must hold no raw, text-escaped or attribute-escaped form of ${JSON.stringify(pw)}`);
      }
      await page.close();
      htmlCases += 1;
      lines.push(`passes: real Chromium .html capture of ${JSON.stringify(pw)} (serialized as ${seen.length} forms) has none of them: backstop forms, DOM-level redaction, captureFailure html + json`);
    }
  } finally {
    await browser.close();
    rmSync(evRoot, { recursive: true, force: true });
  }
}
for (const l of lines) console.log(l);
console.log(`ok: crawl-mustfail.test.mjs (${rows.length + roadmapRows.length + noMainRows.length + drillRows.length + partCRows.length + evRows.length} fake page loads, ${htmlCases} real-Chromium .html redaction cases, ${flightCases} real-Chromium flight/URL redaction cases)`);
