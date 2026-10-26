#!/usr/bin/env node
// Must-fail test for "sandbox reset median ≤ 1.5 s" in real Chromium: serves fake /app pages on
// localhost whose Reset demo form POSTs, waits, and redirects to /app?reset=1, then runs
// runResetTimeStep (the function verify.mjs calls) over them. READY = new seeded-at + <main> with the
// seeded job rows; the idle-inclusive time is information only.
// Run: node .cursor/skills/verify-v5/reset-mustfail.test.mjs  (Playwright from v5/node_modules)
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setFailureEvidence } from "./evidence.mjs";
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
  // Fail fast with a reason (502b: the reset server action was cut off, Railway logged POST 499).
  "post-499": { delay: 200, postStatus: 499 }, // the reset POST answers 499: no redirect is coming
  "post-abort": { delay: 200, abort: true }, // the reset POST's connection is dropped with no answer
  // Lands on /app?reset=1 but renders an error screen instead of the portfolio:
  "next-error": { delay: 200, landing: "next-error" }, // Next 16's built-in app-error screen, no layout
  "app-boundary": { delay: 200, landing: "app-boundary" }, // PR #15 route boundary inside the layout: seeded-at new, <main>, 0 rows
  "app-boundary-marker": { delay: 200, landing: "app-boundary-marker" }, // same marker, reworded heading
  "no-seeded": { delay: 200, landing: "no-seeded" }, // portfolio renders but seeded-at is missing: reason must say what main showed
};
// The PR #15 fallback (v5/src/components/app/route-error-fallback.tsx) as rendered by error.tsx.
const boundaryHtml = (title = "Page load failed") => `<main data-testid="route-error"><div><span>Pitbull</span><h1>${title}</h1>
<p>This screen failed to render. Try again. If it keeps failing, open the demo login and pick a role.</p>
<button type="button">Try again</button><a href="/login">Demo login</a></div></main>`;
// Canaries for the evidence redaction checks (made up, never real secrets).
const CANARY_TOKEN = "canary-verify-token-0000-not-real";
const CANARY_COOKIE = "canarycookie0000notreal";
const CANARY_QUERY = "qtok0000canary0000notreal0000";
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
  if (afterReset && c.landing === "next-error") {
    return `<!doctype html><html><body><div><h2>This page couldn’t load</h2><p>A server error occurred. Reload to try again.</p><button>Reload</button></div>
<script>console.error("[canary] ${CANARY_TOKEN}"); fetch("/api/broken?access_token=${CANARY_QUERY}&reset=1", { headers: { Authorization: "Bearer ${CANARY_TOKEN}" } }); setTimeout(() => { throw new Error("render failed") });</script></body></html>`;
  }
  if (afterReset && c.landing?.startsWith("app-boundary")) {
    return `<!doctype html><html><body>
<button data-testid="user-menu">Marcus</button>
<time data-testid="seeded-at" datetime="seed-${seeded[v]}">seeded</time>
${c.landing === "app-boundary-marker" ? boundaryHtml("Could not show the portfolio") : boundaryHtml()}
<script>document.cookie = "sid=${CANARY_COOKIE}; path=/"; console.error("[error] boom ${CANARY_TOKEN}");</script></body></html>`;
  }
  if (afterReset && c.landing === "no-seeded") return `<!doctype html><html><body><button data-testid="user-menu">Marcus</button>${content}</body></html>`;
  return `<!doctype html><html><body>
<button data-testid="user-menu">Marcus</button>
<time data-testid="seeded-at" datetime="seed-${seeded[v]}">seeded</time>
<form method="post" action="/v/${v}/reset"><button type="submit">Reset demo</button></form>
${content}${late}${chatter}${detach}</body></html>`;
};
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/ping") return setTimeout(() => res.end("ok"), 50);
  if (u.pathname === "/api/broken") {
    res.writeHead(500);
    return res.end("broken");
  }
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
      if (VARIANTS[v].abort) return req.socket.destroy();
      if (VARIANTS[v].postStatus) {
        res.writeHead(VARIANTS[v].postStatus, { "content-type": "text/html; charset=utf-8" });
        return res.end("<!doctype html><html><body>cut off</body></html>");
      }
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
// Failure evidence: these variants run with an evidence folder registered on the page, as verify.mjs does.
const EVIDENCE = ["good", "post-499", "next-error", "app-boundary"];
const evRoot = mkdtempSync(path.join(os.tmpdir(), "reset-evidence-"));
const evDir = (v) => path.join(evRoot, v);
try {
  for (const v of Object.keys(VARIANTS)) {
    const p = await browser.newPage();
    if (EVIDENCE.includes(v)) setFailureEvidence(p, { dir: evDir(v), secrets: [CANARY_TOKEN] });
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
// Fail fast with a reason: each of these fails on the check that sees it, well before the 3 s timeout, and
// the reason names the URL with its query and what <main> and its job rows showed.
for (const [v, re] of [
  ["post-499", /reset failed fast at (\d+) ms: reset POST \/v\/post-499\/reset answered HTTP 499 \(url \/v\/post-499\/(app|reset)[^,]*, (seeded-at|page read failed)[^)]*job rows\)/],
  ["post-abort", /reset failed fast at (\d+) ms: reset POST \/v\/post-abort\/reset failed: net::ERR_[A-Z_]+ \(url \/v\/post-abort\/[^,]+, (seeded-at|page read failed)[^)]*\)/],
  ["next-error", /reset failed fast at (\d+) ms: error screen "This page couldn.t load" \(url \/v\/next-error\/app\?reset=1, page read failed: seeded-at element missing; main missing, 0\/4 job rows\)/],
  ["app-boundary", /reset failed fast at (\d+) ms: error screen marker \[data-testid="route-error"\] "Page load failed" \(url \/v\/app-boundary\/app\?reset=1, seeded-at new, main visible, 0\/4 job rows\)/],
  ["app-boundary-marker", /reset failed fast at (\d+) ms: error screen marker \[data-testid="route-error"\] \(url \/v\/app-boundary-marker\/app\?reset=1, seeded-at new, main visible, 0\/4 job rows\)/],
]) {
  assert.equal(out[v].ok, false, `${v} must fail: ${show(v)}`);
  const hits = out[v].failures.map((f) => f.match(re)).filter(Boolean);
  // A dropped connection leaves Chromium's error page navigating, which can interrupt the next sample's
  // setup goto; those samples still fail (0/5), so only the first must show the fail-fast reason there.
  assert.equal(out[v].values.length, 0, `${v}: no sample may succeed`);
  assert.ok(v === "post-abort" ? /^reset 1 failed: /.test(out[v].failures.find((f) => re.test(f)) ?? "") : hits.length === 5, `${v}: ${v === "post-abort" ? "sample 1" : "all 5 samples"} must fail fast with ${re}; got ${JSON.stringify(out[v].failures)}`);
  const ms = hits.map((m) => Number(m[1]));
  assert.ok(ms.every((x) => x < TIMEOUT / 2), `${v}: must fail at once, not at the ${TIMEOUT} ms timeout; failed at ${ms.join(", ")} ms`);
  lines.push(`FAILS FAST as expected (${Math.max(...ms)} ms max, timeout ${TIMEOUT}): ${v}: ${out[v].failures[0]}`);
}
assert.ok(out["no-seeded"].failures.some((f) => /reset 1 failed: reset not ready after 3000 ms \(url \/v\/no-seeded\/app\?reset=1, page read failed: seeded-at element missing; main visible, 4\/4 job rows\)/.test(f)), `seeded-at missing must say what main showed: ${JSON.stringify(out["no-seeded"].failures)}`);
lines.push(`FAILS as expected (reason has main + rows): ${show("no-seeded")}`);
// Failure evidence: one capture per failed sample (screenshot, HTML, URL with query, console errors, page
// errors, failed requests), none for a passing step, and no secret in any text file.
{
  assert.ok(!existsSync(evDir("good")) || readdirSync(evDir("good")).length === 0, "a passing reset step writes no failure evidence");
  for (const v of ["post-499", "next-error", "app-boundary"]) {
    const files = readdirSync(evDir(v));
    const json = files.filter((f) => f.endsWith(".json")).sort();
    assert.equal(json.length, 5, `${v}: 5 failed samples → 5 captures; got ${files}`);
    for (const j of json) {
      for (const ext of [".png", ".html"]) assert.ok(files.includes(j.replace(/\.json$/, ext)), `${v}: ${j} needs its ${ext}`);
      const rec = JSON.parse(readFileSync(path.join(evDir(v), j), "utf8"));
      assert.equal(rec.kind, "reset");
      assert.match(rec.reason, /reset failed fast/);
      assert.ok(typeof rec.url === "string" && rec.url.startsWith(origin), `${v}: url recorded; got ${rec.url}`);
      assert.ok(Array.isArray(rec.consoleErrors) && Array.isArray(rec.pageErrors) && Array.isArray(rec.failedRequests), `${v}: evidence lists`);
      assert.equal(rec.captureErrors.length, 0, `${v}: capture errors ${rec.captureErrors}`);
      assert.ok(out[v].samples.some((smp) => smp.evidence === j), `${v}: the sample points at ${j}`);
    }
    lines.push(`passes: ${v} wrote ${json.length} captures (png + html + json each)`);
  }
  const r499 = JSON.parse(readFileSync(path.join(evDir("post-499"), readdirSync(evDir("post-499")).find((f) => f.endsWith(".json"))), "utf8"));
  assert.ok(r499.failedRequests.some((x) => x.method === "POST" && x.status === 499 && x.url === `${origin}/v/post-499/reset`), `post-499: the failed POST is recorded; got ${JSON.stringify(r499.failedRequests)}`);
  const rNext = JSON.parse(readFileSync(path.join(evDir("next-error"), readdirSync(evDir("next-error")).find((f) => f.endsWith(".json"))), "utf8"));
  assert.equal(rNext.url, `${origin}/v/next-error/app?reset=1`, "URL with its query");
  const broken = rNext.failedRequests.find((x) => x.status === 500);
  assert.ok(broken && broken.method === "GET" && broken.url === `${origin}/api/broken?access_token=REDACTED&reset=1` && broken.requestHeaders.authorization === "[redacted]", `token query value + Authorization redacted; got ${JSON.stringify(rNext.failedRequests)}`);
  assert.ok(rNext.consoleErrors.some((x) => x.includes("[canary] [redacted]")) && rNext.pageErrors.some((x) => /render failed/.test(x)), `console + page errors recorded, redacted; got ${JSON.stringify([rNext.consoleErrors, rNext.pageErrors])}`);
  const rB = JSON.parse(readFileSync(path.join(evDir("app-boundary"), readdirSync(evDir("app-boundary")).find((f) => f.endsWith(".json"))), "utf8"));
  assert.ok(rB.consoleErrors.some((x) => x.includes("[error] boom [redacted]")), `boundary console error recorded; got ${JSON.stringify(rB.consoleErrors)}`);
  const text = ["post-499", "next-error", "app-boundary"].flatMap((v) => readdirSync(evDir(v)).filter((f) => !f.endsWith(".png")).map((f) => readFileSync(path.join(evDir(v), f), "utf8")));
  for (const secret of [CANARY_TOKEN, CANARY_COOKIE, CANARY_QUERY]) assert.ok(!text.some((t) => t.includes(secret)), `evidence must never contain ${secret}`);
  assert.ok(text.some((t) => t.includes("Page load failed")), "the boundary HTML is captured");
  lines.push("passes: evidence records the 499 POST, URL + query, console/page errors and the failed GET; Authorization, token query value, cookie value and VERIFY_TOKEN canary never written");
  rmSync(evRoot, { recursive: true, force: true });
}
for (const l of lines) console.log(l);
console.log(`ok: reset-mustfail.test.mjs (${lines.length} cases)`);
