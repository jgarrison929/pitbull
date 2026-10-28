// 5.0.4-d checks 3, 4 and 5 (the field intel checks 2, 10, 3 and 11 that "must still pass") and 5.0.4-g check 3
// ("State is real."), driven by Verify at 390×844 in fresh sandboxes. Spec: docs/v5/specs/5.0.4-*.md at main 05cd947c
// (#80); field intel: docs/v5/intel/field-plan-and-progress.md. Observations come from the drives below; every rule is
// a pure evaluate* function with must-fails in field504-eval.test.mjs.
//
// Verify's readings where the spec names no selector:
// - The plan is Cedar Creek's (25-031) first `plan-card` with a visible `submit-plan` after Reset demo, keyed by its
//   `data-plan-id`; its line 04-210 is the pour the field intel checks use (report-mh-04-210 / report-qty-04-210).
// - Live gain/loss is `report-gl-04-210`: "Earned 19.2 MH", "Actual 22.0 MH" and "−2.8 MH" (U+2212 or "-").
// - d-5 posted quantity (Planner ruling relayed by lead 2026-10-27, spec PR pending): on /app/jobs/25-031/cost-items/04-210
//   the Installed headline (`cost-item-installed`, its first "<qty> <unit>") stays at the claimed 248 CY, before and after
//   the approval. The +12 CY shows on `cost-item-qty-since-lock`: after the approval, as the superintendent, PM, executive
//   and foreman, it is visible, `data-qty-milli` is exactly "12000", and its text is exactly "+12 CY posted since Period N
//   lock". When "Period <n> lock" appears elsewhere in `main`, every such n equals N. The line is never rendered at 0
//   (or less), on any reading. The old "headline rises +12" rule is gone.
// - d-4 (Planner ruling 2026-10-27, #86): as the foreman on /app/jobs/24-077. A report row is an `li` in
//   `job-changes-full` on /app/jobs/24-077/changes matching /Reported Culvert Crew A's work on I-5 Culverts for /
//   (the dailyReport.post summary in server/assistant/actions.ts). S11: the old /Reported day's work/ is the
//   assistant's action label, not the /changes wording, so it always counted 0.
// - d-4 dedupe key (Planner ruling relayed by lead 2026-10-27, spec PR pending): one report row per (plan, day). The row
//   has no data attributes (change-log-list.tsx renders `<li>` with the summary text), so the key is read from the
//   summary "Reported <crew>'s work on <job short name> for <day>: …" (actions.ts dailyReport.post, day = en-US
//   "Tue, Oct 27" in UTC). daily_plans is unique on (job, crew, plan date) (schema.ts daily_plans_job_crew_date_uidx), so
//   on one job's /changes page crew + day names exactly one plan + day. The d-4 plan's day is its plan-card
//   `data-plan-date` formatted the same way.
// - Demo path steps are the `li` elements in `[data-testid="demo-path"]`, in order. A step is done when the li (or a
//   descendant) has data-done="true", data-state="done" or data-status="done", or contains a visible element whose
//   data-testid ends in "-done". Step text is never judged: copy like "Done when 26-010 is approved" is not a done mark.
// - d-4: a manual Retry is acceptable and an automatic resend is not required. Offline, Report day's work must leave a
//   visible `report-unsent` holding a `report-retry` "Retry" button; it survives a reload once back online; a
//   double-click on Retry gives exactly 1 post and 1 report row per plan + day. An automatic resend that gives exactly 1
//   post and 1 report row per plan + day with no Retry press also passes. A post is a POST with a Next-Action header that got a response.
import { changesPath, contextFor, signInRole } from "./crawl.mjs";
import { resetDemo } from "./numbers.mjs";
import { confirmIfDialog } from "./confirm-dialog.mjs";

