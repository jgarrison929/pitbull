#!/usr/bin/env node
// Before/after test for the harness gaps S1–S12 from the rc/5.0.4 e3994a60 gap run. Fixtures are static pages on a
// 127.0.0.1 server; the real skill functions (Playwright from v5/node_modules) run against them. No staging, no
// production, no app build.
//
// Each case is one of:
//   fix       the false positive / harness bug. GREEN = the harness now behaves correctly. Old code is RED here.
//   must-fail a bad page or state the check must still FAIL. The check's verdict must be FAIL (shown as RED) in both
//             old and new code; "ok" means the check did fail.
// PV_SKILL_DIR=<dir> runs the same cases against another copy of the skill (the "before" worktree). A function the old
// code does not have is reported as RED for a fix case.
// Run: node .cursor/skills/verify-v5/harness-gaps.mustfail.test.mjs
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.env.PV_SKILL_DIR ? path.resolve(process.env.PV_SKILL_DIR) : here;
const mod = (f) => import(pathToFileURL(path.join(dir, f)).href);
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");
const [checks, crawlM, axeM, spec, journey, confirmM, field, rcM] = await Promise.all(
  ["checks.mjs", "crawl.mjs", "axe.mjs", "spec504.mjs", "journey504.mjs", "confirm-dialog.mjs", "field504.mjs", "rc.mjs"].map(mod),
);

