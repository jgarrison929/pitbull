#!/usr/bin/env node
// Must-fail test for "sandbox reset median ≤ 1.5 s" in real Chromium: serves fake /app pages on
// localhost whose Reset demo form POSTs, waits, and redirects to /app?reset=1, then runs
// runResetTimeStep (the function verify.mjs calls) over them. READY = new seeded-at + <main> with the
// seeded job rows; the idle-inclusive time is information only.
// Run: node .cursor/skills/verify-v5/reset-mustfail.test.mjs  (Playwright from v5/node_modules)
import assert from "node:assert/strict";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runResetTimeStep } from "./reset-time.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");

// variant → { delay: server ms before the redirect, stale: seeded-at never changes, main: render <main>
// after reset, rows: job rows after reset, rowsLateMs: rows appear this long after load, chatterMs:
// keep fetching /ping this long after load (network never quiet sooner), noRedirect / redirectTo: where
// the reset lands }
const VARIANTS = {
  good: { delay: 300 },
  slow: { delay: 1700 },
  stale: { delay: 200, stale: true },
  nomain: { delay: 200, main: false },
  norows: { delay: 200, rows: 0 },
  "late-rows": { delay: 200, rowsLateMs: 1600 },
  chatty: { delay: 300, chatterMs: 2000 },
  "chatty-forever": { delay: 300, chatterMs: 8000 }, // idle never quiet within the 3 s cap → "capped", still passes
  "five-rows": { delay: 200, rows: 5 },
  "no-redirect": { delay: 200, noRedirect: true }, // POST answers 200 with the new page at /reset, never /app?reset=1
  "wrong-path": { delay: 200, redirectTo: "other" }, // redirects to <base>/other?reset=1 with the new page
  // The new page renders at /reset (a whole check reads it: seeded-at new, main, 4 rows, wrong URL), then
  // 300 ms later seeded-at is detached and the URL becomes /app?reset=1: every later check's read throws,
  // so it must never become ready by mixing the earlier check's DOM values with the new URL.
  "url-on-failed-read": { delay: 200, noRedirect: true, detachThenUrlMs: 300 },
};
const seeded = Object.fromEntries(Object.keys(VARIANTS).map((v) => [v, 0]));
const resets = Object.fromEntries(Object.keys(VARIANTS).map((v) => [v, 0]));
const rowsHtml = (n) => Array.from({ length: n }, (_, i) => `<a data-testid="job-link" href="#">2${i}-0${i}</a>`).join("");
const page = (v, afterReset) => {
  // afterReset pages render the reseeded content wherever they are served (/app?reset=1, /reset, /other).
  const c = VARIANTS[v];
  const rows = afterReset ? (c.rows ?? 4) : 4;
  const body = `<h1>Portfolio</h1><div data-testid="portfolio-table" id="t">${c.rowsLateMs && afterReset ? "" : rowsHtml(rows)}</div>`;
  const late = c.rowsLateMs && afterReset ? `<script>setTimeout(() => { document.getElementById("t").innerHTML = ${JSON.stringify(rowsHtml(4))}; }, ${c.rowsLateMs})</script>` : "";
  const chatter = c.chatterMs && afterReset ? `<script>const end = Date.now() + ${c.chatterMs}; (async () => { while (Date.now() < end) { await fetch("/ping"); await new Promise((r) => setTimeout(r, 100)); } })();</script>` : "";
  const detach = c.detachThenUrlMs && afterReset
    ? `<script>setTimeout(() => { document.querySelector('[data-testid="seeded-at"]').remove(); history.replaceState(null, "", location.pathname.replace(/reset$/, "app") + "?reset=1"); }, ${c.detachThenUrlMs})</script>`
    : "";
  const content = afterReset && c.main === false ? `<div>${body}</div>` : `<main>${body}</main>`;
  return `<!doctype html><html><body>
<button data-testid="user-menu">Marcus</button>
<time data-testid="seeded-at" datetime="seed-${seeded[v]}">seeded</time>
<form method="post" action="/v/${v}/reset"><button type="submit">Reset demo</button></form>
${content}${late}${chatter}${detach}</body></html>`;
};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/ping") return setTimeout(() => res.end("ok"), 50);
  const m = /^\/v\/([^/]+)\/(app|reset|other)$/.exec(u.pathname);
  const v = m?.[1];
  if (!m || !VARIANTS[v]) {
    res.writeHead(404);
    return res.end("no");
  }
  if (m[2] === "reset") {
    return setTimeout(() => {
      resets[v] += 1;
      if (!VARIANTS[v].stale) seeded[v] += 1;
      if (VARIANTS[v].noRedirect) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(page(v, true));
      }
      res.writeHead(303, { location: `/v/${v}/${VARIANTS[v].redirectTo ?? "app"}?reset=1` });
      res.end();
    }, VARIANTS[v].delay);
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page(v, u.searchParams.get("reset") === "1"));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const TIMEOUT = 3000; // verify.mjs uses the 20 s default; shorter here so the never-ready cases stay quick
const browser = await chromium.launch();
const lines = [];
const out = {};
try {
  for (const v of Object.keys(VARIANTS)) {
    const p = await browser.newPage();
    out[v] = await runResetTimeStep(p, `${origin}/v/${v}`, { expectedRows: 4, timeoutMs: TIMEOUT });
    await p.close();
  }
} finally {
  await browser.close();
  server.close();
}
const show = (v) => `${v}: ${out[v].detail}`;
assert.ok(out.good.ok && out.good.median < 1000, show("good"));
lines.push(`passes: ${show("good")}`);
assert.ok(out.chatty.ok && out.chatty.median < 1000 && out.chatty.idleMedian > 2000, `idle is info only: ${show("chatty")}`);
lines.push(`passes (idle info only): ${show("chatty")}`);
assert.ok(out["chatty-forever"].ok && out["chatty-forever"].idleValues.every((x) => x === "capped"), `idle capped and info only: ${show("chatty-forever")}`);
lines.push(`passes (idle capped, info only): ${show("chatty-forever")}`);
for (const [v, re] of [
  ["slow", /median \d+ ms > 1500 ms budget/],
  ["stale", /reset 1 failed: reset not ready after 3000 ms \(url \/v\/stale\/app\?reset=1, seeded-at unchanged, main visible, 4\/4 job rows\)/],
  ["nomain", /reset 1 failed: reset not ready after 3000 ms \(url \/v\/nomain\/app\?reset=1, seeded-at new, main missing, 0\/4 job rows\)/],
  ["norows", /reset 1 failed: reset not ready after 3000 ms \(url \/v\/norows\/app\?reset=1, seeded-at new, main visible, 0\/4 job rows\)/],
  ["late-rows", /median 1[6-9]\d\d ms > 1500 ms budget/],
  ["five-rows", /reset 1 failed: reset not ready after 3000 ms \(url \/v\/five-rows\/app\?reset=1, seeded-at new, main visible, 5\/4 job rows\)/],
  ["no-redirect", /reset 1 failed: reset not ready after 3000 ms \(url \/v\/no-redirect\/reset, seeded-at new, main visible, 4\/4 job rows\)/],
  ["url-on-failed-read", /reset 1 failed: reset not ready after 3000 ms \(url \/v\/url-on-failed-read\/app\?reset=1, page read failed: /],
  ["wrong-path", /reset 1 failed: reset not ready after 3000 ms \(url \/v\/wrong-path\/other\?reset=1, seeded-at new, main visible, 4\/4 job rows\)/],
]) {
  assert.equal(out[v].ok, false, `${v} must fail: ${show(v)}`);
  assert.ok(out[v].failures.some((f) => re.test(f)), `${v} must fail with ${re}: ${JSON.stringify(out[v].failures)}`);
  lines.push(`FAILS as expected: ${show(v)}`);
}
assert.equal(resets.stale, 5, "the stale page was really reset 5 times");
for (const l of lines) console.log(l);
console.log(`ok: reset-mustfail.test.mjs (${lines.length} cases)`);
