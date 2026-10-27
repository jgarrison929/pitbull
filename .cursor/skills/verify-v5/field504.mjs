// 5.0.4-d checks 3, 4 and 5 (the field intel checks 2, 10, 3 and 11 that "must still pass") and 5.0.4-g check 3
// ("State is real."), driven by Verify at 390×844 in fresh sandboxes. Spec: docs/v5/specs/5.0.4-*.md at main 05cd947c
// (#80); field intel: docs/v5/intel/field-plan-and-progress.md. Observations come from the drives below; every rule is
// a pure evaluate* function with must-fails in field504-eval.test.mjs.
//
// Verify's readings where the spec names no selector:
// - The plan is Cedar Creek's (25-031) first `plan-card` with a visible `submit-plan` after Reset demo, keyed by its
//   `data-plan-id`; its line 04-210 is the pour the field intel checks use (report-mh-04-210 / report-qty-04-210).
// - Live gain/loss is `report-gl-04-210`: "Earned 19.2 MH", "Actual 22.0 MH" and "−2.8 MH" (U+2212 or "-").
// - The posted quantity is `cost-item-installed` on /app/jobs/25-031/cost-items/04-210: after approval it reads 12 more
//   than before the report.
// - A reported submission on the server is an `li` in `job-changes-full` on /app/jobs/25-031/changes matching
//   /Reported day's work/ (the dailyReport.post label), counted against the count before the submit.
// - Demo path steps are the `li` elements in `[data-testid="demo-path"]`, in order. A step is done when the li (or a
//   descendant) has data-done="true", data-state="done" or data-status="done", or its text has the word "Done".
import { changesPath, contextFor, signInRole } from "./crawl.mjs";
import { resetDemo } from "./numbers.mjs";
import { confirmIfDialog } from "./confirm-dialog.mjs";

