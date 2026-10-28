#!/usr/bin/env node
// Must-fail test for the 5.0.4-d check 5 drive (field504.mjs issueReportApproveFlow), spec #93 (main 9d05bd8d) lines
// 363-366: "the foreman reports 12 CY, the superintendent returns it with a reason, the foreman resubmits, and the
// superintendent approves." A fake 25-031 job page and 04-210 cost item page on 127.0.0.1 with role sign-in, Reset
// demo, the report panel (report-qty/mh-04-210, report-gl-04-210, report-work), ApproveReportForm and ReturnReportForm
// (return-reason + return-report, both through a ConfirmDialog), return-reason-banner, and the Installed card's
// cost-item-qty-since-lock line. The real issueReportApproveFlow drives it in Chromium and evaluateIssueReportApprove
// judges it: the correct app must PASS and every mutant must FAIL for its own reason. No app, no staging, no production.
// Run: node .cursor/skills/verify-v5/field504-flow.mustfail.test.mjs
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.PV_SKILL_DIR ? path.resolve(process.env.PV_SKILL_DIR) : here;
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");
const { issueReportApproveFlow, evaluateIssueReportApprove } = await import(pathToFileURL(path.join(dir, "field504.mjs")).href);

let mode = "good";
let s;
const reset = () => { s = { status: "draft", reason: null, qty: "", mh: "", posted: mode === "line-before" ? 12000 : 0, posts: [] }; };
reset();
const page = (role, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{font-size:16px}</style></head><body>
<header><details><summary data-testid="user-menu">${role}</summary><button onclick="fetch('/app',{method:'POST',headers:{'next-action':'reset'}}).then(()=>location.href='/app?reset=1')">Reset demo</button></details></header><main>${body}</main>
<script>function act(a,extra){return fetch('/act',{method:'POST',headers:{'next-action':a,'content-type':'application/json'},body:JSON.stringify({a,...(extra||{})})}).then(()=>location.reload())}</script></body></html>`;
const dialog = (id, label, onconfirm) => `<div id="${id}" role="alertdialog" aria-label="${label}" style="display:none"><button data-testid="confirm-dialog-confirm" onclick="document.getElementById('${id}').style.display='none';${onconfirm}">Confirm</button><button data-testid="confirm-dialog-cancel" onclick="document.getElementById('${id}').style.display='none'">Cancel</button></div>`;
function jobPage(role) {
  const gl = `const q=+document.querySelector('[data-testid=report-qty-04-210]').value||0,m=+document.querySelector('[data-testid=report-mh-04-210]').value||0,e=q*1.6,g=e-m;document.querySelector('[data-testid=report-gl-04-210]').textContent='Earned '+e.toFixed(1)+' MH Actual '+m.toFixed(1)+' MH '+(g<0?'\\u2212':'+')+Math.abs(g).toFixed(1)+' MH'`;
  let actions = "";
  if (s.status === "draft" && role === "superintendent") actions = `<button data-testid="submit-plan" onclick="act('submit')">Submit plan</button>`;
  let report = "";
  if (s.status === "issued" && role === "foreman") report = `<div data-testid="report-panel"><input data-testid="report-mh-04-210" value="${s.mh}" oninput="${gl}"><input data-testid="report-qty-04-210" value="${s.qty}" oninput="${gl}"><p data-testid="report-gl-04-210"></p>
<button data-testid="report-work" onclick="act('report',{qty:document.querySelector('[data-testid=report-qty-04-210]').value,mh:document.querySelector('[data-testid=report-mh-04-210]').value})">Report day's work</button></div>`;
  if (s.status === "reported" && role === "superintendent") {
    report = `<div data-testid="approve-return-panel"><button data-testid="approve-report" onclick="document.getElementById('dA').style.display='block'">Approve report</button>${dialog("dA", "Approve report?", "act('approve')")}
${mode === "no-return" ? "" : `<form data-testid="return-form" onsubmit="return false"><label>Return reason <input data-testid="return-reason" required></label><button type="button" data-testid="return-report" onclick="if(!this.form.querySelector('input').value)return;document.getElementById('dR').style.display='block'">Return to foreman</button>${dialog("dR", "Return report?", "act('return',{reason:document.querySelector('[data-testid=return-reason]').value})")}</form>`}</div>`;
  }
  const banner = s.reason ? `<p data-testid="return-reason-banner">Returned: ${s.reason}</p>` : "";
  return page(role, `<h1>Cedar Creek</h1><article data-testid="plan-card" data-plan-id="41" data-plan-date="2026-10-27" data-status="${s.status}"><h3>Bridge Crew 2</h3>${actions}${banner}<ul><li data-testid="plan-line" data-code="04-210">04-210 Pier column</li></ul>${report}</article><a href="/app">Today</a>`);
}
function costItem(role) {
  const text = mode === "period-3" ? "+12 CY posted since Period 3 lock" : `+${s.posted / 1000} CY posted since Period 1 lock`;
  const line = s.posted > 0 ? `<p data-testid="cost-item-qty-since-lock" data-qty-milli="${s.posted}">${text}</p>` : "";
  return page(role, `<h1>04-210 Pier column</h1><div data-card data-testid="cost-item-installed"><p>Installed</p><p>248 CY</p><p>620 CY budgeted</p>${line}</div>`);
}
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  const role = /(?:^|;\s*)role=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ?? "pm";
  const html = (b) => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(b); };
  if (req.method === "POST" && url.pathname === "/app") { reset(); res.writeHead(200); res.end("ok"); return; }
  if (req.method === "POST" && url.pathname === "/act") {
    let body = "";
    req.on("data", (c) => { body += c; });
    req.on("end", () => {
      const b = JSON.parse(body || "{}");
      s.posts.push(b.a);
      if (b.a === "submit" && s.status === "draft") s.status = "issued";
      if (b.a === "report" && s.status === "issued") { s.status = "reported"; s.qty = b.qty; s.mh = b.mh; if (mode === "post-on-report") s.posted = 12000; }
      if (b.a === "return" && s.status === "reported" && b.reason) {
        if (mode !== "return-noop") { s.status = "issued"; s.reason = mode === "return-no-banner" ? null : b.reason; if (mode === "return-drops-values") { s.qty = ""; s.mh = ""; } }
        if (mode === "post-on-return") s.posted = 12000;
      }
      if (b.a === "approve" && s.status === "reported") { s.status = "approved"; s.posted += 12000; }
      res.writeHead(200, { "content-type": "text/x-component" });
      res.end('0:"ok"\n');
    });
    return;
  }
  if (url.pathname === "/signin") { res.writeHead(302, { "set-cookie": `role=${url.searchParams.get("role")}; Path=/`, location: "/app" }); res.end(); return; }
  if (url.pathname === "/login") return html(page("guest", ["executive", "pm", "superintendent", "foreman"].map((r) => `<button data-testid="role-${r}" onclick="location.href='/signin?role=${r}'">${r}</button>`).join("")));
  if (url.pathname === "/app") return html(page(role, "<h1>Today</h1>"));
  if (url.pathname === "/app/jobs/25-031") return html(jobPage(role));
  if (url.pathname === "/app/jobs/25-031/cost-items/04-210") return html(costItem(role));
  res.writeHead(404); res.end("nf");
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const lines = [];
let n = 0;
const runMode = async (m) => { mode = m; reset(); const o = await issueReportApproveFlow(browser, base); return { o, f: evaluateIssueReportApprove(o) }; };
try {
  {
    const { o, f } = await runMode("good");
    assert.deepEqual(f["d-3"], [], `d-3 control must PASS; got ${JSON.stringify(f["d-3"])}`);
    assert.deepEqual(f["d-5"], [], `d-5 control must PASS; got ${JSON.stringify(f["d-5"])} (${o.error ?? ""})`);
    assert.deepEqual(o.steps, ["super submit", "foreman sees", "live G/L", "report", "return", "resubmit", "approve + posted qty"]);
    lines.push(`passes: d-5 control (report → return "${o.foremanReturned?.banner}" → resubmit with kept ${o.foremanReturned?.values?.qty} CY / ${o.foremanReturned?.values?.mh} MH → approve; line count 0 before, reported, returned, resubmitted; "${o.qtyAfter?.foreman?.line?.text}" for all 4 roles)`); n++;
  }
  // The line-before, line-on-first-report and Period 3 cases are judged by the same evaluator in field504-eval.test.mjs
  // and on QTY_PROBE pages in harness-gaps S17; here only the drive-dependent cases run (CI time budget).
  for (const [m, re, title] of [
    ["post-on-return", /returned \(before the approval\): cost-item-qty-since-lock count 1/, "the +12 CY line appears while the report is returned"],
    ["return-noop", /posted state did not appear|neither the dialog nor the posted state/, "the return is ineffective (plan stays reported)"],
    ["no-return", /no return-reason on plan 41 as the superintendent/, "the return control is missing"],
    ["return-no-banner", /return-reason-banner missing \(want the reason "Recount pour 3"\)/, "the return reason is not shown to the foreman"],
    ["return-drops-values", /report values "" CY \/ "" MH/, "the return loses the foreman's values"],
  ]) {
    const { o, f } = await runMode(m);
    const d5 = f["d-5"];
    assert.ok(d5.some((x) => re.test(x)), `d-5 ${title} must FAIL with ${re}; got ${JSON.stringify(d5)} (${o.error ?? ""})`);
    lines.push(`FAILS as required: d-5 ${title} → ${d5.find((x) => re.test(x)).slice(0, 200)}`); n++;
  }
} finally {
  await browser.close();
  server.close();
}
console.log(lines.join("\n"));
console.log(`field504-flow-mustfail: ${n} cases OK`);
