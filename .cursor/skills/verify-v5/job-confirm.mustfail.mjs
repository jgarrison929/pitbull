#!/usr/bin/env node
// Live must-fail probes for the PR #71 ConfirmDialog on the job page's Approve estimate (26-010) and
// Lock Period (25-031), against a running app. Sibling of confirm-dialog.mustfail.mjs (CO-001, PR #65).
// Signs in as the PM with crawl.mjs signInRole, reads totals with numbers.mjs jobState, and runs the
// real M2 drive (numbers.mjs runM2 + confirmIfDialog) for the estimate control. Each run uses a fresh
// browser context (a fresh visitor sandbox) and resets the demo afterwards.
//
//   --target estimate | lock
//   --mode dialog-required  Click the trigger and do NOT confirm. PASS (exit 0) only when the alertdialog
//                           opened with the expected title / confirm label (estimate: and body), is still
//                           open after --hold-ms and after a state read in a second tab, no server action
//                           posted, and the state is unchanged. Without #71 the click posts at once, so
//                           this reports "dialog absent" and exits 1.
//   --mode mutant-no-confirm  The pre-#71 click path (click, wait for the posted state, no confirm; T =
//                           --timeout). On #71 it must exit 1 with a TIMEOUT. Without #71 it exits 0.
//   --mode cancel           Click, then the dialog's Cancel. PASS only when the dialog hid, no server action
//                           posted, and the state is unchanged (and, with --db, every company-scoped DB
//                           table is byte-identical before and after). No dialog = exit 1.
//   --mode control          estimate: runM2 itself (with confirmIfDialog), judged by evaluateM2 against
//                           fixtures/m2-awkward-expected.json (exact totals). lock: click + confirmIfDialog,
//                           then Period 2 must be locked. Exit 0 with or without #71.
//   --db                    Also fingerprint the session company's rows in every public table with a
//                           company_id column (count + md5), read with DATABASE_URL (db-url.mjs). Tables that
//                           change on a plain page read are listed as volatile and left out of the compare.
//
// Exit 0 = PASS, 1 = FAIL (the probe's own assertion), 2 = harness error (bad args, crash, unreachable).
// Usage: node .cursor/skills/verify-v5/job-confirm.mustfail.mjs --url http://localhost:3100 --target estimate
//        --mode cancel [--db] [--timeout 30000] [--hold-ms 3000] [--out result.json]
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { evaluateM2 } from "./checks.mjs";
import { CONFIRM_DIALOG_CANCEL, CONFIRM_DIALOG_CONFIRM, CONFIRM_DIALOG_ROLE, confirmIfDialog, watchForDialog } from "./confirm-dialog.mjs";
import { changesPath, signInRole } from "./crawl.mjs";
import { parsePostgresUrl } from "./db-url.mjs";
import { jobState, resetDemo, runM2 } from "./numbers.mjs";
import { isLocalUrl, localDbGate } from "./target-guard.mjs";

for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (error) => {
    console.error(`job-confirm must-fail: harness error: ${String(error?.message ?? error).split("\n")[0]}`);
    process.exit(2);
  });
}