const T = 15000;
export const FIELD_JOB = "25-031";
export const FIELD_CODE = "04-210";
export const FIELD_QTY = "12";
export const FIELD_MH = "22.0";
export const FIELD_GL = { earned: "19.2", actual: "22.0", gl: "2.8" };
export const OFFLINE_JOB = "24-077";
/** S11 / #86: the /changes summary the app writes for dailyReport.post ("Reported <crew>'s work on <job> for <date>: …"). */
export const REPORTED_ROW = /Reported Culvert Crew A's work on I-5 Culverts for /;
/** The d-4 plan's crew and job short name, as the /changes summary names them. */
export const OFFLINE_CREW = "Culvert Crew A";
export const OFFLINE_JOB_NAME = "I-5 Culverts";
/** dailyReport.post summary: "Reported <crew>'s work on <job> for <Ddd, Mmm d>: …". */
export const REPORT_KEY = /Reported (.+?)'s work on (.+?) for ([A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}):/;
/** The day as actions.ts writes it: `day(iso)` = en-US weekday short, month short, day numeric, UTC. */
export function reportDay(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ""))) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
/**
 * Report rows on /changes grouped by (plan, day): crew + job + day from the summary. A row that says "Reported …'s work
 * on" without a readable day is `unreadable` (never silently dropped).
 */
