// 5.0.4-e check 6, "AC stays at the cutoff after an approval." Spec: docs/v5/specs/5.0.4-*.md, PR #89 (main 9497f7e9).
// At 1280×800, light, after Reset demo, on /app/jobs/24-118, with the seeded `reported` plan for Interchange Crew 1:
// - Before: as the PM, job-actual [data-cents], the job-cpi-index text, job-eac data-cents, and job-ac-since-lock
//   data-cents (0 when absent). As the superintendent, the approved report's cost is the sum of data-cents over
//   [data-testid="cost-tree-scroll"] [data-testid^="approval-pending-"], and it must be more than 0.
// - Approve: as the superintendent, approve-report on that plan, confirm the dialog (confirmIfDialog: the write's
//   response status, then the posted state, S10), then reload.
// - After, as the superintendent, the PM and the executive: job-ac-since-lock is visible, its data-cents equals before
//   + the approved cost to the cent, and its innerText (whitespace collapsed) equals
//   `+<usdCents(data-cents)> posted since Period 1 lock`.
// - Unchanged, as the PM: job-actual, job-cpi-index text, job-eac exactly as before.
// - Foreman: job-ac-since-lock count 0.
// - "When the amount is $0, or less, the line is not rendered": any reading with the line present and data-cents ≤ 0
//   fails (the before readings after reset included).
// Verify's readings where the spec names no selector: job-actual [data-cents] is the element's own data-cents, else
// its first [data-cents] descendant outside job-ac-since-lock (the card's primary figure). The plan is the visible
// plan-card with data-status="reported" whose text contains "Interchange Crew 1" and that holds a visible
// approve-report.
import { contextFor, signInRole } from "./crawl.mjs";
import { resetDemo } from "./numbers.mjs";
import { confirmIfDialog } from "./confirm-dialog.mjs";

const T = 15000;
export const E6_NAME = "5.0.4-e check 6: AC stays at the cutoff after an approval (24-118, 1280×800, light)";
export const E6_JOB = "24-118";
export const E6_CREW = "Interchange Crew 1";
export const E6_PERIOD = "Period 1";
export const E6_SIZE = { width: 1280, height: 800 };
export const E6_AFTER_ROLES = ["superintendent", "pm", "executive"];

/** usdCents from v5/src/lib/ev.ts: "$1,240.00" (U+2212 for negatives). */
export function usdCents(cents) {
  const a = Math.abs(cents);
  const s = `$${Math.trunc(a / 100).toLocaleString("en-US")}.${String(a % 100).padStart(2, "0")}`;
  return cents < 0 ? `−${s}` : s;
}
/** The exact since-lock text for an amount. */
export const sinceLockText = (cents, period = E6_PERIOD) => `+${usdCents(cents)} posted since ${period} lock`;

/** In-page reading of the 24-118 job page. */
export const E6_PROBE = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const int = (v) => (v == null || v === "" || !/^-?\d+$/.test(String(v).trim()) ? null : Number(v));
  const one = (s) => (s ?? "").replace(/\s+/g, " ").trim();
  const actualEl = document.querySelector('[data-testid="job-actual"]');
  let actual = null;
  if (actualEl) {
    if (actualEl.hasAttribute("data-cents")) actual = int(actualEl.getAttribute("data-cents"));
    else {
      const d = [...actualEl.querySelectorAll("[data-cents]")].find((e) => !e.closest('[data-testid="job-ac-since-lock"]'));
      actual = d ? int(d.getAttribute("data-cents")) : null;
    }
  }
  const lines = [...document.querySelectorAll('[data-testid="job-ac-since-lock"]')];
  const line = lines.find(vis) ?? lines[0] ?? null;
  const pending = [...document.querySelectorAll('[data-testid="cost-tree-scroll"] [data-testid^="approval-pending-"]')];
  return {
    path: location.pathname,
    actual,
    cpiText: document.querySelector('[data-testid="job-cpi-index"]') ? one(document.querySelector('[data-testid="job-cpi-index"]').innerText) : null,
    eac: int(document.querySelector('[data-testid="job-eac"]')?.getAttribute("data-cents")),
    since: { count: lines.length, visible: vis(line), cents: line ? int(line.getAttribute("data-cents")) : null, rawCents: line?.getAttribute("data-cents") ?? null, text: line ? one(line.innerText) : null },
    pending: { count: pending.length, cents: pending.map((e) => int(e.getAttribute("data-cents"))), codes: pending.map((e) => e.getAttribute("data-testid").replace(/^approval-pending-/, "")) },
  };
};