// ---------- fixture server (127.0.0.1 only) ----------
const state = { ac: 100, approved: false, posts: [], completed: [], mode: {} };
const CSS = `<style>html,body{margin:0;font-size:16px}a,button,summary{font-size:16px;min-height:44px;min-width:44px;display:inline-flex;align-items:center}</style>`;
const page = (body, head = "") => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${CSS}${head}</head><body>${body}</body></html>`;
const ROLES = ["executive", "pm", "superintendent", "foreman"];
const LOGIN = page(ROLES.map((r) => `<button data-testid="role-${r}" onclick="location.href='/app'">${r}</button>`).join(""));
const MENU = `<details><summary data-testid="user-menu">ML</summary><button onclick="fetch('/app',{method:'POST',headers:{'next-action':'reset'}}).then(()=>location.href='/app?reset=1')">Reset demo</button></details>`;
const PLAN41 = `<article data-testid="plan-card" data-plan-id="41" id="plan-41" data-status="draft"><h3>Bridge Crew 2</h3><button data-testid="submit-plan" data-role="superintendent">Submit plan</button></article>`;
const routes = {
  "/login": () => LOGIN,
  "/app": () => page(`<header>${MENU}</header><main>${state.mode.app ?? ""}</main>`),
  "/app/jobs/good": () => page(`<main><h1>Job</h1><p>Cedar Creek.</p></main>`),
  "/app/jobs/24-118": () => page(`<header>${MENU}</header><main><h1>24-118</h1><span data-testid="job-actual" data-cents="${state.ac}">$1</span>
    <article data-testid="plan-card" data-plan-id="77" id="plan-77" data-status="${state.approved ? "approved" : "reported"}"><h3>Interchange Crew 1</h3>
    <button data-testid="approve-report" data-role="superintendent" onclick="${state.mode.double ? "fetch('/approve',{method:'POST',headers:{'next-action':'a'}});" : ""}fetch('/approve',{method:'POST',headers:{'next-action':'a'}}).then(()=>this.closest('article').setAttribute('data-status','approved'))">Approve report</button></article>
    <a href="/app">Back to today</a></main>`),
  "/act": () => page(`<main><div data-testid="state" data-status="draft">Draft</div>
    <button onclick="document.getElementById('dlg').style.display='block'">Approve</button>
    <div id="dlg" role="alertdialog" aria-label="Approve?" style="display:none"><button data-testid="confirm-dialog-confirm" onclick="document.getElementById('dlg').style.display='none';fetch('/post',{method:'POST',headers:{'next-action':'x'}}).then((r)=>{const mark=()=>{if(r.ok)document.querySelector('[data-testid=state]').setAttribute('data-status','approved')};${state.mode.post === "stream-abort" ? "return r.text().then(mark)" : state.mode.post === "stream-cancel" ? "mark();return r.body.cancel()" : "mark()"}}).catch(()=>{})">Approve</button><button data-testid="confirm-dialog-cancel">Cancel</button></div></main>`),
  "/other": () => page("<main>other</main>"),
};
const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST") {
    state.posts.push(url.pathname);
    if (url.pathname === "/approve") { state.ac += 1; state.approved = true; }
    if (url.pathname === "/app") { state.ac = 100; state.approved = false; }
    if (url.pathname === "/post") {
      const mode = state.mode.post ?? "ok";
      const rec = { finished: false, aborted: false };
      state.completed.push(rec);
      res.on("close", () => { if (!rec.finished) rec.aborted = true; });
      setTimeout(() => {
        if (mode === "abort") { req.socket.destroy(); return; }
        // A streamed Server Action answer: status + first RSC chunk now, body left open (as the 26-010 approve on
        // PR #87 CI). "stream-abort" cuts the socket mid-body instead.
        if (mode === "stream" || mode === "stream-abort" || mode === "stream-cancel") {
          res.writeHead(200, { "content-type": "text/x-component" });
          res.write('0:{"a":"$@1"}\n');
          if (mode === "stream-abort") setTimeout(() => req.socket.destroy(), 500);
          return;
        }
        res.writeHead(mode === "500" ? 500 : 200, { "content-type": "text/plain" });
        res.end("done", () => { rec.finished = true; });
      }, 1500);
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" }); res.end("ok"); return;
  }
  const custom = state.mode.routes?.[url.pathname];
  const r = custom ?? routes[url.pathname];
  if (!r) { res.writeHead(404); res.end("nf"); return; }
  res.writeHead(200, { "content-type": "text/html" }); res.end(r());
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const tmp = mkdtempSync(path.join(os.tmpdir(), "pv-gaps-"));

// ---------- cases ----------
const results = [];
const missing = (what) => ({ green: false, detail: `old code has no ${what}` });
async function run(id, kind, title, fn) {
  state.ac = 100; state.approved = false; state.posts = []; state.completed = []; state.mode = {};
  let r;
  try { r = await fn(); } catch (e) { r = { green: false, detail: `threw: ${String(e?.message ?? e).split("\n")[0]}` }; }
  // fix: green = correct behaviour. must-fail: green = the check FAILED, as it must.
  results.push({ id, kind, title, ...r });
  const word = kind === "fix" ? (r.green ? "GREEN" : "RED") : (r.green ? "RED (check FAILs, as required)" : "WENT GREEN (check passed a bad case)");
  console.log(`${r.green ? "ok  " : "BAD "} ${id} ${kind.padEnd(9)} ${word}: ${title} — ${r.detail}`);
}

// S1: one screenshot failure no longer aborts the crawl; each failed load is its own FAIL row.
const crawlTwo = async (shotDir) => crawlM.crawl(browser, base, { pages: ["/app", "/app/jobs/good"], roles: ["pm"], widths: [390], shotDir });
const notADir = path.join(tmp, "file"); writeFileSync(notADir, "x");
await run("S1", "fix", "screenshot fails on every page: the crawl still returns both rows", async () => {
  const rows = await crawlTwo(notADir);
  const f = rows.map((r) => checks.evaluateCrawlRow(r));
  return { green: rows.length === 2 && f.every((x) => x.some((y) => /screenshot failed/.test(y))), detail: `${rows.length} row(s); ${f.flat().filter((y) => /screenshot failed/.test(y)).length} "screenshot failed" FAIL line(s)` };
});
await run("S1", "must-fail", "a crawl whose screenshots fail is never a PASS", async () => {
  let rows; try { rows = await crawlTwo(notADir); } catch (e) { return { green: true, detail: `crawl threw (step FAILs): ${String(e.message).split("\n")[0].slice(0, 80)}` }; }
  const f = rows.flatMap((r) => checks.evaluateCrawlRow(r));
  return { green: f.length > 0, detail: `${f.length} FAIL line(s)` };
});

// S2: checks gated on the crawl show as NOT EXECUTED; unmeasured loads fail 5.0.4-0 / ellipsis; drill refusals unproven.
await run("S2", "fix", "crawl died: gated checks listed as NOT EXECUTED (not missing)", async () => {
  if (!checks.notExecutedChecks) return missing("notExecutedChecks (gated checks just vanish from the result)");
  const out = checks.notExecutedChecks([{ name: "a", ok: true }], ["a", "/schedule", "/roadmap"], "the nav crawl threw");
  return { green: out.length === 2 && out.every((c) => c.ok === false && /^NOT EXECUTED/.test(c.detail)), detail: out.map((c) => `${c.name}: ${c.detail}`).join("; ") };
});
await run("S2", "fix", "ellipsis check FAILs when a load threw and was never measured (5.0.4-0 uses the same lines)", async () => {
  const rc = rcM.buildRcChecks({ history: null, historyError: "fixture", crawlRan: true, crawlFailures: ["pm@320 /app/jobs/24-077: load threw: page.screenshot: Timeout 30000ms exceeded."], migrationsLabel: null, healthOk: true });
  const c = rc.find((x) => /ellipsis/.test(x.name));
  return { green: !!c && c.ok === false, detail: c ? `${c.name}: ok=${c.ok} (${String(c.detail).slice(0, 90)})` : "no ellipsis check" };
});
await run("S2", "must-fail", "a measured clipped money label still FAILs the ellipsis check", async () => {
  const rc = rcM.buildRcChecks({ history: null, historyError: "fixture", crawlRan: true, crawlFailures: ["pm@320 /app/jobs/24-077: clipped money \"$1,234\""], migrationsLabel: null, healthOk: true });
  const c = rc.find((x) => /ellipsis/.test(x.name));
  return { green: !!c && c.ok === false, detail: c ? `ok=${c.ok}: ${String(c.detail).slice(0, 90)}` : "no ellipsis check" };
});

// S3: the banned-strings line reports what was scanned; it is not "clean" when the nav crawl never ran.
await run("S3", "fix", "nav crawl died: banned-strings check is not clean and names what it scanned", async () => {
  if (!checks.bannedStringsCheck) return missing("bannedStringsCheck (verify.mjs printed 'clean' from 3 scanned pages)");
  const c = checks.bannedStringsCheck({ scanned: ["/", "/login", "/app (pm)"], hits: [], navRows: null });
  return { green: c.ok === false && /\/login/.test(c.detail) && /nav crawl/.test(c.detail), detail: `ok=${c.ok}: ${c.detail}` };
});
await run("S3", "must-fail", "a banned string on a scanned page fails", async () => {
  if (!checks.bannedStringsCheck) { const h = checks.bannedHits("Coming soon"); return { green: h.length > 0, detail: `bannedHits: ${JSON.stringify(h)}` }; }
  const c = checks.bannedStringsCheck({ scanned: ["/app"], hits: ["/app: Coming soon"], navRows: [] });
  return { green: c.ok === false, detail: c.detail };
});

// S4: a-2 waits for the soft-navigated target to render.
const SOFT = (delay) => `<a data-testid="next-step" data-role="superintendent" href="/app/jobs/25-031#plan-41" onclick="event.preventDefault();history.pushState({},'',this.getAttribute('href'));const m=document.querySelector('main');m.innerHTML='<p>Loading…</p>';${delay == null ? "" : `setTimeout(()=>{m.innerHTML=window.PLAN},${delay})`}">Submit tomorrow's plan: Bridge Crew 2 on 25-031</a><script>window.PLAN=${JSON.stringify(PLAN41)}</script>`;
const a2 = async () => {
  const pass = { ...spec.PASSES["a-2"], roles: ["superintendent"], sizes: [{ width: 390, height: 844 }] };
  const rows = await spec.pagePass(browser, base, pass);
  return rows.flatMap((r) => spec.evaluateFirstTarget(r));
};
await run("S4", "fix", "target renders 1.2 s after a client-side navigation", async () => {
  state.mode.app = SOFT(1200);
  const f = await a2();
  return { green: f.length === 0, detail: f.length ? f.join("; ").slice(0, 160) : "submit-plan found in view" };
});
await run("S4", "must-fail", "target never renders", async () => {
  state.mode.app = SOFT(null);
  const f = await a2();
  return { green: f.some((x) => /not found/.test(x)), detail: f.join("; ").slice(0, 160) };
});

