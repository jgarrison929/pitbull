#!/usr/bin/env node
// Live must-fail probes for the PR #65 ConfirmDialog on CO-001 approve (25-031), against a running app.
// Signs in as the PM with crawl.mjs signInRole and reads totals with numbers.mjs jobState, the same
// functions the M4/M5 drive uses. Each run uses a fresh browser context (a fresh visitor sandbox).
//
//   --mode dialog-required  Click Approve and do NOT confirm. PASS (exit 0) only when the alertdialog
//                           opened, is still open after --hold-ms, no server action posted, and CO-001
//                           status, CB/EAC/OB and the job's change count are unchanged. On main before
//                           #65 the click posts at once, so this reports "dialog absent" and exits 1.
//   --mode mutant-no-confirm  The pre-#65 drive (click Approve, wait for the approved card, no confirm),
//                           judged by evaluateM5. On #65's head it must exit 1 (TIMEOUT or no budget
//                           change). On main before #65 it exits 0.
//   --mode cancel           Click Approve, then the dialog's Cancel (confirm-dialog-cancel). PASS only
//                           when the dialog hid, no server action posted, and CO-001 status, CB/EAC/OB,
//                           the change count and the newest change line are unchanged. No dialog = exit 1.
//   --mode control          runM4M5 itself (with confirmIfDialog), judged by evaluateM5. Exit 0 on both.
//
// Exit 0 = PASS, 1 = FAIL (the probe's own assertion), 2 = harness error (bad args, crash, unreachable).
// Usage: node .cursor/skills/verify-v5/confirm-dialog.mustfail.mjs --url http://localhost:3100 --mode cancel
//        [--timeout 30000] [--hold-ms 3000] [--out result.json]
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { evaluateM5, M5_CO_CENTS } from "./checks.mjs";
import { CONFIRM_DIALOG_CANCEL, CONFIRM_DIALOG_ROLE, watchForDialog } from "./confirm-dialog.mjs";
import { changesPath, signInRole } from "./crawl.mjs";
import { jobState, resetDemo, runM4M5 } from "./numbers.mjs";
import { isLocalUrl } from "./target-guard.mjs";

for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (error) => {
    console.error(`confirm-dialog must-fail: harness error: ${String(error?.message ?? error).split("\n")[0]}`);
    process.exit(2);
  });
}

export const MODES = ["dialog-required", "mutant-no-confirm", "cancel", "control"];
const JOB = "25-031";
const CO = "CO-001";

const { values: args } = parseArgs({
  options: {
    url: { type: "string" },
    mode: { type: "string" },
    timeout: { type: "string", default: "30000" },
    "hold-ms": { type: "string", default: "3000" },
    out: { type: "string" },
  },
});
if (!args.url || !MODES.includes(args.mode)) {
  console.error(`usage: --url URL --mode ${MODES.join("|")} [--timeout ms] [--hold-ms ms] [--out file]`);
  process.exit(2);
}
// Local only (target-guard.mjs): this tool never runs against staging or production.
if (!isLocalUrl(args.url)) {
  console.error(`refused: ${args.url} is not localhost; this tool runs only against a local app`);
  process.exit(2);
}
const base = args.url.replace(/\/$/, "");
const T = Number(args.timeout);
const HOLD = Number(args["hold-ms"]);

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "../../../v5/package.json"));
const { chromium } = require("@playwright/test");

// The card by its user-facing label ("CO-001 · …"), as runM4M5 finds it.
const byLabel = (page, loc) => loc.filter({ has: page.locator("h3", { hasText: new RegExp(`^\\s*${CO} ·`) }) });
const coCard = (page) => byLabel(page, page.getByTestId("co-card")).first();
const approvedCard = (page) => byLabel(page, page.locator('[data-testid="co-card"][data-status="approved"]')).first();

