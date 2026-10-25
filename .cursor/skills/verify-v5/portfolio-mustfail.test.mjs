#!/usr/bin/env node
// Must-fail test for "portfolio loads from Postgres": serves fake portfolio pages on localhost and runs
// runPortfolioStep, the exact function verify.mjs calls for this step (user menu → sandbox id →
// Escape → settled wait on the visible portfolio-table job-link rows → CPI, dev footer). Rows that
// arrive late and then hold must PASS; a portfolio that never settles at exactly the seeded count
// (0, fewer, more, hidden, too late, 0→4→5, 0→4→0) must FAIL after the bounded wait.
// Run: node .cursor/skills/verify-v5/portfolio-mustfail.test.mjs  (Playwright from v5/node_modules)
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PORTFOLIO_SETTLE_MS, runPortfolioStep } from "./portfolio.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");

const SEED = ["24-118", "25-031", "24-077", "26-010"];
const EXTRA = ["99-010", "99-011"];
const jobs = (n) => [...SEED, ...EXTRA].slice(0, n);
const rowsHtml = (list, style = "") => list.map((j) => `<tr><td><a data-testid="job-link" href="/app/jobs/${j}" style="${style}">${j}</a></td></tr>`).join("");
// `schedule` is [[atMs, rowCount], ...]: the table body is rewritten to that many rows at each time,
// like a client fetch finishing late (or re-rendering). [[0, n]] renders n rows in the HTML.
const portfolio = (schedule, style = "") => {
  const initial = schedule[0][0] === 0 ? schedule[0][1] : 0;
  const later = schedule.filter(([at]) => at > 0).map(([at, n]) => `setTimeout(() => { b.innerHTML = ${JSON.stringify(rowsHtml(jobs(n), style))}; }, ${at});`).join("\n");
  return `<!doctype html><html><body>
<button data-testid="user-menu" onclick="document.getElementById('menu').hidden = false">Marcus Lee</button>
<div id="menu" hidden><span data-testid="sandbox-id">fake0001</span></div>
<script>addEventListener("keydown", (e) => { if (e.key === "Escape") document.getElementById("menu").hidden = true; });</script>
<main><p data-testid="kpi-cpi">0.93−$3.1M</p><table data-testid="portfolio-table"><tbody id="b">${rowsHtml(jobs(initial), style)}</tbody></table></main>
<script>const b = document.getElementById("b");\n${later}</script>
</body></html>`;
};
const PAGES = {
  "/now": portfolio([[0, 4]]),
  "/late": portfolio([[0, 0], [1500, 4]]), // the #701 race: 0 rows at first, all 4 a moment later
  "/none": portfolio([[0, 0]]),
  "/three": portfolio([[0, 3]]),
  "/three-late": portfolio([[0, 0], [800, 3]]),
  "/five": portfolio([[0, 5]]),
  "/hidden": portfolio([[0, 4]], "display:none"),
  "/too-late": portfolio([[0, 0], [5000, 4]]), // later than the test's 3 s bound
  "/up-to-five": portfolio([[0, 0], [500, 4], [800, 5]]), // passes through 4, settles at 5
  "/vanish": portfolio([[0, 0], [500, 4], [600, 0]]), // 4 rows flash, then none
};
const server = http.createServer((req, res) => {
  const body = PAGES[req.url.split("?")[0]];
  res.writeHead(body ? 200 : 404, { "content-type": "text/html; charset=utf-8" });
  res.end(body ?? "no");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

// verify.mjs uses the 10 s default timeout; 3 s here keeps the test quick. Settle stays the default.
const TIMEOUT = 3000;
const browser = await chromium.launch();
const lines = [];
try {
  const page = await browser.newPage();
  const run = async (p) => {
    await page.goto(`${base}${p}`);
    const immediate = await page.getByTestId("portfolio-table").getByTestId("job-link").filter({ visible: true }).count(); // what the old check counted
    const t0 = Date.now();
    const r = await runPortfolioStep(page, { expected: SEED.length, seedJobNumbers: SEED, textTimeoutMs: 5000, timeoutMs: TIMEOUT });
    return { ...r, immediate, ms: Date.now() - t0 };
  };

  // Transient counts first (review of 3a651d68): passing through 4 on the way to 5 or back to 0 is not settling at 4.
  for (const [p, want] of [["/up-to-five", 5], ["/vanish", 0]]) {
    const r = await run(p);
    assert.equal(r.ok, false, `${p} must fail; got ${JSON.stringify(r)}`);
    assert.equal(r.rows, want, `${p} must report its real final count ${want}; got ${r.rows}`);
    lines.push(`FAILS as expected: ${p} → ${r.detail} after the ${r.waitedMs} ms bounded wait`);
  }
  for (const p of ["/now", "/late"]) {
    const r = await run(p);
    assert.ok(r.ok && r.settled && r.sandbox === "fake0001", `${p} must pass; got ${JSON.stringify(r)}`);
    assert.ok(r.waitedMs >= PORTFOLIO_SETTLE_MS, `${p} must hold 4 rows for the ${PORTFOLIO_SETTLE_MS} ms settle window (waited ${r.waitedMs} ms)`);
    lines.push(`passes: ${p} → ${r.detail} after ${r.waitedMs} ms (immediate count was ${r.immediate})`);
  }
  {
    // Reproduce the flake: on /late the old immediate count is 0 and would have failed.
    const r = await run("/late");
    assert.equal(r.immediate, 0, "the old immediate count on /late must be 0 (reproduces #701)");
    assert.ok(r.ok && r.waitedMs >= 1000 + PORTFOLIO_SETTLE_MS, `waiting must recover the late rows; got ${JSON.stringify(r)}`);
    lines.push(`reproduced #701: /late immediate count ${r.immediate} (old check FAILS), waited ${r.waitedMs} ms → ${r.rows} settled (PASS)`);
  }
  for (const [p, want] of [["/none", 0], ["/three", 3], ["/three-late", 3], ["/five", 5], ["/hidden", 0], ["/too-late", 0]]) {
    const r = await run(p);
    assert.equal(r.ok, false, `${p} must fail; got ${JSON.stringify(r)}`);
    assert.equal(r.rows, want, `${p} must report its real final count ${want}; got ${r.rows}`);
    assert.ok(r.waitedMs >= TIMEOUT - 50, `${p} must use the full bounded wait before failing (waited ${r.waitedMs} ms)`);
    lines.push(`FAILS as expected: ${p} → ${r.detail} after the ${r.waitedMs} ms bounded wait`);
  }
} finally {
  await browser.close();
  server.close();
}
for (const l of lines) console.log(l);
console.log(`ok: portfolio-mustfail.test.mjs (${lines.length} cases)`);