// S5: i-3 tree-toggle names ignore the money-precision buttons; an unnamed real toggle still fails.
const toggles = async (rowHtml) => {
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  try {
    await p.setContent(page(`<main><div data-testid="cost-tree-row">${rowHtml}</div></main>`));
    const names = await axeM.toggleNames(p);
    return { names, bad: names.filter((n) => !axeM.TOGGLE_NAME.test(n)) };
  } finally { await ctx.close(); }
};
const REAL = `<button aria-expanded="true" aria-controls="k" aria-label="Collapse 03 Concrete">▾</button>`;
const MONEY = `<button data-testid="money-exact-toggle" data-cents="1300000" aria-expanded="false" aria-label="Compact $13K. Show exact.">$13K</button>`;
await run("S5", "fix", "a named tree toggle plus a 'Compact $13K. Show exact.' money button", async () => {
  const t = await toggles(REAL + MONEY);
  return { green: t.bad.length === 0 && t.names.length === 1, detail: `names ${JSON.stringify(t.names)}` };
});
await run("S5", "must-fail", "an unnamed tree toggle", async () => {
  const t = await toggles(`<button aria-expanded="false"></button>` + MONEY);
  return { green: t.bad.length > 0, detail: `bad names ${JSON.stringify(t.bad)}` };
});