export const MODES = ["dialog-required", "mutant-no-confirm", "cancel", "control"];
export const TARGETS = {
  estimate: {
    job: "26-010",
    trigger: (page) => page.getByTestId("approve-estimate"),
    settled: (page) => page.locator('[data-testid="estimate-status"][data-status="approved"]'),
    expect: {
      title: "Approve estimate on 26-010?",
      body: "Current Estimate $86,750.00 becomes Current Budget, and Original Budget freezes at that amount. This cannot be undone.",
      confirm: "Approve estimate",
    },
  },
  lock: {
    job: "25-031",
    trigger: (page) => page.getByTestId("lock-claim"),
    settled: (page) => page.locator('[data-testid="job-changes"] li', { hasText: /Locked Period 2\b/ }).first(),
    expect: { title: "Lock Period 2 on 25-031?", body: null, confirm: "Lock period" },
  },
};

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    target: { type: "string" },
    mode: { type: "string" },
    db: { type: "boolean", default: false },
    timeout: { type: "string", default: "30000" },
    "hold-ms": { type: "string", default: "3000" },
    out: { type: "string" },
  },
});
if (!args.url || !MODES.includes(args.mode) || !TARGETS[args.target]) {
  console.error(`usage: --url URL --target ${Object.keys(TARGETS).join("|")} --mode ${MODES.join("|")} [--db] [--timeout ms] [--hold-ms ms] [--out file]`);
  process.exit(2);
}
// Local only (target-guard.mjs): this tool never runs against staging or production.
if (!isLocalUrl(args.url)) {
  console.error(`refused: ${args.url} is not localhost; this tool runs only against a local app`);
  process.exit(2);
}
const dbGate = process.env.DATABASE_URL ? await localDbGate(process.env.DATABASE_URL, { env: process.env }) : { ok: true };
if (!dbGate.ok) {
  console.error(`refused: ${dbGate.reason} (host not shown); this tool runs only against a local DB`);
  process.exit(2);
}
const base = args.url.replace(/\/$/, "");
const T = Number(args.timeout);
const HOLD = Number(args["hold-ms"]);
const X = TARGETS[args.target];
const JOB = X.job;

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");

let sql = null;
if (args.db) {
  const p = parsePostgresUrl(process.env.DATABASE_URL);
  if (!p) {
    console.error("job-confirm must-fail: harness error: --db needs a postgres DATABASE_URL");
    process.exit(2);
  }
  sql = require("postgres")(p.connectionString, { max: 1, onnotice: () => {} });
}