const T = 15000;
export const FIELD_JOB = "25-031";
export const FIELD_CODE = "04-210";
export const FIELD_QTY = "12";
export const FIELD_MH = "22.0";
export const FIELD_GL = { earned: "19.2", actual: "22.0", gl: "2.8" };
export const REPORTED_ROW = /Reported day's work/;
const SIZE = { width: 390, height: 844 };

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const num = (s) => { const m = String(s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

async function open(page, base, p) {
  await page.goto(base + p, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
}
const card = (page, id) => page.locator(`[data-testid="plan-card"][data-plan-id="${id}"]:visible`).first();
async function planStatus(page, id) {
  const c = card(page, id);
  return (await c.count()) ? { visible: true, status: await c.getAttribute("data-status") } : { visible: false, status: null };
}
async function reportedRows(page, base) {
  await open(page, base, changesPath(FIELD_JOB));
  return page.evaluate((src) => [...document.querySelectorAll('[data-testid="job-changes-full"] li')].filter((li) => new RegExp(src).test(li.innerText ?? "")).length, REPORTED_ROW.source);
}
async function installed(page, base) {
  await open(page, base, `/app/jobs/${FIELD_JOB}/cost-items/${FIELD_CODE}`);
  const e = page.getByTestId("cost-item-installed").first();
  return (await e.count()) ? oneLine(await e.innerText()) : null;
}
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
    out.installedBefore = await installed(page, base);
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
    out.reportedBefore = await reportedRows(page, base);
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
    out.installedAfter = await installed(page, base);
    out.steps.push("approve + posted qty");
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

/** d-4: offline submit, back online, replay the same request; exactly one reported submission. */
export async function offlineReplayFlow(browser, base) {
  const out = { steps: [], replays: [] };
  const { ctx, page } = await newSandbox(browser, base, "foreman");
  const posts = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posts.push(r); });
  try {
    out.planId = await draftPlanId(page, base);
    if (!out.planId) { out.error = "no draft plan-card with a visible submit-plan on 25-031"; return out; }
    await submitPlan(page, out.planId);
    out.reportedBefore = await reportedRows(page, base);
    await open(page, base, `/app/jobs/${FIELD_JOB}`);
    await fillReport(page, out.planId);
    const mark = posts.length;
    await ctx.setOffline(true);
    await card(page, out.planId).getByTestId("report-work").first().click({ timeout: T });
    await page.waitForTimeout(2000);
    out.offlinePosts = posts.length - mark;
    out.steps.push("offline submit");
    await ctx.setOffline(false);
    await page.waitForTimeout(3000);
    const req = posts[mark];
    if (!req) { out.error = "no report request was made while offline or after reconnecting, so there is nothing to replay"; return out; }
    const headers = Object.fromEntries(Object.entries(await req.allHeaders()).filter(([k]) => !/^(content-length|host|connection|:)/i.test(k)));
    const data = req.postDataBuffer();
    for (let i = 0; i < 2; i++) {
      const r = await page.request.fetch(req.url(), { method: "POST", headers, data, maxRedirects: 0 }).catch((e) => ({ status: () => String(e.message).split("\n")[0] }));
      out.replays.push(r.status());
    }
    out.steps.push("replay");
    out.reportedAfter = await reportedRows(page, base);
    await open(page, base, `/app/jobs/${FIELD_JOB}`);
    out.after = await planStatus(page, out.planId);
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
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
      const done = (li) => [li, ...li.querySelectorAll("*")].some((e) => e.getAttribute("data-done") === "true" || e.getAttribute("data-state") === "done" || e.getAttribute("data-status") === "done") || /\bDone\b/.test(li.innerText ?? "");
      return { steps: [...panel.querySelectorAll("li")].map((li) => ({ text: (li.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 80), done: done(li) })) };
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
    const b = num(r.installedBefore), a = num(r.installedAfter);
    if (b == null || a == null) f5.push(`cost-item-installed unreadable (before "${r.installedBefore}", after "${r.installedAfter}")`);
    else if (Math.abs(a - b - Number(FIELD_QTY)) > 1e-9) f5.push(`posted quantity on ${FIELD_CODE}: installed "${r.installedBefore}" → "${r.installedAfter}" (want +${FIELD_QTY})`);
  } else if (!r.error) f5.push("approval and posted quantity not run");
  return { "d-3": f3, "d-5": f5 };
}

/** d-4 (field intel check 10). */
export function evaluateOfflineReplay(r) {
  const f = [];
  if (r.error) f.push(`${r.error} (after ${r.steps.join(", ") || "nothing"})`);
  if (!r.steps.includes("replay")) { if (!r.error) f.push("replay not run"); return f; }
  if (r.replays.length !== 2) f.push(`${r.replays.length} replays (want 2)`);
  const delta = r.reportedAfter - r.reportedBefore;
  if (delta !== 1) f.push(`${delta} reported submission(s) after the offline submit and 2 replays (want exactly 1)`);
  if (r.after?.status !== "reported") f.push(`plan ${r.planId} is "${r.after?.status}" after the replay (want reported)`);
  return f;
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
    else if (!s.done) f.push(`g-3: step ${i + 1} "${s.text}" is not done`);
  }
  return f;
}

export async function runField504(browser, base) {
  return { flow: await issueReportApproveFlow(browser, base), offline: await offlineReplayFlow(browser, base), demo: await demoStateFlow(browser, base) };
}

export function evaluateField504(o) {
  const ira = evaluateIssueReportApprove(o.flow);
  return {
    "5.0.4-d check 3 (field intel check 2): superintendent issues, foreman sees it issued at 390×844": ira["d-3"],
    "5.0.4-d check 4 (field intel check 10): offline submit, replay, exactly one reported submission": evaluateOfflineReplay(o.offline),
    "5.0.4-d check 5 (field intel checks 3 and 11): live G/L 19.2 / 22.0 / −2.8 MH and posted quantity": ira["d-5"],
    "5.0.4-g check 3: State is real (26-010 approved → demo-path steps 1 and 2 done)": evaluateDemoState(o.demo),
  };
}
