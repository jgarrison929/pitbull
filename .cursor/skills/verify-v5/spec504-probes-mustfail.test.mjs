// Browser must-fails for the #78/#80 in-page probes: c-1 (crawl measureDom + evaluateFigures, #80 name elements), c-1n hooks, c-7 tabular/Range, a-2
// firstTarget (incl. job-status), d-1 requiredFields (the #78 table), and the journey scroll/dead-end probes.
// Each probe runs in Chromium on local fixture HTML and goes through the same evaluator verify uses.
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { crawl } from "./crawl.mjs";
import { evaluateFigures, FIGURE_EXCEPTIONS } from "./checks.mjs";
import { D1_TABLE, evaluateNameHooks, evaluateFirstTarget, evaluateRequiredFields, evaluateTabular, PROBES } from "./spec504.mjs";
import { DEAD_END, SCROLL_NEED } from "./journey504.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(here, "../../../v5/package.json"))("@playwright/test");
const doc = (b) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font:16px sans-serif}</style></head><body>${b}</body></html>`;
const card = (text) => `<main><section data-card><span data-figure="primary" data-cents="100">$1.00</span><p>${text}</p></section></main>`;
const C1 = {
  "/app/c1-ok": card("Tue, Oct 27 · 24-077 · 02 Earthwork · CO-001 on 25-031 · Oct 2026 · 2026-10-27 11:08 UTC · Tuesday, Oct 27, 2026, 4:08 AM"),
  "/app/c1-crew": card("Bridge Crew 2 on 25-031"),
  "/app/c1-i5": card("I-5 Culvert"),
  "/app/c1-qty": card("12 CY placed"),
  "/app/c1-time": card("<time>14 days</time> ago"),
  "/app/c1-rollup-lower": card("02 earthwork"),
  "/app/c1-names": card('<span data-testid="crew-name">Bridge Crew 2</span> on 25-031 · <span data-testid="job-name">I-5 Culverts</span> · <span data-testid="job-strip-label">I-5 · 24-077</span> · <span data-testid="company-name">Summit 99 Builders</span>'),
  "/app/c1-job-link": card('<a data-testid="job-link" href="/app/jobs/24-077">I-5 Culverts</a>'),
  "/app/c1-plan-link": card('<a data-testid="cost-entry-plan-link" href="/p">Bridge Crew 2</a>'),
  "/app/c1-contents-qty": card('<span style="display:contents">12 CY placed</span>'),
  "/app/c1-contents-name": card('<a data-testid="cost-entry-plan-link" href="/p"><span data-testid="crew-name" style="display:contents">Bridge Crew 2</span></a>'),
  "/app/c1-qty-by-name": card('<span data-testid="crew-name">Bridge Crew 2</span> placed 12 CY'),
};
const server = http.createServer((req, res) => {
  const p = new URL(req.url, "http://127.0.0.1").pathname;
  if (p === "/login") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(doc(["executive", "pm", "superintendent", "foreman"].map((r) => `<button data-testid="role-${r}" onclick="location.href='/app'">${r}</button>`).join(""))); }
  if (p === "/app") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(doc("<main><h1>Home</h1></main>")); }
  if (C1[p]) { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(doc(C1[p])); }
  res.writeHead(404); res.end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const lines = [];
const ok = (name, f) => { assert.deepEqual(f, [], `${name} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${name}`); };
const bad = (name, f, re) => { assert.ok(f.some((x) => re.test(x)), `${name} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as expected: ${name} → ${f.find((x) => re.test(x))}`); };
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const probe = async (html, name, arg) => { await page.setContent(doc(html)); return page.evaluate(PROBES[name], arg); };
const R = (data, o = {}) => ({ role: "pm", width: 1440, height: 900, theme: "light", path: "/x", data, ...o });
try {
  // c-1
  const rows = await crawl(browser, base, { pages: Object.keys(C1), roles: ["pm"], widths: [390], phoneChecks: true });
  const fig = (p) => evaluateFigures(rows.find((r) => r.path === p));
  ok("c-1 every #78 exception deleted (dates, job/leaf code, roll-up code + name, CO number)", fig("/app/c1-ok"));
  bad("c-1 crew number", fig("/app/c1-crew"), /number outside data-figure: "Bridge Crew 2 on 25-031"/);
  bad("c-1 I-5 in a job name", fig("/app/c1-i5"), /number outside data-figure: "I-5 Culvert"/);
  bad("c-1 quantity 12 CY", fig("/app/c1-qty"), /"12 CY placed"/);
  bad("c-1 <time> is not exempt", fig("/app/c1-time"), /"14 days"/);
  bad("c-1 roll-up code needs a capitalized name", fig("/app/c1-rollup-lower"), /"02 earthwork"/);
  ok("c-1 #80 name elements dropped (crew-name, job-name, job-strip-label, company-name)", fig("/app/c1-names"));
  bad("c-1 job-link is not a name element", fig("/app/c1-job-link"), /number outside data-figure: "I-5 Culverts"/);
  bad("c-1 cost-entry-plan-link is not a name element", fig("/app/c1-plan-link"), /number outside data-figure: "Bridge Crew 2"/);
  bad("c-1 a number inside display:contents still counts", fig("/app/c1-contents-qty"), /number outside data-figure: "12 CY placed"/);
  ok("c-1 #81 crew-name as display:contents inside the plan link is dropped", fig("/app/c1-contents-name"));
  bad("c-1 quantity next to a name still fails", fig("/app/c1-qty-by-name"), /number outside data-figure: "placed 12 CY"/);
  // c-1n: the #80 hooks the build adds (job-name, crew-name) FAIL as "hook missing", never skip
  const portfolio = (inner) => `<main><div data-card><a data-testid="job-link" href="/app/jobs/24-077">${inner}<span data-figure="primary">$1.2M</span></a></div></main>`;
  const exec = { role: "executive", path: "/app", width: 390, height: 844 };
  ok("c-1n job-name on the portfolio card", evaluateNameHooks(R(await probe(portfolio('<div data-testid="job-name">I-5 Culverts</div>'), "nameHooks"), exec)));
  bad("c-1n rc portfolio card without job-name", evaluateNameHooks(R(await probe(portfolio("<div>I-5 Culverts</div>"), "nameHooks"), exec)), /c-1: hook missing: job-name in portfolio card "I-5 Culverts/);
  bad("c-1n executive with no portfolio card", evaluateNameHooks(R(await probe("<main><h1>Home</h1></main>", "nameHooks"), exec)), /no portfolio phone card/);
  const ci = { path: "/app/jobs/24-077/cost-items/07-300", width: 390, height: 844 };
  ok("c-1n crew-name inside cost-entry-plan-link", evaluateNameHooks(R(await probe('<main><a data-testid="cost-entry-plan-link" href="/p"><span data-testid="crew-name">Bridge Crew 2</span></a><a data-testid="cost-entry-plan-link" href="/q">Daily report</a></main>', "nameHooks"), ci)));
  ok("c-1n crew-name as display:contents inside the plan link (#81 markup)", evaluateNameHooks(R(await probe('<main><a data-testid="cost-entry-plan-link" href="/p" style="display:inline-flex;min-height:44px"><span data-testid="crew-name" style="display:contents">Bridge Crew 2</span></a></main>', "nameHooks"), ci)));
  bad("c-1n hidden crew-name does not count", evaluateNameHooks(R(await probe('<main><div style="display:none"><span data-testid="crew-name" style="display:contents">Bridge Crew 2</span></div></main>', "nameHooks"), ci)), /hook missing: no visible crew-name/);
  ok("c-1n crew-name on the plain span", evaluateNameHooks(R(await probe('<main><span data-testid="crew-name">Bridge Crew 2</span></main>', "nameHooks"), ci)));
  bad("c-1n rc plan link without crew-name", evaluateNameHooks(R(await probe('<main><a data-testid="cost-entry-plan-link" href="/p">Bridge Crew 2</a></main>', "nameHooks"), ci)), /hook missing: crew-name absent from cost-entry-plan-link "Bridge Crew 2"/);
  bad("c-1n crew-name holds more than the crew name", evaluateNameHooks(R(await probe('<main><a data-testid="cost-entry-plan-link" href="/p"><span data-testid="crew-name">Bridge Crew</span> 2</a></main>', "nameHooks"), ci)), /crew-name "Bridge Crew" is not the whole text of cost-entry-plan-link "Bridge Crew 2"/);
  bad("c-1n rc plain span without crew-name", evaluateNameHooks(R(await probe("<main><span>Bridge Crew 2</span></main>", "nameHooks"), ci)), /hook missing: no visible crew-name on the 07-300 cost entries/);
  // c-7
  const EXC = FIGURE_EXCEPTIONS.map((r) => r.source);
  const tab = (td, extra = "") => `<main><section data-card><span data-figure="primary" style="font-variant-numeric:tabular-nums">$1.2M</span></section><table><tr><td>Concrete</td>${td}</tr></table>${extra}</main>`;
  ok("c-7 tabular, right-aligned cell; left MetricCard figure; label cell skipped", evaluateTabular(R(await probe(tab('<td style="text-align:right;font-variant-numeric:tabular-nums">$1,200.00</td><td>24-077 job</td>'), "tabular", EXC))));
  ok("c-7 start-aligned cell whose text ends within 2 px (Range)", evaluateTabular(R(await probe(tab('<td style="font-variant-numeric:tabular-nums;width:1px;white-space:nowrap">$1,200.00</td>'), "tabular", EXC))));
  bad("c-7 proportional numeric cell", evaluateTabular(R(await probe(tab('<td style="text-align:right">$1,200.00</td>'), "tabular", EXC))), /numeric td "\$1,200\.00".*no tabular-nums/);
  bad("c-7 left-aligned wide numeric cell", evaluateTabular(R(await probe(tab('<td style="width:300px;font-variant-numeric:tabular-nums">$1,200.00</td>'), "tabular", EXC))), /text-align "start" and its text ends \d+\.\d px/);
  bad("c-7 proportional MetricCard figure", evaluateTabular(R(await probe('<main><section data-card><span data-figure="primary">$1.2M</span></section></main>', "tabular", EXC))), /figure span\[data-figure=primary\] "\$1\.2M".*no tabular-nums/);
  bad("c-7 digit in a child span without tabular-nums", evaluateTabular(R(await probe('<main><span data-figure="primary" style="font-variant-numeric:tabular-nums">$<b style="font-variant-numeric:normal">12</b></span></main>', "tabular", EXC))), /no tabular-nums/);
  ok("c-7 a cell starting with a job number is not numeric", evaluateTabular(R(await probe(tab("<td>24-077 Culvert</td>"), "tabular", EXC))));
  bad("c-7 cost-tree-row value column", evaluateTabular(R(await probe('<main><div data-testid="cost-tree-row" style="display:grid;grid-template-columns:200px 200px"><div>07-300 Pipe</div><div style="font-variant-numeric:tabular-nums">$9.00</div></div></main>', "tabular", EXC))), /numeric div "\$9\.00".*text-align/);
  // a-2
  const vh = 900;
  const plan = (inner, id = "41") => `<div id="plan-${id}" data-testid="plan-card" data-plan-id="${id}">${inner}</div>`;
  const clicked = { label: "Submit tomorrow's plan", href: "/app/jobs/25-031#plan-41" };
  ok("a-2 superintendent submit-plan in the linked plan card", evaluateFirstTarget(R(await probe(plan('<button data-testid="submit-plan">Submit plan</button>'), "firstTarget", { role: "superintendent", href: clicked.href }), { role: "superintendent", clicked, landed: "/x" })));
  bad("a-2 submit-plan only in another plan card", evaluateFirstTarget(R(await probe(plan("") + plan('<button data-testid="submit-plan">Submit plan</button>', "99"), "firstTarget", { role: "superintendent", href: clicked.href }), { role: "superintendent", clicked, landed: "/x" })), /submit-plan in plan-card 41 not found/);
  bad("a-2 submit-plan below the fold", evaluateFirstTarget(R(await probe(`<div style="height:${vh + 200}px"></div>` + plan('<button data-testid="submit-plan">Submit plan</button>'), "firstTarget", { role: "superintendent", href: clicked.href }), { role: "superintendent", clicked, landed: "/x" })), /not inside viewport/);
  bad("a-2 PM Approve without co-approve test id (rc)", evaluateFirstTarget(R(await probe('<div id="co-CO-001" data-testid="co-card"><h3>CO-001 · Scope</h3><button>Approve</button></div>', "firstTarget", { role: "pm", href: "/app/jobs/25-031#co-CO-001" }), { role: "pm", clicked, landed: "/x" })), /co-approve in CO-001 co-card not found/);
  ok("a-2 PM co-approve", evaluateFirstTarget(R(await probe('<div id="co-CO-001" data-testid="co-card"><h3>CO-001 · Scope</h3><button data-testid="co-approve">Approve</button></div>', "firstTarget", { role: "pm", href: "/app/jobs/25-031#co-CO-001" }), { role: "pm", clicked, landed: "/x" })));
  const execDom = (status) => `<header>${status}</header><section data-card><span data-testid="job-eac">$1M</span></section><section data-card><span data-testid="job-cpi">0.9</span></section>`;
  ok("a-2 executive EAC card, CPI card, job-status", evaluateFirstTarget(R(await probe(execDom('<span data-testid="job-status" data-status="at_risk">At risk</span>'), "firstTarget", { role: "executive", href: "/app/jobs/24-077" }), { role: "executive", clicked, landed: "/x" })));
  bad("job-status missing (rc StatusPill has data-status only)", evaluateFirstTarget(R(await probe(execDom('<span data-status="at_risk">At risk</span>'), "firstTarget", { role: "executive", href: "/app/jobs/24-077" }), { role: "executive", clicked, landed: "/x" })), /job-status not found/);
  // d-1
  const rw = (qty) => `<div data-testid="plan-card"><form><input data-testid="report-mh-07-300" required>${qty}<button data-testid="report-work" type="submit">Report day's work</button></form></div>`;
  ok("d-1 report fields visible and required", evaluateRequiredFields(R(await probe(rw('<input data-testid="report-qty-07-300" required>'), "requiredFields", D1_TABLE))));
  bad("d-1 qty behind a closed details", evaluateRequiredFields(R(await probe(rw('<details><summary>Line detail</summary><input data-testid="report-qty-07-300" required></details>'), "requiredFields", D1_TABLE))), /report-qty-07-300 is inside a closed details/);
  bad("d-1 qty display:none", evaluateRequiredFields(R(await probe(rw('<input data-testid="report-qty-07-300" required style="display:none">'), "requiredFields", D1_TABLE))), /report-qty-07-300 is (display:none|zero box)/);
  bad("d-1 listed field without required", evaluateRequiredFields(R(await probe(rw('<input data-testid="report-qty-07-300">'), "requiredFields", D1_TABLE))), /report-qty-07-300 has no required attribute/);
  bad("d-1 return reason hidden", evaluateRequiredFields(R(await probe('<form><details><summary>Return</summary><textarea data-testid="return-reason" required></textarea></details><button data-testid="return-report">Return to foreman</button></form>', "requiredFields", D1_TABLE))), /return-reason is inside a closed details/);
  bad("d-1 submit text", evaluateRequiredFields(R(await probe('<form><button data-testid="submit-plan">Submit</button></form>', "requiredFields", D1_TABLE))), /reads "Submit" \(want "Submit plan"\)/);
  bad("d-1 line-form field behind details", evaluateRequiredFields(R(await probe('<form data-testid="line-form"><details><summary>More</summary><input name="hours" required></details><button type="submit">Save</button></form>', "requiredFields", D1_TABLE))), /PlanLineEditor .*required field hours is inside a closed details/);
  ok("d-1 submit hidden → form not judged", evaluateRequiredFields(R(await probe('<details><summary>x</summary><form><textarea data-testid="return-reason" required></textarea><button data-testid="return-report">Return to foreman</button></form></details>', "requiredFields", D1_TABLE))));
  // journeys
  await page.setContent(doc('<div style="height:2000px"><button id="t" style="margin-top:1500px">Go</button></div>'));
  assert.ok((await page.locator("#t").evaluate(SCROLL_NEED)) > 0, "scroll need > 0 for a control below the fold");
  await page.setContent(doc('<button id="t">Go</button>'));
  assert.equal(await page.locator("#t").evaluate(SCROLL_NEED), 0);
  lines.push("passes: journey scroll-to-action probe 0 px in view; FAILS as expected: > 0 px below the fold");
  await page.goto(`${base}/app/c1-ok`);
  const de = await page.evaluate(DEAD_END);
  assert.deepEqual([de.nextStep, de.done, de.forward], [false, false, false], "fixture without links is a dead end");
  lines.push("FAILS as expected: journey dead-end probe on a page with no next-step, forward link or -done");
} finally {
  await ctx.close();
  await browser.close();
  server.close();
}
console.log(lines.join("\n"));
console.log(`spec504-probes-mustfail: ${lines.length} cases OK`);