/** Total change count from /changes ("N changes" / "No changes yet"); null when unreadable. */
async function changeCount(page) {
  await page.goto(`${base}${changesPath(JOB)}`, { waitUntil: "networkidle" });
  const text = (await page.locator("main").innerText().catch(() => "")) ?? "";
  if (/\bNo changes yet\b/.test(text)) return 0;
  const m = text.match(/\b(\d[\d,]*) changes?\b/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** CO-001 + totals + change list, read in `page` (navigates). */
async function readState(page) {
  const s = await jobState(page, base, JOB);
  const card = coCard(page);
  const coStatus = (await card.count()) ? await card.getAttribute("data-status") : null;
  const coCents = (await card.count()) ? Number(await card.getAttribute("data-total-cents")) : null;
  // Each change line as "<who> · <summary> @ <time datetime>" (the rendered local time is left out).
  const lines = await page
    .$$eval('[data-testid="job-changes"] li', (els) =>
      els.map((li) => {
        const t = li.querySelector("time");
        const text = [...li.childNodes].filter((n) => n !== t && !(n.nodeType === 1 && n.contains(t))).map((n) => n.textContent).join("");
        return `${text.replace(/\s+/g, " ").trim()} @ ${t?.getAttribute("datetime") ?? "?"}`;
      }),
    )
    .catch(() => []);
  const newest = lines[0] ?? "";
  const coLines = lines.filter((t) => t.includes(CO)).length;
  const changes = await changeCount(page);
  return { coStatus, coCents, ob: s.original, cb: s.current, ev: s.ev, ac: s.ac, eac: s.eac, changes, newest, coLines };
}

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

function unchanged(before, after) {
  const f = [];
  if (after.coStatus !== before.coStatus) f.push(`${CO} status ${before.coStatus} → ${after.coStatus}`);
  for (const k of ["ob", "cb", "eac"]) if (after[k] !== before[k]) f.push(`${k} ${before[k]}¢ → ${after[k]}¢`);
  if (after.changes === null || before.changes === null) f.push("change count unreadable");
  else if (after.changes !== before.changes) f.push(`changes ${before.changes} → ${after.changes} (an event was added)`);
  if (after.coLines !== before.coLines) f.push(`${CO} change lines ${before.coLines} → ${after.coLines}`);
  if (after.newest !== before.newest) f.push(`newest change "${before.newest}" → "${after.newest}"`);
  return f;
}

function precondition(before) {
  const f = [];
  if (before.coStatus !== "priced") f.push(`precondition: ${CO} is ${before.coStatus}, want priced`);
  if (before.coCents !== M5_CO_CENTS) f.push(`precondition: ${CO} total ${before.coCents}¢, want ${M5_CO_CENTS}¢`);
  return f;
}

async function probe(browser, mode) {
  if (mode === "control") {
    const o = await runM4M5(browser, base, {});
    const m5 = evaluateM5(o);
    return { ok: m5.failures.length === 0, detail: `runM4M5 + confirmIfDialog: ΔCB ${m5.deltas.cb}¢, ΔEAC ${m5.deltas.eac}¢, ΔOB ${m5.deltas.ob}¢` + (m5.failures.length ? ` — ${m5.failures.join("; ")}` : ""), observed: o };
  }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const net = watchPosts(ctx);
  try {
    await signInRole(page, base, "pm");
    const before = await readState(page);
    const pre = precondition(before);
    if (pre.length) return { ok: false, detail: pre.join("; "), before };
    await page.goto(`${base}/app/jobs/${JOB}`, { waitUntil: "networkidle" });
    const trigger = coCard(page).getByRole("button", { name: /^Approve$/ });
    const dialog = page.getByRole(CONFIRM_DIALOG_ROLE);

    if (mode === "mutant-no-confirm") {
      // The pre-#65 drive from runM4M5, unchanged: click, then wait for the approved card.
      const t0 = Date.now();
      await trigger.click();
      let timedOut = false;
      try {
        await approvedCard(page).waitFor({ timeout: T });
      } catch {
        timedOut = true;
      }
      const waitedMs = Date.now() - t0;
      const dialogOpen = await dialog.isVisible().catch(() => false);
      const reader = await ctx.newPage();
      const after = await readState(reader);
      await resetDemo(reader, base);
      const afterReset = await readState(reader);
      const m5 = evaluateM5({ before, after, afterReset, coCents: before.coCents });
      const ok = !timedOut && m5.failures.length === 0;
      const why = [timedOut ? `TIMEOUT: no approved ${CO} card after ${waitedMs} ms` : null, m5.deltas.cb === 0 && m5.deltas.eac === 0 ? "no budget change (ΔCB 0¢, ΔEAC 0¢)" : null, ...m5.failures].filter(Boolean);
      return { ok, detail: `old drive (no confirm): ${CO} ${before.coStatus} → ${after.coStatus}, ΔCB ${m5.deltas.cb}¢, ΔEAC ${m5.deltas.eac}¢, dialog left open ${dialogOpen}` + (why.length ? ` — ${why.join("; ")}` : ""), before, after, afterReset, waitedMs, timedOut, dialogOpen };
    }

    net.arm();
    await trigger.click();
    const w = await watchForDialog(page, { settled: approvedCard(page), timeout: T });
    if (w.outcome !== "dialog") {
      net.disarm();
      const reason = w.outcome === "settled" ? `${CO} approved on the click with no dialog (posted ${net.posts.length} server action(s))` : `no dialog and no approved card within ${T} ms`;
      const reader = await ctx.newPage();
      await resetDemo(reader, base);
      return { ok: false, detail: `dialog absent: ${reason}`, dialogPresent: false, outcome: w.outcome, posts: net.posts, before };
    }

    if (mode === "dialog-required") {
      await page.waitForTimeout(HOLD);
      const stillOpen = await dialog.isVisible();
      const reader = await ctx.newPage();
      const after = await readState(reader);
      const stillOpenAfterRead = await dialog.isVisible();
      net.disarm();
      const f = unchanged(before, after);
      if (!stillOpen || !stillOpenAfterRead) f.push(`dialog closed without confirm (open after ${HOLD} ms ${stillOpen}, after the state read ${stillOpenAfterRead})`);
      if (net.posts.length) f.push(`${net.posts.length} server action POST(s) without confirm: ${net.posts.join(", ")}`);
      await dialog.getByTestId(CONFIRM_DIALOG_CANCEL).click({ timeout: T }).catch(() => {});
      await resetDemo(reader, base);
      return { ok: f.length === 0, detail: `dialog present, not confirmed for ${HOLD} ms: ${CO} ${before.coStatus} → ${after.coStatus}, CB ${before.cb}¢ → ${after.cb}¢, EAC ${before.eac}¢ → ${after.eac}¢, changes ${before.changes} → ${after.changes}, server action POSTs ${net.posts.length}` + (f.length ? ` — ${f.join("; ")}` : ""), dialogPresent: true, before, after, posts: net.posts };
    }

    // mode === "cancel"
    const f = [];
    try {
      await dialog.getByTestId(CONFIRM_DIALOG_CANCEL).click({ timeout: T });
      await dialog.waitFor({ state: "hidden", timeout: T });
    } catch (e) {
      f.push(`cancel failed: ${String(e?.message ?? e).split("\n")[0]}`);
    }
    await page.waitForTimeout(HOLD);
    net.disarm();
    const reader = await ctx.newPage();
    const after = await readState(reader);
    f.push(...unchanged(before, after));
    if (net.posts.length) f.push(`${net.posts.length} server action POST(s) after Cancel: ${net.posts.join(", ")}`);
    await resetDemo(reader, base);
    return { ok: f.length === 0, detail: `Cancel: ${CO} ${before.coStatus} → ${after.coStatus}, CB ${before.cb}¢ → ${after.cb}¢, EAC ${before.eac}¢ → ${after.eac}¢, changes ${before.changes} → ${after.changes}, server action POSTs ${net.posts.length}` + (f.length ? ` — ${f.join("; ")}` : ""), dialogPresent: true, before, after, posts: net.posts };
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
}
console.log(`confirm-dialog must-fail ${args.mode}: ${r.ok ? "PASS" : "FAIL"} — ${r.detail}`);
if (args.out) writeFileSync(args.out, JSON.stringify({ mode: args.mode, url: base, ...r }, null, 2));
process.exit(r.ok ? 0 : 1);