export function reportRowKeys(texts) {
  const counts = new Map();
  const unreadable = [];
  for (const t of texts ?? []) {
    const s = String(t ?? "").replace(/\s+/g, " ");
    const m = REPORT_KEY.exec(s);
    if (m) { const k = `${m[1]} · ${m[2]} · ${m[3]}`; counts.set(k, (counts.get(k) ?? 0) + 1); }
    else if (/\bReported .+'s work on /.test(s)) unreadable.push(s.slice(0, 80));
  }
  return { counts, unreadable };
}
/** Rows (li texts) on /changes that are a report of the d-4 plan. */
export function countReportRows(texts, re = REPORTED_ROW) {
  return (texts ?? []).filter((t) => re.test(String(t ?? ""))).length;
}
const SIZE = { width: 390, height: 844 };

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

async function open(page, base, p) {
  await page.goto(base + p, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
}
const card = (page, id) => page.locator(`[data-testid="plan-card"][data-plan-id="${id}"]:visible`).first();
async function planStatus(page, id) {
  const c = card(page, id);
  return (await c.count()) ? { visible: true, status: await c.getAttribute("data-status") } : { visible: false, status: null };
}
/** Every `li` text in job-changes-full (reportRowKeys groups them by plan + day). */
export async function reportedRows(page, base, job = OFFLINE_JOB) {
  await open(page, base, changesPath(job));
  return page.evaluate(() => [...document.querySelectorAll('[data-testid="job-changes-full"] li')].map((li) => (li.innerText ?? "").replace(/\s+/g, " ").trim()));
}
export const FIELD_CLAIMED = { qty: 248, unit: "CY" };
export const FIELD_QTY_MILLI = 12000;
/** In-page d-5 reading of the 04-210 cost item page: Installed headline, the qty since-lock line, other "Period n lock" mentions. */
export const QTY_PROBE = () => {
  const LINE = '[data-testid="cost-item-qty-since-lock"]';
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const one = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  // Text of a subtree without the since-lock line, text nodes joined by spaces (so "Installed" "248 CY" stay apart).
  const textOf = (root) => {
    const parts = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement?.closest(LINE)) parts.push(n.nodeValue);
    return one(parts.join(" "));
  };
  const inst = document.querySelector('[data-testid="cost-item-installed"]');
  const lines = [...document.querySelectorAll(LINE)];
  const line = lines.find(vis) ?? lines[0] ?? null;
  const main = document.querySelector("main") ?? document.body;
  const periods = [...textOf(main).matchAll(/Period (\d+) lock/g)].map((m) => Number(m[1]));
  return {
    path: location.pathname,
    installed: inst ? textOf(inst) : null,
    line: { count: lines.length, visible: vis(line), rawQty: line?.getAttribute("data-qty-milli") ?? null, text: line ? one(line.innerText) : null },
    periods: [...new Set(periods)],
  };
};
async function costItemReading(page, base) {
  await open(page, base, `/app/jobs/${FIELD_JOB}/cost-items/${FIELD_CODE}`);
  return page.evaluate(QTY_PROBE);
}
/** Roles that read the d-5 line after the approval: every role, foreman included. */
export const QTY_AFTER_ROLES = ["superintendent", "pm", "executive", "foreman"];
/** The working plan: first visible plan-card with a visible submit-plan. */
async function draftPlanId(page, base) {
  await open(page, base, `/app/jobs/${FIELD_JOB}`);
  return page.evaluate(() => {
    const vis = (e) => e && e.getClientRects().length > 0;
    const c = [...document.querySelectorAll('[data-testid="plan-card"]')].find((x) => vis(x) && vis(x.querySelector('[data-testid="submit-plan"]')));
    return c?.getAttribute("data-plan-id") ?? null;
  });
}
async function newSandbox(browser, base, role) {
  const ctx = await browser.newContext(contextFor(SIZE.width, SIZE.height, "light"));
  const page = await ctx.newPage();
  await signInRole(page, base, role);
  await resetDemo(page, base);
  return { ctx, page };
}
async function submitPlan(page, id) {
  await card(page, id).locator('[data-testid="submit-plan"]:visible').first().click({ timeout: T });
  await confirmIfDialog(page, { settled: page.locator(`[data-testid="plan-card"][data-plan-id="${id}"][data-status="issued"]:visible`), timeout: T });
}
async function fillReport(page, id) {
  const c = card(page, id);
  await c.getByTestId(`report-mh-${FIELD_CODE}`).first().fill(FIELD_MH);
  await c.getByTestId(`report-qty-${FIELD_CODE}`).first().fill(FIELD_QTY);
}

/** d-3 then d-5: super issues, foreman sees it issued, enters 12 CY / 22.0 MH (live G/L), reports, super approves, posted qty. */
export async function issueReportApproveFlow(browser, base) {
  const out = { steps: [] };
  const { ctx, page } = await newSandbox(browser, base, "superintendent");
  try {
    out.planId = await draftPlanId(page, base);
    if (!out.planId) { out.error = "no draft plan-card with a visible submit-plan on 25-031"; return out; }
    out.qtyBefore = await costItemReading(page, base);
    await open(page, base, `/app/jobs/${FIELD_JOB}`);
    await submitPlan(page, out.planId);
    out.superAfter = await planStatus(page, out.planId);
    out.steps.push("super submit");
    await signInRole(page, base, "foreman");
    await open(page, base, `/app/jobs/${FIELD_JOB}`);
    out.foremanSees = await planStatus(page, out.planId);
    out.steps.push("foreman sees");
    await fillReport(page, out.planId);
    await page.waitForTimeout(300);
    const gl = card(page, out.planId).getByTestId(`report-gl-${FIELD_CODE}`).first();
    out.liveGl = (await gl.count()) ? oneLine(await gl.innerText()) : null;
    out.steps.push("live G/L");
    await open(page, base, `/app/jobs/${FIELD_JOB}`);
    await fillReport(page, out.planId);
    await card(page, out.planId).getByTestId("report-work").first().click({ timeout: T });
    await page.locator(`[data-testid="plan-card"][data-plan-id="${out.planId}"][data-status="reported"]:visible`).first().waitFor({ timeout: T }).catch(() => {});
    out.afterReport = await planStatus(page, out.planId);
    out.steps.push("report");
    await signInRole(page, base, "superintendent");
    await open(page, base, `/app/jobs/${FIELD_JOB}`);
    await card(page, out.planId).getByTestId("approve-report").first().click({ timeout: T });
    await confirmIfDialog(page, { settled: page.locator(`[data-testid="plan-card"][data-plan-id="${out.planId}"][data-status="approved"]:visible`), timeout: T });
    out.afterApprove = await planStatus(page, out.planId);
    out.qtyAfter = {};
    for (const role of QTY_AFTER_ROLES) {
      if (role !== "superintendent") await signInRole(page, base, role);
      out.qtyAfter[role] = await costItemReading(page, base);
    }
    out.steps.push("approve + posted qty");
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

/** d-4 (#86): foreman on 24-077, offline Report day's work, then an automatic resend or reload + one Retry. */
export async function offlineRetryFlow(browser, base) {
  const out = { steps: [], job: OFFLINE_JOB };
  const { ctx, page } = await newSandbox(browser, base, "foreman");
  // Every write, with whether it reached the server (got a response) or failed (offline / aborted).
  const posts = [];
  page.on("request", (r) => {
    if (r.method() !== "POST" || !r.headers()["next-action"]) return;
    const p = { url: r.url().replace(base, ""), reached: null };
    posts.push(p);
    r.response().then((res) => { p.reached = !!res; p.status = res?.status() ?? null; }, () => { p.reached = false; });
  });
  const reachedSince = (mark) => posts.slice(mark).filter((p) => p.reached === true && p.status < 400).length;
  const unsent = async () => page.evaluate(() => {
    const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
    const u = [...document.querySelectorAll('[data-testid="report-unsent"]')].find(vis) ?? null;
    const retry = u ? [...u.querySelectorAll('[data-testid="report-retry"]')].find(vis) ?? null : null;
    return { unsent: !!u, retry: !!retry, retryTag: retry?.tagName ?? null, retryText: retry ? (retry.innerText ?? "").replace(/\s+/g, " ").trim() : null };
  });
  try {
    await open(page, base, `/app/jobs/${OFFLINE_JOB}`);
    out.planId = await page.evaluate(() => {
      const vis = (e) => e && e.getClientRects().length > 0;
      const c = [...document.querySelectorAll('[data-testid="plan-card"]')].find((x) => vis(x) && vis(x.querySelector('[data-testid="report-work"]')));
      return c?.getAttribute("data-plan-id") ?? null;
    });
    if (!out.planId) { out.error = `no plan-card with a visible report-work on ${OFFLINE_JOB}`; return out; }
    out.planDate = await page.evaluate((id) => document.querySelector(`[data-testid="plan-card"][data-plan-id="${id}"]`)?.getAttribute("data-plan-date") ?? null, out.planId);
    out.rowsBefore = await reportedRows(page, base);
    await open(page, base, `/app/jobs/${OFFLINE_JOB}`);
    const c = card(page, out.planId);
    for (const loc of await c.locator('[data-testid^="report-qty-"]:visible').all()) await loc.fill(FIELD_QTY);
    for (const loc of await c.locator('[data-testid^="report-mh-"]:visible').all()) await loc.fill(FIELD_MH);
    const mark = posts.length;
    await ctx.setOffline(true);
    await c.getByTestId("report-work").first().click({ timeout: T });
    await page.waitForTimeout(2000);
    out.queued = await unsent();
    out.offlineReached = reachedSince(mark);
    out.steps.push("offline submit");
    await ctx.setOffline(false);
    await page.waitForTimeout(3000);
    out.autoPosts = reachedSince(mark);
    out.steps.push("back online");
    if (out.autoPosts > 0) {
      // An automatic resend: judged on its own posts and rows; the reload and Retry steps are skipped.
      out.mode = "auto";
    } else {
      out.mode = "retry";
      await page.reload({ waitUntil: "load" });
      await page.waitForLoadState("networkidle").catch(() => {});
      out.afterReload = { ...(await unsent()), status: (await planStatus(page, out.planId)).status };
      out.steps.push("reload");
      const retry = page.locator('[data-testid="report-unsent"]:visible [data-testid="report-retry"]:visible').first();
      if (await retry.count()) {
        const rmark = posts.length;
        await retry.dblclick({ timeout: T });
        await page.locator(`[data-testid="plan-card"][data-plan-id="${out.planId}"][data-status="reported"]:visible`).first().waitFor({ timeout: T }).catch(() => {});
        await page.waitForLoadState("networkidle").catch(() => {});
        await page.waitForTimeout(1000);
        out.retryPosts = reachedSince(rmark);
        out.afterRetry = { ...(await unsent()), status: (await planStatus(page, out.planId)).status };
        out.steps.push("retry");
      }
    }
    out.rowsAfter = await reportedRows(page, base);
    out.steps.push("rows");
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    out.posts = posts.map((p) => ({ ...p }));
    await ctx.setOffline(false).catch(() => {});
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

/** g-3: the PM approves the 26-010 estimate; demo-path steps 1 and 2 show done. */
export async function demoStateFlow(browser, base) {
  const out = { steps: [] };
  const { ctx, page } = await newSandbox(browser, base, "pm");
  try {
    await open(page, base, "/app/jobs/26-010");
    await page.getByTestId("approve-estimate").first().click({ timeout: T });
    await confirmIfDialog(page, { settled: page.locator('[data-testid="estimate-status"][data-status="approved"]'), timeout: T });
    out.estimateStatus = await page.evaluate(() => document.querySelector('[data-testid="estimate-status"]')?.getAttribute("data-status") ?? null);
    out.steps.push("approve estimate");
    await open(page, base, "/app");
    out.demoPath = await page.evaluate(() => {
      const panel = [...document.querySelectorAll('[data-testid="demo-path"]')].find((e) => e.getClientRects().length > 0);
      if (!panel) return { missing: true };
      // Raw marks only; demoStepDone judges them (never the text).
      const marks = (li) => [li, ...li.querySelectorAll("*")].map((e) => ({ done: e.getAttribute("data-done"), state: e.getAttribute("data-state"), status: e.getAttribute("data-status"), testid: e.getAttribute("data-testid"), visible: e.getClientRects().length > 0 })).filter((m) => m.done != null || m.state != null || m.status != null || m.testid != null);
      return { steps: [...panel.querySelectorAll("li")].map((li) => ({ text: (li.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 80), marks: marks(li) })) };
    });
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

const glHas = (text, re) => re.test(String(text ?? "").replace(/\u2212/g, "-"));

/** First "<qty> <unit>" in the Installed card text ("Installed 248 CY 300 CY budgeted" → { qty: 248, unit: "CY" }). */
export function headlineQty(text) {
  const m = /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{1,4})\b/.exec(String(text ?? ""));
  return m ? { qty: Number(m[1].replace(/,/g, "")), unit: m[2] } : null;
}
const LINE_TEXT = new RegExp(`^\\+${FIELD_QTY} CY posted since Period (\\d+) lock$`);
/**
 * d-5 posted quantity (Planner ruling relayed by lead 2026-10-27, spec PR pending). `before` is the superintendent's
 * reading before the plan is issued; `after` maps role → reading after the approval. Returns failure lines.
 */
export function postedQtyFailures(before, after) {
  const f = [];
  const claimed = `${FIELD_CLAIMED.qty} ${FIELD_CLAIMED.unit}`;
  const at = `${FIELD_CODE} cost item`;
  const hb = headlineQty(before?.installed);
  if (!hb) f.push(`${at}, before: cost-item-installed headline unreadable ("${before?.installed ?? null}")`);
  else if (hb.qty !== FIELD_CLAIMED.qty || hb.unit !== FIELD_CLAIMED.unit) f.push(`${at}, before: Installed headline ${hb.qty} ${hb.unit} (want the claimed ${claimed})`);
  // "The line must NOT render when nothing has been posted since the lock (qty 0)": never at 0 or less, on any reading.
  const zero = (r, who) => {
    const l = r?.line;
    if (l?.count > 0 && !(/^\d+$/.test(String(l.rawQty ?? "").trim()) && Number(l.rawQty) > 0)) f.push(`${at}, ${who}: cost-item-qty-since-lock is rendered with data-qty-milli ${JSON.stringify(l.rawQty)} (want no line at 0 or less)`);
  };
  zero(before, "before");
  for (const role of QTY_AFTER_ROLES) {
    const r = after?.[role];
    const who = `${role} after the approval`;
    if (!r) { f.push(`${at}, ${who}: not read`); continue; }
    zero(r, who);
    const ha = headlineQty(r.installed);
    if (!ha) f.push(`${at}, ${who}: cost-item-installed headline unreadable ("${r.installed ?? null}")`);
    else if (ha.qty !== FIELD_CLAIMED.qty || ha.unit !== FIELD_CLAIMED.unit || (hb && (ha.qty !== hb.qty || ha.unit !== hb.unit))) f.push(`${at}, ${who}: Installed headline ${hb ? `${hb.qty} ${hb.unit}` : "?"} → ${ha.qty} ${ha.unit} (want unchanged at the claimed ${claimed})`);
    const l = r.line ?? {};
    if (!l.count) { f.push(`${at}, ${who}: cost-item-qty-since-lock missing (want "+${FIELD_QTY} CY posted since Period N lock", data-qty-milli ${FIELD_QTY_MILLI})`); continue; }
    if (!l.visible) f.push(`${at}, ${who}: cost-item-qty-since-lock is not visible`);
    if (String(l.rawQty ?? "").trim() !== String(FIELD_QTY_MILLI)) f.push(`${at}, ${who}: cost-item-qty-since-lock data-qty-milli ${JSON.stringify(l.rawQty)} (want "${FIELD_QTY_MILLI}")`);
    const m = LINE_TEXT.exec(String(l.text ?? ""));
    if (!m) f.push(`${at}, ${who}: cost-item-qty-since-lock reads "${l.text}" (want exactly "+${FIELD_QTY} CY posted since Period N lock")`);
    else {
      const other = (r.periods ?? []).filter((n) => n !== Number(m[1]));
      if (other.length) f.push(`${at}, ${who}: cost-item-qty-since-lock names Period ${m[1]}, but the page also says Period ${other.join(", ")} lock (want the same lock period)`);
    }
  }
  return f;
}

/** d-3 (field intel check 2) and d-5 (field intel checks 3 and 11). */
export function evaluateIssueReportApprove(r) {
  const f3 = [], f5 = [];
  if (r.error) (r.steps.includes("foreman sees") ? f5 : f3).push(`${r.error} (after ${r.steps.join(", ") || "nothing"})`);
  if (r.steps.includes("super submit")) {
    if (r.superAfter?.status !== "issued") f3.push(`superintendent submit: plan ${r.planId} is "${r.superAfter?.status}" (want issued)`);
  } else if (!r.error) f3.push("superintendent submit not run");
  if (r.steps.includes("foreman sees")) {
    if (!r.foremanSees?.visible) f3.push(`foreman at 390×844 does not see plan ${r.planId}`);
    else if (r.foremanSees.status !== "issued") f3.push(`foreman sees plan ${r.planId} as "${r.foremanSees.status}" (want issued)`);
  } else if (!r.error) f3.push("foreman view not run");
  if (r.steps.includes("live G/L")) {
    if (r.liveGl == null) f5.push(`report-gl-${FIELD_CODE} missing`);
    else {
      if (!glHas(r.liveGl, new RegExp(`Earned ${FIELD_GL.earned.replace(".", "\\.")} MH`))) f5.push(`live G/L "${r.liveGl}" lacks "Earned ${FIELD_GL.earned} MH"`);
      if (!glHas(r.liveGl, new RegExp(`Actual ${FIELD_GL.actual.replace(".", "\\.")} MH`))) f5.push(`live G/L "${r.liveGl}" lacks "Actual ${FIELD_GL.actual} MH"`);
      if (!glHas(r.liveGl, new RegExp(`(^|\\s)-${FIELD_GL.gl.replace(".", "\\.")} MH`))) f5.push(`live G/L "${r.liveGl}" lacks "−${FIELD_GL.gl} MH" (a loss)`);
    }
  } else if (!r.error) f5.push("live G/L not run");
  if (r.steps.includes("report") && r.afterReport?.status !== "reported") f5.push(`after Report day's work plan ${r.planId} is "${r.afterReport?.status}" (want reported)`);
  if (r.steps.includes("approve + posted qty")) {
    if (r.afterApprove?.status !== "approved") f5.push(`after approve plan ${r.planId} is "${r.afterApprove?.status}" (want approved)`);
    f5.push(...postedQtyFailures(r.qtyBefore, r.qtyAfter));
  } else if (!r.error) f5.push("approval and posted quantity not run");
  return { "d-3": f3, "d-5": f5 };
}

/** d-4 (field intel check 10, Planner ruling 2026-10-27 #86). */
export function evaluateOfflineRetry(r) {
  const f = [];
  if (r.error) f.push(`${r.error} (after ${r.steps.join(", ") || "nothing"})`);
  // Planner ruling relayed by lead 2026-10-27 (spec PR pending): exactly one report row per (plan, day) key, so a second
  // crew's report on the same day stays and passes. rowsBefore is evidence only.
  const rowsF = () => {
    const out = [];
    if (!Array.isArray(r.rowsAfter)) return [`report rows on /app/jobs/24-077/changes unreadable (${JSON.stringify(r.rowsAfter)})`];
    const { counts, unreadable } = reportRowKeys(r.rowsAfter);
    for (const u of unreadable) out.push(`report row with no readable plan + day on /app/jobs/24-077/changes: "${u}"`);
    for (const [k, n] of counts) if (n !== 1) out.push(`${n} report rows for ${k} on /app/jobs/24-077/changes (want exactly 1 per plan + day)`);
    const day = reportDay(r.planDate);
    if (!day) out.push(`plan ${r.planId} data-plan-date ${JSON.stringify(r.planDate ?? null)} unreadable (the d-4 plan + day key is unknown)`);
    else {
      const k = `${OFFLINE_CREW} · ${OFFLINE_JOB_NAME} · ${day}`;
      const n = counts.get(k) ?? 0;
      if (n === 0) out.push(`0 report rows for ${k} on /app/jobs/24-077/changes (want exactly 1; ${Array.isArray(r.rowsBefore) ? countReportRows(r.rowsBefore) : "?"} ${OFFLINE_CREW} row(s) before the offline submit)`);
    }
    return out;
  };
  if (r.steps.includes("offline submit") && r.offlineReached > 0) f.push(`${r.offlineReached} post(s) reached the server while offline (want 0)`);
  if (r.mode === "auto") {
    if (r.autoPosts !== 1) f.push(`automatic resend: ${r.autoPosts} post(s) (want exactly 1)`);
  } else if (r.mode === "retry") {
    const q = r.queued ?? {};
    if (!q.unsent) f.push("offline: no visible report-unsent (no visible unsent state)");
    else if (!q.retry) f.push("offline: report-unsent holds no visible report-retry");
    else if (q.retryText !== "Retry" || q.retryTag !== "BUTTON") f.push(`offline: report-retry is ${q.retryTag} "${q.retryText}" (want a button "Retry")`);
    const a = r.afterReload;
    if (!r.steps.includes("reload")) { if (!r.error) f.push("reload not run"); }
    else {
      if (!a?.unsent || !a?.retry) f.push(`after reload: the queued report is lost (report-unsent ${a?.unsent ? "visible" : "gone"}, report-retry ${a?.retry ? "visible" : "gone"})`);
      if (a?.status !== "issued") f.push(`after reload: plan ${r.planId} is "${a?.status}" (want issued)`);
    }
    if (!r.steps.includes("retry")) { if (!r.error && r.steps.includes("reload")) f.push("Retry not pressed: no visible report-retry after the reload"); }
    else {
      if (r.retryPosts !== 1) f.push(`a double-click on Retry: ${r.retryPosts} post(s) (want exactly 1)`);
      if (r.afterRetry?.status !== "reported") f.push(`after Retry plan ${r.planId} is "${r.afterRetry?.status}" (want reported)`);
      if (r.afterRetry?.unsent) f.push("after Retry: report-unsent is still visible");
    }
  } else if (!r.error) f.push("back-online step not run");
  if (!r.steps.includes("rows")) { if (!r.error) f.push("report rows not counted"); }
  else f.push(...rowsF());
  return f;
}

/** A demo-path step is done only by a done mark on the li or a descendant, or a visible [data-testid$="-done"]; never by its text. */
export function demoStepDone(step) {
  return (step?.marks ?? []).some((m) => m.done === "true" || m.state === "done" || m.status === "done" || (m.visible === true && /-done$/.test(m.testid ?? "")));
}

/** g-3. */
export function evaluateDemoState(r) {
  const f = [];
  if (r.error) f.push(`g-3: ${r.error} (after ${r.steps.join(", ") || "nothing"})`);
  if (r.steps.includes("approve estimate") && r.estimateStatus !== "approved") f.push(`g-3: 26-010 estimate-status "${r.estimateStatus}" after approve (want approved)`);
  const d = r.demoPath;
  if (!d) { if (!r.error) f.push("g-3: demo path not read"); return f; }
  if (d.missing) { f.push("g-3: demo-path missing"); return f; }
  for (const i of [0, 1]) {
    const s = d.steps?.[i];
    if (!s) f.push(`g-3: demo-path has no step ${i + 1}`);
    else if (!demoStepDone(s)) f.push(`g-3: step ${i + 1} "${s.text}" is not done`);
  }
  return f;
}

export async function runField504(browser, base) {
  return { flow: await issueReportApproveFlow(browser, base), offline: await offlineRetryFlow(browser, base), demo: await demoStateFlow(browser, base) };
}

export function evaluateField504(o) {
  const ira = evaluateIssueReportApprove(o.flow);
  return {
    "5.0.4-d check 3 (field intel check 2): superintendent issues, foreman sees it issued at 390×844": ira["d-3"],
    "5.0.4-d check 4 (field intel check 10): offline report survives a reload, one Retry (or one automatic resend) posts exactly once": evaluateOfflineRetry(o.offline),
    "5.0.4-d check 5 (field intel checks 3 and 11): live G/L 19.2 / 22.0 / −2.8 MH and posted quantity": ira["d-5"],
    "5.0.4-g check 3: State is real (26-010 approved → demo-path steps 1 and 2 done)": evaluateDemoState(o.demo),
  };
}
