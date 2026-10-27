// Must-fails for the 5.0.4 page checks in spec504.mjs on local fixtures, through the same pagePass + evaluatePassRows
// the verify step uses: c-6/i-6 words next to color, i-1 chips, i-2 cost-item KPI cards, i-5 shell targets.
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { evaluatePassRows, pagePass, PASSES } from "./spec504.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");
const ROLES = ["executive", "pm", "superintendent", "foreman"];
let mode = "good";
const CSS = `<style>body{margin:0;font:16px/1.5 sans-serif}.text-positive{color:green}.text-caution{color:#965e01}.text-negative{color:#b00}</style>`;
const doc = (body, dark) => `<!doctype html><html class="${dark ? "dark" : ""}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${CSS}</head><body>${body}</body></html>`;
const brand = (px) => `<a href="/app" aria-label="Pitbull home" style="display:inline-grid;width:${px}px;height:${px}px">P</a><details><summary data-testid="user-menu" style="display:block;width:${px}px;height:${px}px">M</summary><button type="button" onclick="location.href='/app?reset=1'">Reset demo</button></details>`;
const chips = (wrap) => `<div style="display:flex;gap:6px;${wrap ? "flex-wrap:wrap" : "overflow-x:auto"}">${Array.from({ length: 15 }, (_, i) => `<button style="flex-shrink:0;white-space:nowrap;min-height:44px">Suggestion number ${i + 1}</button>`).join("")}</div><form><input data-testid="assistant-input" aria-label="Ask"></form>`;
const card = (id, fig) => `<section data-card style="width:280px">${fig}</section>`;
const fig = (kind, cents, text, extra = "", id = "") => `<span data-figure="${kind}"${id ? ` data-testid="${id}"` : ""} style="display:block;overflow:hidden;white-space:nowrap;${extra}"><span data-cents="${cents}" title="$${(cents / 100).toFixed(2)}">${text}</span></span>`;
const qfig = (kind, text, id = "") => `<span data-figure="${kind}"${id ? ` data-testid="${id}"` : ""} style="display:block;white-space:nowrap">${text}</span>`;
// i-2 (#80): a 07-300 row on 24-077 (desktop cost-tree-scroll row with its columns, and a virtualized phone cost-list
// row that mounts only after scrolling cost-tree-scroll-mobile) and the 7 KPI cards with the test id on the primary figure.
const money = (c) => `<span data-cents="${c}">$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>`;
const desktopRow = () => `<div data-testid="cost-tree-scroll"><div data-testid="cost-tree-row" data-code="07-300" data-cb-cents="${mode === "cb-mismatch" ? 69000001 : 69000000}"${mode === "actual-mh-missing" ? "" : ` data-actual-mh-milli="${mode === "actual-mh-mismatch" ? 398100 : 398000}"`}><div>07-300 Formwork</div><div><div>${mode === "installed-mismatch" ? "1,251" : "1,250"} / ${mode === "budgeted-mismatch" ? "2,600" : "2,500"} LF</div>${mode === "earned-mh-absent" ? "" : `<div data-testid="earned-mh-07-300">${mode === "earned-mh-mismatch" ? "412.6" : "412.5"} MH earned</div>`}</div><div>50%</div><div>${money(69000000)}</div><div>${money(mode === "ev-mismatch" ? 34500001 : 34500000)}</div><div>${money(30000000)}</div><div><span class="text-caution">0.97</span> Watch</div></div></div>`;
const phoneList = () => `<div data-testid="cost-list"><div data-testid="cost-tree-scroll-mobile" style="height:200px;overflow:auto"><div style="height:2000px" id="spacer"></div></div></div><script>(()=>{const s=document.querySelector('[data-testid="cost-tree-scroll-mobile"]');s.addEventListener("scroll",()=>{if(${mode === "phone-unmounted" ? "false" : "s.scrollTop>800"}&&!document.querySelector('[data-testid="cost-list"] [data-code="07-300"]')){const r=document.createElement("div");r.setAttribute("data-testid","cost-tree-row");r.setAttribute("data-code","07-300");r.innerHTML='<span data-figure="primary"><span data-cents="${mode === "eac-phone-mismatch" ? 72000001 : 72000000}">$720K</span></span>';s.prepend(r);}});})();</script>`;
const PAGES = {
  "/login": () => ROLES.map((r) => `<button data-testid="role-${r}" onclick="location.href='/app'">${r}</button>`).join(""),
  "/app": () => `${brand(mode === "small-shell" ? 32 : 44)}<main>${mode === "status-bare" ? '<span class="text-negative">0.93</span>' : '<div data-card><span class="text-negative">0.93</span> At risk</div>'}${chips(mode !== "chips-scroll")}</main>`,
  "/app/jobs/24-077": () => `${brand(44)}<main>${desktopRow()}${phoneList()}${mode === "row-bare" ? '<table><tr><td><span class="text-positive">1.02</span></td></tr></table>' : ""}</main>`,
  "/app/jobs/24-077/cost-items/07-300": () => {
    const cb = mode === "long-money" ? fig("primary", 69000000, "$690,000.00", "", "cost-item-cb") : fig("primary", 69000000, "$690K", "", "cost-item-cb");
    const extra = mode === "two-primary" ? fig("primary", 100, "$1.00") : mode === "three-secondary" ? fig("secondary", 1, "a") + fig("secondary", 2, "b") + fig("secondary", 3, "c") : "";
    const ev = mode === "spill" ? fig("primary", 34500000, "$345K and a very long label that cannot fit", "width:40px", "cost-item-ev") : fig("primary", 34500000, "$345K", "", "cost-item-ev");
    const totals = mode === "ac-totals-mismatch" ? 30000001 : 30000000;
    const cards = [
      card("eac", fig("primary", 72000000, "$720K", "", "cost-item-eac") + qfig("secondary", "Average performance")),
      card("cb", cb + extra),
      card("ev", ev),
      card("ac", fig("primary", 30000000, "$300K", "", "cost-item-ac") + qfig("secondary", "Through Period 3 lock")),
      card("installed", qfig("primary", "1,250 LF", "cost-item-installed") + qfig("secondary", "2,500 budgeted")),
      card("emh", qfig("primary", mode === "earned-mh-absent" ? "412.5" : "412.5", "cost-item-earned-mh")),
      card("amh", qfig("primary", "398.0", "cost-item-actual-mh")),
    ];
    return `${brand(44)}<main>${cards.join("")}<div data-testid="cost-item-forecast" data-eac-cents="72000000"></div><div data-testid="cost-item-totals" data-total-cents="${totals}"></div></main>`;
  },
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/__mode") { mode = url.searchParams.get("m"); res.writeHead(204); return res.end(); }
  const dark = /(?:^|;\s*)pcs_theme=dark(?:;|$)/.test(req.headers.cookie ?? "");
  const f = PAGES[url.pathname];
  if (!f) { res.writeHead(404); return res.end("no"); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(doc(f(), dark));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const lines = [];
const runPass = async (key, m, over = {}) => {
  await fetch(`${base}/__mode?m=${m}`);
  const pass = { ...PASSES[key], roles: ["pm"], pages: PASSES[key].pages ?? ["/app"], ...over };
  return evaluatePassRows(pass, await pagePass(browser, base, pass));
};
const ok = async (key, m, over) => { const f = await runPass(key, m, over); assert.deepEqual(f, [], `${key} ${m} must PASS; got ${JSON.stringify(f)}`); lines.push(`passes: ${key} control (${m})`); };
const bad = async (key, m, re, over) => { const f = await runPass(key, m, over); assert.ok(f.some((x) => re.test(x)), `${key} ${m} must FAIL with ${re}; got ${JSON.stringify(f)}`); lines.push(`FAILS as expected: ${key} ${m} → ${f.find((x) => re.test(x))}`); };
try {
  await ok("c-6", "good");
  await bad("c-6", "status-bare", /text-negative "0\.93" has no status word/);
  await bad("c-6", "row-bare", /text-positive "1\.02" has no status word/);
  await ok("i-6", "good");
  await bad("i-6", "row-bare", /24-077: text-positive "1\.02"/);
  await ok("i-1", "good");
  await bad("i-1", "chips-scroll", /chips past clientWidth 320/);
  await ok("i-2", "good");
  await bad("i-2", "long-money", /"\$690,000\.00" \(69000000¢ ≥ \$10,000\.00\) is not short money/);
  await bad("i-2", "two-primary", /cost-item-cb has 2 primary figures/);
  await bad("i-2", "three-secondary", /cost-item-cb has 3 secondary figures/);
  await bad("i-2", "spill", /scrollWidth \d+ > clientWidth 40/);
  await bad("i-2", "cb-mismatch", /i-2: cost-item-cb data-cents 69000000 ≠ desktop 24-077 07-300 row data-cb-cents 69000001/);
  await bad("i-2", "eac-phone-mismatch", /i-2: cost-item-eac data-cents 72000000 ≠ phone 24-077 07-300 row primary data-cents 72000001/);
  await bad("i-2", "phone-unmounted", /i-2: phone 24-077 07-300 row did not mount in cost-list at 390×844/);
  await bad("i-2", "ev-mismatch", /i-2: cost-item-ev data-cents 34500000 ≠ desktop 24-077 07-300 row column 5 data-cents 34500001/);
  await bad("i-2", "ac-totals-mismatch", /i-2: cost-item-ac data-cents 30000000 ≠ cost-item-totals data-total-cents 30000001/);
  await bad("i-2", "installed-mismatch", /i-2: cost-item-installed "1,250 LF" ≠ "1,251 LF"/);
  await bad("i-2", "budgeted-mismatch", /i-2: cost-item-installed secondary \[2,500 budgeted\] lacks "2,600 budgeted"/);
  await bad("i-2", "earned-mh-mismatch", /i-2: cost-item-earned-mh "412\.5" ≠ 412\.6/);
  await bad("i-2", "earned-mh-absent", /i-2: cost-item-earned-mh "412\.5" ≠ 0\.0 \(desktop 24-077 07-300 row has no earned-mh element: 0\.0\)/);
  await bad("i-2", "actual-mh-missing", /i-2: hook missing: data-actual-mh-milli on the desktop 24-077 07-300 row/);
  await bad("i-2", "actual-mh-mismatch", /i-2: cost-item-actual-mh "398\.0" ≠ mh\(398100\) "398\.1"/);
  await ok("i-5", "good");
  await bad("i-5", "small-shell", /brand link 32×32 < 44×44/);
} finally {
  await browser.close();
  server.close();
}
for (const l of lines) console.log(l);
console.log(`ok: spec504-mustfail.test.mjs (${lines.length} cases)`);