/** Total change count from /changes ("N changes" / "No changes yet"); null when unreadable. */
async function changeCount(page) {
  await page.goto(`${base}${changesPath(JOB)}`, { waitUntil: "networkidle" });
  const text = (await page.locator("main").innerText().catch(() => "")) ?? "";
  if (/\bNo changes yet\b/.test(text)) return 0;
  const m = text.match(/\b(\d[\d,]*) changes?\b/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** Totals, estimate status, lock trigger and change list, read in `page` (navigates). */
async function readState(page) {
  const s = await jobState(page, base, JOB);
  const status = page.getByTestId("estimate-status").first();
  const estimateStatus = (await status.count()) ? await status.getAttribute("data-status") : null;
  const lock = page.getByTestId("lock-claim").first();
  const lockLabel = (await lock.count()) ? (await lock.innerText()).replace(/\s+/g, " ").trim() : null;
  const lines = await page
    .$$eval('[data-testid="job-changes"] li', (els) =>
      els.map((li) => {
        const t = li.querySelector("time");
        const text = [...li.childNodes].filter((n) => n !== t && !(n.nodeType === 1 && n.contains(t))).map((n) => n.textContent).join("");
        return `${text.replace(/\s+/g, " ").trim()} @ ${t?.getAttribute("datetime") ?? "?"}`;
      }),
    )
    .catch(() => []);
  const changes = await changeCount(page);
  return {
    estimateStatus, lockLabel, ob: s.original, cb: s.current, ce: s.estimate, eac: s.eac, changes,
    newest: lines[0] ?? "", approvedLines: lines.filter((t) => /Approved the estimate/i.test(t)).length,
    lockedLines: lines.filter((t) => /Locked Period 2\b/.test(t)).length,
  };
}

function unchanged(before, after) {
  const f = [];
  for (const k of ["estimateStatus", "lockLabel", "ob", "cb", "ce", "eac", "approvedLines", "lockedLines", "newest"]) {
    if (after[k] !== before[k]) f.push(`${k} ${JSON.stringify(before[k])} → ${JSON.stringify(after[k])}`);
  }
  if (after.changes === null || before.changes === null) f.push("change count unreadable");
  else if (after.changes !== before.changes) f.push(`changes ${before.changes} → ${after.changes} (an event was added)`);
  return f;
}

function precondition(before) {
  if (args.target === "estimate") {
    const f = [];
    if (before.estimateStatus !== "draft") f.push(`precondition: 26-010 estimate is ${before.estimateStatus}, want draft`);
    if (before.ce !== 8_675_000) f.push(`precondition: 26-010 Current Estimate ${before.ce}¢, want 8675000¢`);
    return f;
  }
  return /Period 2\b/.test(before.lockLabel ?? "") ? [] : [`precondition: lock trigger reads ${JSON.stringify(before.lockLabel)}, want "Lock Period 2"`];
}

async function companyId(ctx) {
  const ck = (await ctx.cookies()).find((c) => c.name === "pcs_session");
  if (!ck) throw new Error("no pcs_session cookie after sign-in");
  const [s] = await sql`select company_id from sessions where id = ${createHash("sha256").update(ck.value).digest("hex")}`;
  if (!s) throw new Error("session row not found for the signed-in visitor");
  return s.company_id;
}

/** { table: "rows:md5" } over every public table with a company_id column, for one company. */
async function fingerprint(cid) {
  const tables = (await sql`select table_name from information_schema.columns where column_name = 'company_id' and table_schema = 'public' order by 1`).map((r) => r.table_name);
  const o = {};
  for (const t of tables) {
    const [r] = await sql.unsafe(`select count(*)::int n, md5(coalesce(string_agg(x::text, '|' order by x::text), '')) h from "${t.replace(/"/g, '""')}" x where company_id = $1`, [cid]);
    o[t] = `${r.n}:${r.h}`;
  }
  return o;
}
const diffKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();

function watchPosts(ctx) {
  const origin = new URL(base).origin;
  const posts = [];
  let armed = false;
  ctx.on("request", (r) => {
    if (!armed || r.method() !== "POST") return;
    let same = false;
    try { same = new URL(r.url()).origin === origin; } catch { same = false; }
    const action = Object.keys(r.headers()).some((k) => k.toLowerCase() === "next-action");
    if (same && action) posts.push(new URL(r.url()).pathname);
  });
  return { arm: () => { armed = true; }, disarm: () => { armed = false; }, posts };
}

/** Title, body and confirm label of the open dialog vs the expected #71 copy. */
async function dialogWords(dialog) {
  const title = (await dialog.locator("h2, [id$='-title'], [data-slot='alert-dialog-title']").first().innerText().catch(() => "")).trim();
  const body = (await dialog.locator("p, [id$='-description'], [data-slot='alert-dialog-description']").first().innerText().catch(() => "")).trim();
  const confirm = (await dialog.getByTestId(CONFIRM_DIALOG_CONFIRM).innerText().catch(() => "")).trim();
  const all = (await dialog.innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const f = [];
  if (!all.includes(X.expect.title)) f.push(`dialog title: want "${X.expect.title}", dialog reads "${all}"`);
  if (X.expect.body && !all.includes(X.expect.body)) f.push(`dialog body: want "${X.expect.body}", dialog reads "${all}"`);
  if (confirm !== X.expect.confirm) f.push(`confirm label "${confirm}", want "${X.expect.confirm}"`);
  return { title, body, confirm, all, failures: f };
}

async function controlLock(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  try {
    await signInRole(page, base, "pm");
    const before = await readState(page);
    const pre = precondition(before);
    if (pre.length) return { ok: false, detail: pre.join("; "), before };
    await page.goto(`${base}/app/jobs/${JOB}`, { waitUntil: "networkidle" });
    await X.trigger(page).click();
    const c = await confirmIfDialog(page, { settled: X.settled(page), timeout: T });
    await X.settled(page).waitFor({ timeout: T });
    const after = await readState(page);
    const f = [];
    if (after.lockedLines !== before.lockedLines + 1) f.push(`"Locked Period 2" change lines ${before.lockedLines} → ${after.lockedLines}, want +1`);
    if (/Period 2\b/.test(after.lockLabel ?? "")) f.push(`lock trigger still reads ${JSON.stringify(after.lockLabel)}`);
    if (after.changes !== before.changes + 1) f.push(`changes ${before.changes} → ${after.changes}, want +1`);
    for (const k of ["ob", "cb", "eac"]) if (after[k] !== before[k]) f.push(`${k} ${before[k]}¢ → ${after[k]}¢ (locking must not move money)`);
    await resetDemo(page, base);
    return { ok: f.length === 0, detail: `click + confirmIfDialog (dialog ${c.dialog}): lock trigger ${JSON.stringify(before.lockLabel)} → ${JSON.stringify(after.lockLabel)}, changes ${before.changes} → ${after.changes}, "Locked Period 2" lines ${before.lockedLines} → ${after.lockedLines}, OB/CB/EAC unchanged ${f.every((x) => !/¢/.test(x))}` + (f.length ? ` — ${f.join("; ")}` : ""), dialog: c, before, after };
  } finally {
    await ctx.close();
  }
}

async function probe(browser, mode) {
  if (mode === "control" && args.target === "estimate") {
    const expected = JSON.parse(readFileSync(path.join(here, "fixtures/m2-awkward-expected.json"), "utf8"));
    const o = await runM2(browser, base, { csv: path.join(here, "fixtures/m2-awkward-estimate.csv") });
    const r = evaluateM2(o, expected);
    return { ok: r.failures.length === 0, detail: `runM2 + confirmIfDialog: original ${o.original}¢, current ${o.current}¢, estimate ${o.estimate}¢ (want ${expected.total}¢), ${r.mismatches.length} per-code mismatches of ${Object.keys(expected.tree).length}` + (r.failures.length ? ` — ${r.failures.join("; ")}` : ""), observed: o };
  }
  if (mode === "control") return controlLock(browser);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const net = watchPosts(ctx);
  try {
    await signInRole(page, base, "pm");
    const before = await readState(page);
    const pre = precondition(before);
    if (pre.length) return { ok: false, detail: pre.join("; "), before };
    await page.goto(`${base}/app/jobs/${JOB}`, { waitUntil: "networkidle" });
    const trigger = X.trigger(page);
    const dialog = page.getByRole(CONFIRM_DIALOG_ROLE);

    if (mode === "mutant-no-confirm") {
      // The pre-#71 click path: click, then wait for the posted state (runM2's old waitForFunction / the lock line).
      const t0 = Date.now();
      await trigger.click();
      let timedOut = false;
      try {
        await X.settled(page).waitFor({ timeout: T });
      } catch {
        timedOut = true;
      }
      const waitedMs = Date.now() - t0;
      const dialogOpen = await dialog.isVisible().catch(() => false);
      const reader = await ctx.newPage();
      const after = await readState(reader);
      await resetDemo(reader, base);
      const moved = unchanged(before, after);
      return { ok: !timedOut, detail: `old click path (no confirm): ${timedOut ? `TIMEOUT: posted state not seen after ${waitedMs} ms` : `posted in ${waitedMs} ms`}, dialog left open ${dialogOpen}, state ${moved.length ? `changed (${moved.join("; ")})` : "unchanged"}`, before, after, waitedMs, timedOut, dialogOpen };
    }

    let cid = null, fp0 = null, fp1 = null;
    if (sql) {
      cid = await companyId(ctx);
      fp0 = await fingerprint(cid);
      await page.reload({ waitUntil: "networkidle" });
      fp1 = await fingerprint(cid);
    }
    const volatile = sql ? diffKeys(fp0, fp1) : [];

    net.arm();
    await trigger.click();
    const w = await watchForDialog(page, { settled: X.settled(page), timeout: T });
    if (w.outcome !== "dialog") {
      net.disarm();
      const reason = w.outcome === "settled" ? `${args.target} posted on the click with no dialog (posted ${net.posts.length} server action(s))` : `no dialog and no posted state within ${T} ms`;
      const reader = await ctx.newPage();
      await resetDemo(reader, base);
      return { ok: false, detail: `dialog absent: ${reason}`, dialogPresent: false, outcome: w.outcome, posts: net.posts, before };
    }
    const words = await dialogWords(dialog);

    if (mode === "dialog-required") {
      await page.waitForTimeout(HOLD);
      const stillOpen = await dialog.isVisible();
      const fp2 = sql ? await fingerprint(cid) : null;
      const reader = await ctx.newPage();
      const after = await readState(reader);
      const stillOpenAfterRead = await dialog.isVisible();
      net.disarm();
      const f = [...words.failures, ...unchanged(before, after)];
      if (!stillOpen || !stillOpenAfterRead) f.push(`dialog closed without confirm (open after ${HOLD} ms ${stillOpen}, after the state read ${stillOpenAfterRead})`);
      if (net.posts.length) f.push(`${net.posts.length} server action POST(s) without confirm: ${net.posts.join(", ")}`);
      const dbChanged = sql ? diffKeys(fp1, fp2).filter((t) => !volatile.includes(t)) : [];
      if (dbChanged.length) f.push(`DB rows changed while the dialog was open: ${dbChanged.join(", ")}`);
      await dialog.getByTestId(CONFIRM_DIALOG_CANCEL).click({ timeout: T }).catch(() => {});
      await resetDemo(reader, base);
      return { ok: f.length === 0, detail: `dialog present ("${words.title}" / confirm "${words.confirm}"), not confirmed for ${HOLD} ms: estimate ${before.estimateStatus} → ${after.estimateStatus}, CB ${before.cb}¢ → ${after.cb}¢, lock ${JSON.stringify(before.lockLabel)} → ${JSON.stringify(after.lockLabel)}, changes ${before.changes} → ${after.changes}, server action POSTs ${net.posts.length}${sql ? `, DB tables changed ${dbChanged.length} (volatile on a read: ${volatile.join(", ") || "none"})` : ""}` + (f.length ? ` — ${f.join("; ")}` : ""), dialogPresent: true, words, before, after, posts: net.posts, db: sql ? { volatile, fpBefore: fp1, fpAfter: fp2 } : null };
    }

    // mode === "cancel"
    const f = [...words.failures];
    try {
      await dialog.getByTestId(CONFIRM_DIALOG_CANCEL).click({ timeout: T });
      await dialog.waitFor({ state: "hidden", timeout: T });
    } catch (e) {
      f.push(`cancel failed: ${String(e?.message ?? e).split("\n")[0]}`);
    }
    await page.waitForTimeout(HOLD);
    net.disarm();
    const fp2 = sql ? await fingerprint(cid) : null;
    const reader = await ctx.newPage();
    const after = await readState(reader);
    f.push(...unchanged(before, after));
    if (net.posts.length) f.push(`${net.posts.length} server action POST(s) after Cancel: ${net.posts.join(", ")}`);
    const dbChanged = sql ? diffKeys(fp1, fp2).filter((t) => !volatile.includes(t)) : [];
    if (dbChanged.length) f.push(`DB rows changed after Cancel: ${dbChanged.join(", ")}`);
    await resetDemo(reader, base);
    return { ok: f.length === 0, detail: `Cancel ("${words.title}"): estimate ${before.estimateStatus} → ${after.estimateStatus}, OB ${before.ob}¢ → ${after.ob}¢, CB ${before.cb}¢ → ${after.cb}¢, lock ${JSON.stringify(before.lockLabel)} → ${JSON.stringify(after.lockLabel)}, changes ${before.changes} → ${after.changes}, server action POSTs ${net.posts.length}${sql ? `, DB: ${Object.keys(fp1).length} company tables, ${dbChanged.length} changed (volatile on a read: ${volatile.join(", ") || "none"})` : ""}` + (f.length ? ` — ${f.join("; ")}` : ""), dialogPresent: true, words, before, after, posts: net.posts, db: sql ? { volatile, fpBefore: fp1, fpAfter: fp2 } : null };
  } finally {
    await ctx.close();
  }
}

const browser = await chromium.launch();
let r;
try {
  r = await probe(browser, args.mode);
} finally {
  await browser.close();
  if (sql) await sql.end({ timeout: 5 });
}
console.log(`job-confirm must-fail ${args.target} ${args.mode}: ${r.ok ? "PASS" : "FAIL"} — ${r.detail}`);
if (args.out) writeFileSync(args.out, JSON.stringify({ target: args.target, mode: args.mode, url: base, ...r }, null, 2));
process.exit(r.ok ? 0 : 1);