async function read(page, base) {
  await page.goto(`${base}/app/jobs/${E6_JOB}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  return page.evaluate(E6_PROBE);
}

/** One sandbox (one context; each role signs in to it in turn). */
export async function runE6(browser, base) {
  const out = { steps: [], before: {}, after: {} };
  const ctx = await browser.newContext(contextFor(E6_SIZE.width, E6_SIZE.height, "light"));
  const page = await ctx.newPage();
  try {
    await signInRole(page, base, "pm");
    await resetDemo(page, base);
    out.before.pm = await read(page, base);
    out.steps.push("pm before");
    await signInRole(page, base, "superintendent");
    out.before.superintendent = await read(page, base);
    out.steps.push("superintendent before");
    out.planId = await page.evaluate((crew) => {
      const vis = (e) => !!e && e.getClientRects().length > 0;
      const c = [...document.querySelectorAll('[data-testid="plan-card"][data-status="reported"]')].find((x) => vis(x) && (x.innerText ?? "").includes(crew) && vis(x.querySelector('[data-testid="approve-report"]')));
      return c?.getAttribute("data-plan-id") ?? null;
    }, E6_CREW);
    if (!out.planId) { out.error = `no visible reported plan-card for ${E6_CREW} with approve-report on /app/jobs/${E6_JOB}`; return out; }
    const card = page.locator(`[data-testid="plan-card"][data-plan-id="${out.planId}"]:visible`).first();
    await card.locator('[data-testid="approve-report"]:visible').first().click({ timeout: T });
    const r = await confirmIfDialog(page, { settled: page.locator(`[data-testid="plan-card"][data-plan-id="${out.planId}"][data-status="approved"]`), timeout: T });
    out.approve = { dialog: r.dialog, writes: r.writes ?? null };
    out.steps.push("approve");
    await page.reload({ waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    out.after.superintendent = await page.evaluate(E6_PROBE);
    for (const role of ["pm", "executive", "foreman"]) {
      await signInRole(page, base, role);
      out.after[role] = await read(page, base);
    }
    out.steps.push("after");
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

const isCents = (x) => Number.isInteger(x);

/**
 * Shared e-6 readings (spec #89), also used by journey504.mjs's super-approve done state.
 * The approved report's cost: the sum of the superintendent's `approval-pending-*` data-cents (an E6_PROBE `pending`
 * reading). Returns { cents, failure }: cents is the sum (null when a data-cents is unreadable; 0 when there is no
 * approval-pending element), and failure says why when the sum is missing, unreadable or ≤ 0 (null when it is > 0).
 */
export function approvedCost(pending, who = "superintendent before") {
  const pend = pending ?? { count: 0, cents: [] };
  const list = Array.isArray(pend.cents) ? pend.cents : [];
  const sum = list.every(isCents) ? list.reduce((s, x) => s + x, 0) : null;
  if (!pend.count) return { cents: sum, failure: `${who}: no [data-testid^="approval-pending-"] in cost-tree-scroll (the approved report's cost is unreadable)` };
  if (sum == null) return { cents: null, failure: `${who}: approval-pending data-cents unreadable (${JSON.stringify(list)})` };
  if (!(sum > 0)) return { cents: sum, failure: `${who}: approval-pending sum ${sum}¢ (want > 0)` };
  return { cents: sum, failure: null };
}

/** job-ac-since-lock data-cents before the approval: 0 when the line is absent (spec #89). */
export const sinceLockBefore = (reading) => (reading?.since?.count > 0 ? reading.since.cents : 0);

/** "When the amount is $0, or less, the line is not rendered." Failure line or null for one E6_PROBE reading. */
export function sinceLockZeroFailure(reading, label) {
  const s = reading?.since;
  return s?.count > 0 && !(isCents(s.cents) && s.cents > 0) ? `${label}: job-ac-since-lock is rendered with data-cents ${JSON.stringify(s.rawCents)} (want no line at $0 or less)` : null;
}

/**
 * After the approval, for one role that sees the AC card: job-ac-since-lock is visible, its data-cents equals
 * beforeSince + approved to the cent, and its text is exactly sinceLockText(data-cents). `label` prefixes each line.
 */
export function sinceLockAfterFailures(since, label, beforeSince, approved) {
  const f = [];
  const want = approved != null ? beforeSince + approved : null;
  if (!since || since.count === 0) return [`${label}: job-ac-since-lock missing (want ${want == null ? "?" : `${want}¢`})`];
  if (!since.visible) f.push(`${label}: job-ac-since-lock is not visible`);
  if (want != null && since.cents !== want) f.push(`${label}: job-ac-since-lock data-cents ${since.rawCents} (want ${beforeSince} + ${approved} = ${want}¢)`);
  if (isCents(since.cents) && since.text !== sinceLockText(since.cents)) f.push(`${label}: job-ac-since-lock reads "${since.text}" (want "${sinceLockText(since.cents)}")`);
  return f;
}

/** Pure rule for runE6's observations. Returns failure lines (empty = PASS). */
export function evaluateE6(o) {
  const f = [];
  if (o.error) f.push(`${o.error} (after ${o.steps?.join(", ") || "nothing"})`);
  const b = o.before ?? {};
  const a = o.after ?? {};
  // "When the amount is $0, or less, the line is not rendered." Checked on every reading.
  for (const [when, set] of [["before", b], ["after", a]]) {
    for (const [role, r] of Object.entries(set)) {
      const z = sinceLockZeroFailure(r, `${when}, ${role}`);
      if (z) f.push(z);
    }
  }
  if (!o.steps?.includes("superintendent before")) return f.length ? f : ["before readings not taken"];
  const beforeSince = sinceLockBefore(b.pm);
  const ac = approvedCost(b.superintendent?.pending);
  const approved = ac.cents;
  if (ac.failure) f.push(ac.failure);
  for (const k of ["actual", "eac"]) if (!isCents(b.pm?.[k])) f.push(`pm before: job-${k} data-cents unreadable`);
  if (!b.pm?.cpiText) f.push("pm before: job-cpi-index unreadable");
  if (!o.steps.includes("after")) return f;
  for (const role of E6_AFTER_ROLES) f.push(...sinceLockAfterFailures(a[role]?.since, `${role} after approval`, beforeSince, approved));
  const pa = a.pm ?? {};
  if (pa.actual !== b.pm?.actual) f.push(`pm: job-actual ${b.pm?.actual}¢ → ${pa.actual}¢ after the approval (want unchanged until the next lock)`);
  if (pa.cpiText !== b.pm?.cpiText) f.push(`pm: job-cpi-index "${b.pm?.cpiText}" → "${pa.cpiText}" after the approval (want unchanged)`);
  if (pa.eac !== b.pm?.eac) f.push(`pm: job-eac ${b.pm?.eac}¢ → ${pa.eac}¢ after the approval (want unchanged)`);
  if (!a.foreman) f.push("foreman after approval: not read");
  else if (a.foreman.since.count !== 0) f.push(`foreman: job-ac-since-lock count ${a.foreman.since.count} ("${a.foreman.since.text}"; want 0)`);
  return f;
}
