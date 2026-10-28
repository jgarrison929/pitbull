#!/usr/bin/env node
// Must-fail test for 5.0.4-e check 6 (e6.mjs), spec PR #89 (main 9497f7e9). A fake 24-118 job page on 127.0.0.1 with
// one sandbox, role sign-in, Reset demo, a ConfirmDialog approve that posts a Next-Action write, and the AC card. The
// real runE6 drives it in Chromium and evaluateE6 judges it: the correct page must PASS and every mutant must FAIL
// for its own reason. No app, no staging, no production.
// Run: node .cursor/skills/verify-v5/e6-mustfail.test.mjs
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.PV_SKILL_DIR ? path.resolve(process.env.PV_SKILL_DIR) : here;
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");
const { runE6, evaluateE6, sinceLockText, usdCents } = await import(pathToFileURL(path.join(dir, "e6.mjs")).href);
const { runJourney504, evaluateJourney504 } = await import(pathToFileURL(path.join(dir, "journey504.mjs")).href);

assert.equal(usdCents(124050), "$1,240.50");
assert.equal(usdCents(5), "$0.05");
assert.equal(sinceLockText(124050), "+$1,240.50 posted since Period 1 lock");

// The approved report's cost is split over two cost codes, so the check must sum approval-pending data-cents.
const PENDING = { "03-210": 100000, "05-120": 24050 };
const SEED = { actual: 307935328, eac: 912345678, cpi: "0.94", since: 0 };
let mode = "good";
let s;
const reset = () => { s = { ...SEED, approved: false, pending: { ...PENDING }, posts: 0 }; };
reset();
const money = (c) => `<span data-cents="${c}">${usdCents(c)}</span>`;
// Like CostTable: the desktop cost-tree-scroll sits in a md:block wrapper and its virtualized rows mount only when it has
// a box (≥ 768 px); at 390 only cost-tree-scroll-mobile renders rows. So approval-pending-* is in cost-tree-scroll only
// on a wide layout, which is why the super-approve journey reads 24-118 at 1280×800 (spec #93 line 392).
const page = (role, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{font-size:16px}.desk{display:none}@media (min-width:768px){.desk{display:block}.phone{display:none}}</style></head><body>
<header><details><summary data-testid="user-menu">${role}</summary><button onclick="fetch('/app',{method:'POST',headers:{'next-action':'reset'}}).then(()=>location.href='/app?reset=1')">Reset demo</button></details></header><main>${body}</main></body></html>`;
function jobPage(role) {
  const since = s.since;
  const show = role !== "foreman" && (since > 0 || (mode === "zero-shown")) || (mode === "foreman-sees" && role === "foreman" && since > 0);
  const text = mode === "bad-text" ? `+${usdCents(since)} since lock` : mode === "no-period" ? `+${usdCents(since)} posted since lock` : `+${usdCents(since)} posted since Period 1 lock`;
  const line = show && !(mode === "missing" && s.approved) ? `<span data-testid="job-ac-since-lock" data-cents="${since}">${text}</span>` : "";
  const pending = Object.entries(s.pending).map(([code, c]) => `<div data-testid="approval-pending-${code}" data-cents="${c}">+1 CY · ${money(c)} pending</div>`).join("");
  const card = `<article data-testid="plan-card" data-plan-id="77" id="plan-77" data-status="${s.approved ? "approved" : "reported"}"><h3>${"Interchange Crew 1"}</h3>${s.approved ? "" : `<button data-testid="approve-report" data-role="superintendent" onclick="document.getElementById('dlg').style.display='block'">Approve report</button>`}</article>
<div id="dlg" role="alertdialog" aria-label="Approve report?" style="display:none"><button data-testid="confirm-dialog-confirm" onclick="document.getElementById('dlg').style.display='none';fetch('/app/jobs/24-118',{method:'POST',headers:{'next-action':'approve'}}).then((r)=>{if(r.ok)document.querySelector('[data-plan-id=\\'77\\']').setAttribute('data-status','approved')})">Approve</button><button data-testid="confirm-dialog-cancel">Cancel</button></div>`;
  return page(role, `<h1>I-405 Interchange</h1>
<div data-card data-testid="job-actual"><div>Actual cost (AC)</div>${money(s.actual)}<div>vs $2.9M earned ${line ? `· ${line}` : ""}</div></div>
<div data-card><div>EAC</div><span data-testid="job-eac" data-cents="${s.eac}">${usdCents(s.eac)}</span></div>
${role === "foreman" ? "" : `<div data-card>CPI <span data-testid="job-cpi-index">${s.cpi}</span></div>`}
<div class="desk"><div data-testid="cost-tree-scroll"></div></div><div class="phone"><div data-testid="cost-tree-scroll-mobile"></div></div>
<template id="pend">${pending}</template><script>document.querySelector(innerWidth >= 768 ? '[data-testid="cost-tree-scroll"]' : '[data-testid="cost-tree-scroll-mobile"]').innerHTML = document.getElementById("pend").innerHTML;</script>
${card}<a href="/app">Today</a>`);
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const role = /(?:^|;\s*)role=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ?? "pm";
  const html = (b) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(b); };
  if (req.method === "POST" && url.pathname === "/app") { reset(); res.writeHead(200); res.end("ok"); return; }
  if (req.method === "POST" && url.pathname === "/app/jobs/24-118") {
    s.posts++;
    const cost = Object.values(s.pending).reduce((a, b) => a + b, 0);
    s.approved = true;
    s.pending = {};
    s.since += cost + (mode === "wrong-amount" ? 100 : 0);
    if (mode === "actual-moves") s.actual += cost;
    if (mode === "cpi-moves") s.cpi = "0.95";
    if (mode === "eac-moves") s.eac += cost;
    // A streamed Server Action answer: the status now, the body a moment later.
    res.writeHead(200, { "content-type": "text/x-component" });
    res.write('0:{"a":"$@1"}\n');
    setTimeout(() => res.end('1:"ok"\n'), 300);
    return;
  }
  if (url.pathname === "/signin") { res.writeHead(302, { "set-cookie": `role=${url.searchParams.get("role")}; Path=/`, location: "/app" }); res.end(); return; }
  if (url.pathname === "/login") return html(page("guest", ["executive", "pm", "superintendent", "foreman"].map((r) => `<button data-testid="role-${r}" onclick="location.href='/signin?role=${r}'">${r}</button>`).join("")));
  if (url.pathname === "/app") return html(page(role, `<h1>Today</h1>${role === "superintendent" && !s.approved ? `<a data-testid="next-step" data-role="superintendent" href="/app/jobs/24-118#plan-77">Approve Interchange Crew 1's report on 24-118</a>` : ""}`));
  if (url.pathname === "/app/jobs/24-118") return html(jobPage(role));
  res.writeHead(404); res.end("nf");
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const lines = [];
let n = 0;
const runMode = async (m) => { mode = m; reset(); const o = await runE6(browser, base); return { o, f: evaluateE6(o) }; };
try {
  {
    const { o, f } = await runMode("good");
    assert.deepEqual(f, [], `e-6 control must PASS; got ${JSON.stringify(f)} (${o.error ?? ""})`);
    assert.equal(o.after.pm.since.cents, 124050, "the control's line equals the summed approval-pending cost");
    assert.equal(o.approve.writes?.[0]?.status, 200, "the approve went through confirmIfDialog's write watch (S10)");
    lines.push(`passes: e-6 control (approve via ConfirmDialog, 1 write HTTP 200, since-lock 0 → 124050¢ = 100000 + 24050 pending, "${o.after.pm.since.text}" for superintendent, PM and executive; AC, CPI, EAC unchanged; foreman count 0)`); n++;
  }
  for (const [m, re, title] of [
    ["missing", /superintendent after approval: job-ac-since-lock missing/, "line missing after the approval"],
    ["wrong-amount", /job-ac-since-lock data-cents 124150 \(want 0 \+ 124050 = 124050¢\)/, "data-cents rises by the wrong amount (+1¢ … +$1.00 off)"],
    ["bad-text", /reads "\+\$1,240\.50 since lock" \(want "\+\$1,240\.50 posted since Period 1 lock"\)/, "text format wrong"],
    ["no-period", /reads "\+\$1,240\.50 posted since lock" \(want "\+\$1,240\.50 posted since Period 1 lock"\)/, "Period N missing from the text"],
    ["actual-moves", /pm: job-actual 307935328¢ → 308059378¢/, "job-actual changes"],
    ["cpi-moves", /pm: job-cpi-index "0\.94" → "0\.95"/, "job-cpi-index changes"],
    ["eac-moves", /pm: job-eac 912345678¢ → 912469728¢/, "job-eac changes"],
    ["foreman-sees", /foreman: job-ac-since-lock count 1/, "line shown to the foreman"],
    ["zero-shown", /before, pm: job-ac-since-lock is rendered with data-cents "0"/, "line shown at $0"],
  ]) {
    const { f } = await runMode(m);
    assert.ok(f.some((x) => re.test(x)), `e-6 ${title} must FAIL with ${re}; got ${JSON.stringify(f)}`);
    lines.push(`FAILS as required: e-6 ${title} → ${f.find((x) => re.test(x))}`); n++;
  }
  // Review round 2, fix 1: the super-approve journey on a correct app passes at 390×844 and at 1280×800. At 390 its
  // 24-118 readings are taken at 1280×800 (readE6AtDesktop) and the journey goes back to 390 for the rest.
  for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    mode = "good"; reset();
    const r = await runJourney504(browser, base, "super-approve", size);
    const f = evaluateJourney504(r);
    assert.deepEqual(f, [], `super-approve journey @${size.width}x${size.height} on a correct app must PASS; got ${JSON.stringify(f)}`);
    assert.deepEqual(r.doneState.before.readAt, { width: 1280, height: 800 }, "before read at 1280×800");
    assert.deepEqual(r.doneState.after.readAt, { width: 1280, height: 800 }, "after read at 1280×800");
    assert.equal(r.doneState.before.pending.count, 2, "both approval-pending rows read from the desktop cost-tree-scroll");
    lines.push(`passes: super-approve journey @${size.width}x${size.height} (24-118 read at 1280×800: ${r.doneState.before.pending.count} approval-pending rows, since-lock "${r.doneState.after.since.text}"; ${r.posts} post)`); n++;
  }
  {
    // The same journey on an app whose approve leaves since-lock unchanged still FAILS at 390.
    mode = "missing"; reset();
    const f = evaluateJourney504(await runJourney504(browser, base, "super-approve", { width: 390, height: 844 }));
    assert.ok(f.some((x) => /@390x844: done state: superintendent after approval: job-ac-since-lock missing/.test(x)), `super-approve @390 with no since-lock line must FAIL; got ${JSON.stringify(f)}`);
    lines.push(`FAILS as required: super-approve journey @390x844, since-lock never appears → ${f.find((x) => /job-ac-since-lock missing/.test(x))}`); n++;
  }
  // Pure-rule must-fails the page can't easily produce.
  const good = (await runMode("good")).o;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const g1 = clone(good); g1.before.superintendent.pending = { count: 0, cents: [], codes: [] };
  assert.ok(evaluateE6(g1).some((x) => /no \[data-testid\^="approval-pending-"\]/.test(x))); lines.push("FAILS as required: e-6 no approval-pending cost before the approval (cost unreadable, never assumed)"); n++;
  const g2 = clone(good); g2.after.executive.since.visible = false;
  assert.ok(evaluateE6(g2).some((x) => /executive after approval: job-ac-since-lock is not visible/.test(x))); lines.push("FAILS as required: e-6 line present but hidden for the executive"); n++;
  const g4 = clone(good); g4.after.pm.since.text = g4.after.pm.since.text.replace("Period 1", "Period 2");
  assert.ok(evaluateE6(g4).some((x) => /pm after approval: job-ac-since-lock reads ".*Period 2 lock" \(want ".*Period 1 lock"\)/.test(x))); lines.push("FAILS as required: e-6 wrong period (Period 2; 24-118's latest lock after reset is Period 1)"); n++;
  const g3 = clone(good); g3.error = "boom"; g3.steps = ["pm before"];
  assert.ok(evaluateE6(g3).some((x) => /boom/.test(x))); lines.push("FAILS as required: e-6 drive error"); n++;
} finally {
  await browser.close();
  server.close();
}
console.log(lines.join("\n"));
console.log(`e6-mustfail: ${n} cases OK`);