// S6: content in a closed <details> is not visible; truly visible small text still fails.
const small = async (body) => {
  state.mode.routes = { "/app/jobs/good": () => page(`<main><h1>Job</h1>${body}</main>`) };
  const rows = await crawlM.crawl(browser, base, { pages: ["/app/jobs/good"], roles: ["pm"], widths: [390], phoneChecks: true });
  return rows.flatMap((r) => checks.evaluateCrawlRow(r, { phoneChecks: true })).filter((x) => /text [\d.]+px < |text nodes under/.test(x));
};
await run("S6", "fix", "12px text inside a closed <details> menu", async () => {
  const f = await small(`<details><summary style="font-size:16px">Menu</summary><p style="font-size:12px">Sandbox · seeded</p></details>`);
  return { green: f.length === 0, detail: f.length ? f.join("; ").slice(0, 160) : "no small-text hit" };
});
await run("S6", "must-fail", "visible 11px text", async () => {
  const f = await small(`<p style="font-size:11px">Seeded at 9:41</p>`);
  return { green: f.length > 0, detail: f.join("; ").slice(0, 160) };
});
await run("S6", "must-fail", "12px text in the summary of a closed <details>", async () => {
  const f = await small(`<details><summary><span style="font-size:12px">EB</span></summary><p>x</p></details>`);
  return { green: f.length > 0, detail: f.join("; ").slice(0, 160) };
});

// S7: the journey POST counter counts the action's writes only, not the cleanup Reset demo.
const APPROVE_STEP = `<a data-testid="next-step" data-role="superintendent" href="/app/jobs/24-118#plan-77">Approve the 24-118 report for Interchange Crew 1</a>`;
const superApprove = async () => journey.runJourney504(browser, base, "super-approve", { width: 390, height: 844 });
await run("S7", "fix", "one approve, then the cleanup Reset demo POST", async () => {
  state.mode.app = APPROVE_STEP;
  const r = await superApprove();
  const f = journey.evaluateJourney504(r).filter((x) => /posted/.test(x));
  return { green: r.posts === 1 && f.length === 0, detail: `posts=${r.posts}${r.error ? ` error=${r.error}` : ""}; server saw ${state.posts.join(", ")}` };
});
await run("S7", "must-fail", "the approve button posts twice", async () => {
  state.mode.app = APPROVE_STEP; state.mode.double = true;
  const r = await superApprove();
  const f = journey.evaluateJourney504(r).filter((x) => /posted/.test(x));
  return { green: f.length > 0, detail: `posts=${r.posts}: ${f.join("; ")}` };
});

