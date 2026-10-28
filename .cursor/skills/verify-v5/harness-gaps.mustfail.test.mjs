#!/usr/bin/env node
// Before/after test for the harness gaps S1–S12 from the rc/5.0.4 e3994a60 gap run, and S13–S16 from the rc/5.0.4 ab74c4f3 --rc run, S17–S18 from the Planner ruling relayed by the lead 2026-10-27 (d-5, d-4). Fixtures are static pages on a
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
const state = { ac: 100, since: 0, approved: false, posts: [], completed: [], mode: {} };
const CSS = `<style>html,body{margin:0;font-size:16px}a,button,summary{font-size:16px;min-height:44px;min-width:44px;display:inline-flex;align-items:center}</style>`;
const page = (body, head = "") => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${CSS}${head}</head><body>${body}</body></html>`;
const ROLES = ["executive", "pm", "superintendent", "foreman"];
const LOGIN = page(ROLES.map((r) => `<button data-testid="role-${r}" onclick="location.href='/app'">${r}</button>`).join(""));
const MENU = `<details><summary data-testid="user-menu">ML</summary><button onclick="fetch('/app',{method:'POST',headers:{'next-action':'reset'}}).then(()=>location.href='/app?reset=1')">Reset demo</button></details>`;
const PLAN41 = `<article data-testid="plan-card" data-plan-id="41" id="plan-41" data-status="draft"><h3>Bridge Crew 2</h3><button data-testid="submit-plan" data-role="superintendent">Submit plan</button></article>`;
// S13 (spec #89): the AC card's since-lock line, CPI, EAC and the approved report's pending cost on 24-118.
const AC89_COST = [400000, 268800];
const since89 = () => (state.since > 0 ? `<span data-testid="job-ac-since-lock" data-cents="${state.since}">+$${(state.since / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })} posted since Period 1 lock</span>` : "");
const AC89 = () => `${since89()}<span data-testid="job-cpi-index">0.97</span><span data-testid="job-eac" data-cents="3290000000">$32.9M</span>
    <div data-testid="cost-tree-scroll">${state.approved ? "" : AC89_COST.map((c, i) => `<span data-testid="approval-pending-0${3 + i}-210" data-cents="${c}">pending</span>`).join("")}</div>`;
const routes = {
  "/login": () => LOGIN,
  "/app": () => page(`<header>${MENU}</header><main>${state.mode.app ?? ""}</main>`),
  "/app/jobs/good": () => page(`<main><h1>Job</h1><p>Cedar Creek.</p></main>`),
  "/app/jobs/24-118": () => page(`<header>${MENU}</header><main><h1>24-118</h1><span data-testid="job-actual" data-cents="${state.ac}">$1</span>${state.mode.ac89 ? AC89() : ""}
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
    if (url.pathname === "/approve") {
      const sum = AC89_COST.reduce((a, b) => a + b, 0);
      // S13 modes: "good" (#89: since-lock += approved, AC flat), "ac-rises" (#88's live AC card), "flat", "wrong" (+1¢).
      if (!state.mode.ac89) state.ac += 1;
      else if (state.mode.ac89 === "good") state.since += sum;
      else if (state.mode.ac89 === "ac-rises") state.ac += sum;
      else if (state.mode.ac89 === "wrong") state.since += sum + 1;
      state.approved = true;
    }
    if (url.pathname === "/app") { state.ac = 100; state.since = 0; state.approved = false; }
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
  state.ac = 100; state.since = 0; state.approved = false; state.posts = []; state.completed = []; state.mode = {};
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

