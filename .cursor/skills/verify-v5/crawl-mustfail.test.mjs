#!/usr/bin/env node
// Must-fail test for the browser crawl: serves fake pages on localhost and runs the real crawl()
// (Playwright from v5/node_modules) + evaluateCrawlRow over them. Every bad page must FAIL for the
// right reason, and the good pages and the two named seeded empty states must PASS.
// Run: node .cursor/skills/verify-v5/crawl-mustfail.test.mjs
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateCrawlRow } from "./checks.mjs";
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
};
const expectPass = ["/app", "/app/jobs/good", "/app/jobs/24-077", "/app/jobs/24-118"];

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
// Part C crawl check 4 on fake active jobs: 77-001 good, 77-002 plan page slow, 77-003 no reachable plan page, 77-004 plan page 500.
const PART_C_ACTIVE = ["77-001", "77-002", "77-003", "77-004"];
const PART_C_SEED = { "77-001": ["01-ok"], "77-002": ["01-ok"], "77-003": ["01-noplan"], "77-004": ["01-ok"] };
const partCDrill = { seedItems: PART_C_SEED, plan: new Map(), records: [], partC: { active: PART_C_ACTIVE, planLinked: PART_C_SEED, records: [] } };
try {
  drillRows = await crawl(browser, base, { pages: ["/app/jobs/77-001", "/app/jobs/77-002"], roles: DRILL_ROLES, widths: DRILL_WIDTHS, drill });
  partCRows = await crawl(browser, base, { pages: PART_C_ACTIVE.map((j) => `/app/jobs/${j}`), roles: DRILL_ROLES, widths: DRILL_WIDTHS, drill: partCDrill });
  rows = await crawl(browser, base, { pages: [...expectPass, ...Object.keys(expectFail)], roles: ["pm"], widths: [390, 1280] });
  // /roadmap at every main-crawl width plus the extra 375/1440, as verify.mjs's nav crawl runs it.
  roadmapRows = await crawl(browser, base, { pages: ["/roadmap"], roles: ["pm"], widths: [...CRAWL_WIDTHS, ...ROADMAP_EXTRA_WIDTHS] });
  noMainRows = await crawl(browser, base, { pages: ["/roadmap-nomain"], roles: ["pm"], widths: [1440] });
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
for (const l of lines) console.log(l);
console.log(`ok: crawl-mustfail.test.mjs (${rows.length + roadmapRows.length + noMainRows.length + drillRows.length + partCRows.length} fake page loads)`);