// S8: one hook per journey screen, data-role="<role>" (#86, 59cbf2da), on the measured action.
const hookCase = (o) => {
  const J = journey.JOURNEYS504["super-approve"];
  const h = (x = {}) => ({ path: "/app", count: 1, hooks: ["a"], others: [], isTarget: true, targetRole: J.role, target: "a", firstStepIsHook: true, ...x });
  return journey.evaluateJourney504({ key: "super-approve", name: J.name, role: J.role, width: 390, height: 844, limit: 3, entries: [{ kind: "tap", label: "r" }, { kind: "tap", label: "n" }, { kind: "tap", label: "a" }], bad: [], posts: 1, firstActionTaps: 1, scrollNeed: 0, landed: "/app/jobs/24-118", deadEnd: { forward: true }, doneState: { before: { ac: 1 }, after: { ac: 2 }, settled: true }, targetFound: true, appHook: { ...h(), tappedIndex: 0 }, actionHook: h({ path: "/app/jobs/24-118" }), ...o(h) });
};
for (const [title, o] of [
  ["zero hooks on the action screen", (h) => ({ actionHook: h({ count: 0, hooks: [], isTarget: false, targetRole: null }) })],
  ["two visible hooks on the action screen", (h) => ({ actionHook: h({ count: 2, hooks: ["a", "b"] }) })],
  ["the hook is not the measured action", (h) => ({ actionHook: h({ isTarget: false, targetRole: null }) })],
  ["wrong role value (data-role=\"primary-action\")", (h) => ({ appHook: { ...h({ count: 0, hooks: [], isTarget: false, targetRole: "primary-action", others: ['a data-role="primary-action"'] }), tappedIndex: 0 } })],
]) await run("S8", "must-fail", title, async () => {
  const f = hookCase(o).filter((x) => /data-role|hook/.test(x));
  return { green: f.length > 0, detail: f.length ? f[0].slice(0, 150) : "old code has no per-screen journey hook check" };
});

// S9: d-1e finds the plan-line Edit button by its trimmed accessible name (" Edit", svg + space).
const EDIT = (btn) => ({ "/app/jobs/25-031": () => page(`<main><article data-testid="plan-card">${btn}<form data-testid="line-form" hidden><input required name="qty"><button type="submit">Save</button></form></article></main>`) });
const d1e = async () => {
  const rows = await spec.pagePass(browser, base, { ...spec.PASSES["d-1e"], roles: ["foreman"], sizes: [{ width: 390, height: 844 }] });
  return rows[0];
};
await run("S9", "fix", "Edit button whose text is ' Edit' after an svg", async () => {
  state.mode.routes = EDIT(`<button onclick="this.nextElementSibling.hidden=false"><svg width="12" height="12" aria-hidden="true"></svg> Edit</button>`);
  const r = await d1e();
  return { green: !r.error && !!r.data, detail: r.error ? `row error: ${r.error.slice(0, 120)}` : "Edit clicked, line-form open, probe ran" };
});
await run("S9", "must-fail", "no Edit button", async () => {
  state.mode.routes = EDIT(`<button>Remove</button>`);
  const r = await d1e();
  return { green: !!r.error, detail: `row error: ${String(r.error).slice(0, 100)}` };
});