// S13 (spec #89, main 9497f7e9; lead request on #88 comment 6457589799): the super-approve journey's done state.
// "Its figure does not move when a report is approved, only when the next period is locked": job-actual stays flat and
// job-ac-since-lock rises by exactly the approved cost (the superintendent's approval-pending-* data-cents).
const done89 = async (mode) => {
  state.mode.app = APPROVE_STEP; state.mode.ac89 = mode;
  const r = await superApprove();
  return { r, f: journey.evaluateJourney504(r).filter((x) => /done state/.test(x)) };
};
await run("S13", "fix", "#89 approval: AC flat, since-lock +$6,688.00 (= approval-pending 400000 + 268800)", async () => {
  const { r, f } = await done89("good");
  return { green: !r.error && f.length === 0 && r.posts === 1, detail: f.length ? f.join("; ").slice(0, 200) : `done state ok; ${JSON.stringify({ ac: [r.doneState?.before?.actual, r.doneState?.after?.actual], since: [r.doneState?.before?.since?.cents ?? 0, r.doneState?.after?.since?.cents] })}${r.error ? ` error=${r.error}` : ""}` };
});
for (const [mode, title, re] of [
  ["ac-rises", "job-actual rises after the approval (#88's live AC card)", /job-actual 100¢ → 668900¢ after the approval \(want unchanged/],
  ["flat", "job-ac-since-lock unchanged after the approval", /job-ac-since-lock missing \(want 668800¢\)/],
  ["wrong", "job-ac-since-lock rises by the wrong amount (+1¢)", /job-ac-since-lock data-cents 668801 \(want 0 \+ 668800 = 668800¢\)/],
]) await run("S13", "must-fail", title, async () => {
  const { f } = await done89(mode);
  return { green: f.some((x) => re.test(x)), detail: f.join("; ").slice(0, 200) || "done state passed" };
});

// S14: e-1 phone cost rows. A roll-up holds a tree toggle; the aria-expanded money buttons are not toggles.
const E1_MONEY = (c, s, x) => `<button type="button" data-figure="primary" data-cents="${c}" title="${x}" data-testid="money-exact-toggle" aria-expanded="false" aria-label="Compact ${s}. Show exact.">${s}</button>`;
const e1Row = (code, inner) => `<div data-card data-testid="cost-tree-row" data-code="${code}"><span>${code}</span>${inner}</div>`;
const e1Crawl = async (rowsHtml) => {
  state.mode.routes = { "/app/jobs/24-118": () => page(`<main><h1>24-118</h1><div data-testid="cost-tree-scroll-mobile">${rowsHtml}</div></main>`) };
  const rows = await crawlM.crawl(browser, base, { pages: ["/app/jobs/24-118"], roles: ["pm"], widths: [320], phoneChecks: true });
  const row = rows[0];
  return { cards: (row.cards ?? []).filter((c) => c.costRow), f: checks.evaluateFigures(row).filter((x) => /roll-up/.test(x)) };
};
const TOGGLE02 = `<button type="button" aria-expanded="true" aria-controls="cost-tree-phone-02" aria-label="Collapse 02 Earthwork">▾</button>`;
await run("S14", "fix", "a leaf row whose only aria-expanded button is a money button ('Compact $395K. Show exact.') is not a roll-up", async () => {
  const { cards } = await e1Crawl(e1Row("02-100", E1_MONEY(39500000, "$395K", "$395,000.00")));
  return { green: cards.length === 1 && cards[0].rollup === false, detail: `rollup=${JSON.stringify(cards.map((c) => c.rollup))}` };
});
await run("S14", "fix", "a row with the real tree toggle ('Collapse 02 Earthwork') is a roll-up", async () => {
  const { cards, f } = await e1Crawl(e1Row("02", TOGGLE02 + E1_MONEY(200000000, "$2.0M", "$2,000,000.00")));
  return { green: cards.length === 1 && cards[0].rollup === true && f.length === 0, detail: `rollup=${JSON.stringify(cards.map((c) => c.rollup))}; ${f.join("; ") || "roll-up rules pass"}` };
});
await run("S14", "must-fail", "a real roll-up row showing exact money ($2,000,000.00, not usdShort)", async () => {
  const { f } = await e1Crawl(e1Row("02", TOGGLE02 + E1_MONEY(200000000, "$2,000,000.00", "$2,000,000.00")));
  return { green: f.some((x) => /roll-up cost-tree-row 02 "\$2,000,000\.00" is not usdShort/.test(x)), detail: f.join("; ").slice(0, 160) || "roll-up rules passed" };
});

// S15: a clip is a status pill by the element's own data-status (or a pill inside it), not an ancestor card's.
const clip15 = async (body) => {
  state.mode.routes = { "/app/jobs/24-118": () => page(`<main><h1>24-118</h1>${body}</main>`) };
  const rows = await crawlM.crawl(browser, base, { pages: ["/app/jobs/24-118"], roles: ["superintendent"], widths: [320], phoneChecks: true });
  return { clips: rows[0].clips ?? [], f: checks.evaluateCrawlRow(rows[0], { phoneChecks: true }).filter((x) => /clipped/.test(x)) };
};
const ELL = "display:inline-block;max-width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
const ACT = "HMA binder course, north approach";
await run("S15", "fix", "ellipsized activity name inside plan-card[data-status] is classified text (and FAILs as text)", async () => {
  const { clips, f } = await clip15(`<section data-testid="plan-card" data-status="reported"><span title="${ACT}" style="${ELL}">${ACT}</span></section>`);
  return { green: clips.length === 1 && clips[0].kind === "text" && f.some((x) => x.includes(`clipped text "${ACT}"`)), detail: `kinds ${JSON.stringify(clips.map((c) => c.kind))}; ${f.join("; ").slice(0, 120)}` };
});
await run("S15", "must-fail", "the same activity name still FAILs (<=480 rule: own text cut by ellipsis)", async () => {
  const { f } = await clip15(`<section data-testid="plan-card" data-status="reported"><span title="${ACT}" style="${ELL}">${ACT}</span></section>`);
  return { green: f.some((x) => x.includes(ACT)), detail: f.join("; ").slice(0, 160) || "no clip failure" };
});
await run("S15", "must-fail", "a real ellipsized status pill (own data-status) is a status pill and FAILs", async () => {
  const { clips, f } = await clip15(`<section data-testid="plan-card" data-status="reported"><span data-status="at-risk" style="${ELL};max-width:32px">At risk</span></section>`);
  return { green: clips.some((c) => c.kind === "status") && f.some((x) => /clipped status pill "At risk"/.test(x)), detail: `kinds ${JSON.stringify(clips.map((c) => c.kind))}; ${f.join("; ").slice(0, 120)}` };
});

// S16: /status's screen-reader-only <dl> (PR #34, Tailwind v4 sr-only) is not a visual clip; the visible commit line is.
const SR = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border-width:0";
const SHA = "ab74c4f3fec33369acbd907e13bef3239db7302d";
const SR_DL = `<dl style="${SR}"><dt>Commit</dt><dd data-testid="status-commit">${SHA}</dd><dt>CI gate</dt><dd data-testid="status-ci-gate">pass</dd><dt>Built</dt><dd data-testid="status-built">2026-10-27T20:10:00Z</dd></dl>`;
const status16 = async (body, widths = [320, 390, 1280]) => {
  state.mode.routes = { "/status": () => page(`<main><h1>Status</h1>${body}</main>`) };
  const rows = await crawlM.crawl(browser, base, { pages: ["/status"], roles: ["pm"], widths, phoneChecks: true });
  return { rows, f: rows.flatMap((r) => checks.evaluateCrawlRow(r, { phoneChecks: true })).filter((x) => /clipped/.test(x)) };
};
await run("S16", "fix", "sr-only <dl> beside a visible commit line that fits: no clip at 320/390/1280", async () => {
  const { rows, f } = await status16(`<p data-testid="status-commit-visible" title="${SHA}" style="font-size:16px">ab74c4f3</p>${SR_DL}`);
  return { green: f.length === 0 && rows.every((r) => r.srOnlyClipCount === 1), detail: f.length ? f.join("; ").slice(0, 160) : `no clip FAIL; srOnlyClipCount ${rows.map((r) => r.srOnlyClipCount).join("/")}` };
});
await run("S16", "must-fail", "the visible /status commit line ellipsized (sr-only <dl> present)", async () => {
  const { f } = await status16(`<p data-testid="status-commit-visible" title="${SHA}" style="display:block;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:16px">${SHA}</p>${SR_DL}`, [320]);
  return { green: f.some((x) => x.includes(`clipped text "${SHA}"`)), detail: f.join("; ").slice(0, 160) || "no clip failure" };
});
await run("S16", "must-fail", "the visible commit line wearing the sr-only pattern is never exempt", async () => {
  const { f } = await status16(`<p data-testid="status-commit-visible" style="${SR}">${SHA}</p>`, [320]);
  return { green: f.some((x) => x.includes(SHA)), detail: f.join("; ").slice(0, 160) || "no clip failure" };
});
await run("S16", "must-fail", "fake sr-only: 1px tall, ellipsis, no position/clip pattern", async () => {
  const { f } = await status16(`<span style="display:block;height:1px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Commit ${SHA}</span>`, [320]);
  return { green: f.some((x) => /clipped text "Commit ab74c4f3/.test(x)), detail: f.join("; ").slice(0, 160) || "no clip failure" };
});
await run("S16", "must-fail", "fake sr-only: 1px × 1px absolute, overflow hidden, but no clip / clip-path", async () => {
  const { f } = await status16(`<span style="position:absolute;width:1px;height:1px;overflow:hidden;white-space:nowrap">Commit ${SHA}</span>`, [320]);
  return { green: f.some((x) => /clipped text "Commit ab74c4f3/.test(x)), detail: f.join("; ").slice(0, 160) || "no clip failure" };
});
await run("S16", "must-fail", "a visible container that cuts its own text still FAILs when it also holds an sr-only <dl>", async () => {
  const { f } = await status16(`<div style="max-width:80px;overflow:hidden;white-space:nowrap;font-size:16px">Operational since the last deploy ${SR_DL}</div>`, [320]);
  return { green: f.some((x) => /clipped text "Operational since/.test(x)), detail: f.join("; ").slice(0, 160) || "no clip failure" };
});

// S17 (d-5, Planner ruling relayed by lead 2026-10-27, spec PR pending): QTY_PROBE in Chromium on a fake 04-210 page.
// The Installed headline stays at the claimed 248 CY; cost-item-qty-since-lock carries the +12 CY for every role.
const QLINE = (qty = "12000", text = "+12 CY posted since Period 1 lock", style = "") => `<p data-testid="cost-item-qty-since-lock" data-qty-milli="${qty}" style="${style}">${text}</p>`;
const QPAGE = (installed = "248 CY", line = QLINE()) => page(`<main><h1>04-210</h1><div data-card data-testid="cost-item-installed"><p>Installed</p><p>${installed}</p><p>300 CY budgeted</p>${line}</div><p>Actual cost is through the Period 1 lock</p></main>`);
const QPATH = "/app/jobs/25-031/cost-items/04-210";
const qRead = async (html) => {
  state.mode.routes = { [QPATH]: () => html };
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  await p.goto(base + QPATH);
  // Old code (PV_SKILL_DIR) has no QTY_PROBE; its installed() read the card's innerText.
  const r = field.QTY_PROBE ? await p.evaluate(field.QTY_PROBE) : { installed: (await p.getByTestId("cost-item-installed").first().innerText()).replace(/\s+/g, " ").trim() };
  await ctx.close(); return r;
};
// Judged through evaluateIssueReportApprove's d-5 list, so PV_SKILL_DIR=<old skill dir> judges the same pages by the old
// rule (installedBefore → installedAfter must rise by +12; its reader took the card's innerText).
const q17 = async ({ before = QPAGE("248 CY", ""), after = QPAGE(), foreman } = {}) => {
  const b = await qRead(before); const a = await qRead(after); const fm = foreman ? await qRead(foreman) : a;
  const flow = { steps: ["super submit", "foreman sees", "live G/L", "report", "approve + posted qty"], planId: "41", superAfter: { visible: true, status: "issued" }, foremanSees: { visible: true, status: "issued" }, liveGl: "−2.8 MH Earned 19.2 MH Actual 22.0 MH", afterReport: { visible: true, status: "reported" }, afterApprove: { visible: true, status: "approved" },
    qtyBefore: b, qtyAfter: { superintendent: a, pm: a, executive: a, foreman: fm }, installedBefore: b.installed, installedAfter: a.installed };
  return { f: field.evaluateIssueReportApprove(flow)["d-5"] };
};
await run("S17", "fix", "d-5: headline 248 CY before and after, +12 CY line (12000, Period 1) for all 4 roles", async () => {
  const { f } = await q17();
  return { green: f.length === 0, detail: f.join("; ").slice(0, 200) || "d-5 passes" };
});
for (const [title, o, re] of [
  ["headline rises to 260 CY (the old +12 rule)", { after: QPAGE("260 CY") }, /Installed headline 248 CY → 260 CY/],
  ["line missing after +12", { after: QPAGE("248 CY", "") }, /cost-item-qty-since-lock missing/],
  ["data-qty-milli 12 (not milli)", { after: QPAGE("248 CY", QLINE("12")) }, /data-qty-milli "12" \(want "12000"\)/],
  ["text '12 CY since lock'", { after: QPAGE("248 CY", QLINE("12000", "12 CY since lock")) }, /reads "12 CY since lock"/],
  ["line names Period 2 while the page says Period 1", { after: QPAGE("248 CY", QLINE("12000", "+12 CY posted since Period 2 lock")) }, /names Period 2, but the page also says Period 1 lock/],
  ["line rendered at 0 before anything is posted", { before: QPAGE("248 CY", QLINE("0", "+0 CY posted since Period 1 lock")) }, /before: cost-item-qty-since-lock is rendered with data-qty-milli "0"/],
  ["line hidden for the foreman (display:none)", { foreman: QPAGE("248 CY", QLINE("12000", "+12 CY posted since Period 1 lock", "display:none")) }, /foreman after the approval: cost-item-qty-since-lock is not visible/],
  ["line not rendered for the foreman", { foreman: QPAGE("248 CY", "") }, /foreman after the approval: cost-item-qty-since-lock missing/],
]) await run("S17", "must-fail", `d-5: ${title}`, async () => {
  const { f } = await q17(o);
  return { green: f.some((x) => re.test(x)), detail: f.join("; ").slice(0, 200) || "d-5 passed" };
});

// S18 (d-4, same ruling): one report row per (plan, day), read from a fake /changes page by field504's reader.
const CROW = (crew, day = "Tue, Oct 27") => `<li><span>Bryce Foreman</span> · Reported ${crew}'s work on I-5 Culverts for ${day}: 110 man-hours pending (as planned). <span data-text="label">9:41 AM</span></li>`;
const d4 = async (lis) => {
  state.mode.routes = { "/app/jobs/24-077/changes": () => page(`<main><h1>Changes</h1><ul data-testid="job-changes-full"><li>Mia PM · Issued Culvert Crew A's plan on I-5 Culverts</li>${lis.join("")}</ul></main>`) };
  // Old code (PV_SKILL_DIR) has no row reader export; it counted Culvert Crew A rows (countReportRows) on the same li texts.
  const ctx = await browser.newContext(); const p = await ctx.newPage();
  let rows;
  if (field.reportedRows) rows = await field.reportedRows(p, base, "24-077");
  else { await p.goto(base + "/app/jobs/24-077/changes"); rows = field.countReportRows(await p.evaluate(() => [...document.querySelectorAll('[data-testid="job-changes-full"] li')].map((li) => li.innerText ?? ""))); }
  await ctx.close();
  const RS = ["offline submit", "back online", "reload", "retry", "rows"]; const Q = { unsent: true, retry: true, retryTag: "BUTTON", retryText: "Retry" };
  return { f: field.evaluateOfflineRetry({ steps: RS, job: "24-077", planId: "41", planDate: "2026-10-27", mode: "retry", rowsBefore: [], rowsAfter: rows, queued: Q, offlineReached: 0, autoPosts: 0, afterReload: { ...Q, status: "issued" }, retryPosts: 1, afterRetry: { unsent: false, retry: false, status: "reported" } }) };
};
await run("S18", "fix", "d-4: two rows for different plans on the same day PASS (a second crew's report stays)", async () => {
  const { f } = await d4([CROW("Culvert Crew B"), CROW("Culvert Crew A")]);
  return { green: f.length === 0, detail: f.join("; ").slice(0, 200) || "d-4 rows pass" };
});
await run("S18", "must-fail", "d-4: two rows for the same plan + day (retry duplicate)", async () => {
  const { f } = await d4([CROW("Culvert Crew A"), CROW("Culvert Crew A")]);
  return { green: f.some((x) => /2 report rows for Culvert Crew A · I-5 Culverts · Tue, Oct 27/.test(x)), detail: f.join("; ").slice(0, 200) || "d-4 passed" };
});
await run("S18", "must-fail", "d-4: the d-4 plan's row missing (only another crew reported)", async () => {
  const { f } = await d4([CROW("Culvert Crew B")]);
  return { green: f.some((x) => /0 report row.*on \/app\/jobs\/24-077\/changes/.test(x)), detail: f.join("; ").slice(0, 200) || "d-4 passed" };
});
await run("S18", "must-fail", "d-4: another crew's plan duplicated on the same day (old code counted only Culvert Crew A)", async () => {
  const { f } = await d4([CROW("Culvert Crew B"), CROW("Culvert Crew B"), CROW("Culvert Crew A")]);
  return { green: f.some((x) => /2 report rows for Culvert Crew B · I-5 Culverts · Tue, Oct 27/.test(x)), detail: f.join("; ").slice(0, 200) || "d-4 passed" };
});
await run("S18", "fix", "d-4: the same crew's report on an earlier day is a different plan + day and stays", async () => {
  const { f } = await d4([CROW("Culvert Crew A", "Mon, Oct 26"), CROW("Culvert Crew A")]);
  return { green: f.length === 0, detail: f.join("; ").slice(0, 200) || "d-4 rows pass" };
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