// S10: wait for the confirmed write to finish before navigating; a failed or aborted save is a FAIL.
const confirmThenLeave = async (postMode) => {
  state.mode.post = postMode;
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  try {
    await p.goto(`${base}/act`);
    await p.getByRole("button", { name: "Approve" }).first().click();
    const settled = p.locator('[data-testid="state"][data-status="approved"]');
    let threw = null;
    try { await confirmM.confirmIfDialog(p, { settled, timeout: 5000 }); } catch (e) { threw = String(e.message).split("\n")[0]; }
    const shown = await settled.isVisible();
    await p.goto(`${base}/other`); // the caller (field504) reads the state and moves on at once
    await new Promise((ok) => setTimeout(ok, 1800));
    const rec = state.completed[0] ?? {};
    return { threw, shown, finished: !!rec.finished, aborted: !!rec.aborted };
  } finally { await ctx.close(); }
};
await run("S10", "fix", "confirm, the save takes 1.5 s, the caller navigates right after", async () => {
  const r = await confirmThenLeave("ok");
  return { green: r.finished && !r.aborted && !r.threw && r.shown, detail: `save ${r.finished ? "finished" : r.aborted ? "ABORTED by the navigation" : "unfinished"}; posted state ${r.shown ? "shown" : "not shown"}${r.threw ? `; threw ${r.threw}` : ""}` };
});
await run("S10", "fix", "streamed Server Action answer: status 200 at once, RSC body left open (PR #87 CI M2 hang)", async () => {
  const r = await confirmThenLeave("stream");
  return { green: !r.threw && r.shown, detail: r.threw ? `confirmIfDialog threw: ${r.threw.slice(0, 110)}` : `returned on the 200; posted state ${r.shown ? "shown" : "not shown"}` };
});
await run("S10", "fix", "streamed answer that the page cancels after updating (PR #87 CI M2: net::ERR_ABORTED after the 200)", async () => {
  const r = await confirmThenLeave("stream-cancel");
  return { green: !r.threw && r.shown, detail: r.threw ? `confirmIfDialog threw: ${r.threw.slice(0, 110)}` : `returned on the 200; posted state ${r.shown ? "shown" : "not shown"}` };
});
for (const [mode, title] of [["500", "the save answers HTTP 500"], ["abort", "the save's socket is destroyed (aborted)"], ["stream-abort", "a streamed save is cut mid-body before the posted state shows"]]) {
  await run("S10", "must-fail", title, async () => {
    const r = await confirmThenLeave(mode);
    const fail = !!r.threw || !r.shown;
    return { green: fail, detail: r.threw ? `confirmIfDialog threw: ${r.threw.slice(0, 100)}` : `returned; posted state ${r.shown ? "shown" : "not shown (caller FAILs)"}` };
  });
}

// S11: d-4 counts the app's /changes report rows; no row still counts 0.
const APP_ROW = "Reported Culvert Crew A's work on I-5 Culverts for Tue, Oct 27: 12 CY, 22.0 MH";
await run("S11", "fix", "the app's /changes report row is counted", async () => {
  if (!field.countReportRows) { const old = /Reported day's work/; return { green: false, detail: `old code has no countReportRows; its regex ${old} counts ${old.test(APP_ROW) ? 1 : 0} on the app's row` }; }
  return { green: field.countReportRows([APP_ROW]) === 1, detail: `count ${field.countReportRows([APP_ROW])}` };
});
await run("S11", "must-fail", "a page with no report row counts 0", async () => {
  const n = field.countReportRows ? field.countReportRows(["Issued Culvert Crew A's plan"]) : (/Reported day's work/.test("Issued Culvert Crew A's plan") ? 1 : 0);
  return { green: n === 0, detail: `count ${n}` };
});

// S12: a local run is labelled local/loopback with its URL (DONE's exit code is the launcher's; see the PR).
await run("S12", "fix", "a 127.0.0.1 run is labelled local loopback with the URL", async () => {
  if (!checks.targetLabel) return missing("targetLabel (verify.mjs printed 'target staging' for a localhost run)");
  const l = checks.targetLabel({ baseUrl: "http://127.0.0.1:44040", isLocal: true, target: "staging", production: false, rc: null });
  return { green: /local/.test(l) && /127\.0\.0\.1:44040/.test(l) && !/staging/.test(l), detail: l };
});

await browser.close();
server.closeAllConnections();
server.close();
rmSync(tmp, { recursive: true, force: true });
const by = (k) => results.filter((r) => r.kind === k);
const fixGreen = by("fix").filter((r) => r.green).length;
const mfRed = by("must-fail").filter((r) => r.green).length;
console.log(`harness-gaps: fix cases GREEN ${fixGreen}/${by("fix").length}; must-fail cases RED (check FAILs) ${mfRed}/${by("must-fail").length}`);
process.exit(results.every((r) => r.green) ? 0 : 1);
