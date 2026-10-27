// 5.0.4 "First-task journeys" (main 1381687f, the Planner's #78), all 8 rows, at 390×844 and 1280×800, one fresh
// sandbox per journey run. #78: "A **tap** is one Playwright `click` on a link, button, summary, or form control.
// Typing and scrolling are not taps. **Scroll to action** is the `window.scrollY` change needed before the target
// control is fully in the viewport." "A `ConfirmDialog` confirm click … is not a tap"; that rule is journeys.mjs
// countJourneyTaps (one confirm per action, only when confirmIfDialog saw the dialog open).
// "Every journey must also: reach its first real action in exactly 1 tap from `/app` (the next-step link); see 0
// responses with status 4xx or 5xx; end on a page with a forward link or a done state. A **dead end** is a page with
// neither a link to a next step nor a `[data-testid$="-done"]` element."
// "A link to a next step" is read as a visible `[data-testid="next-step"]` or any visible `main a[href]` to another
// /app path. #78 and #80 name no selector for a forward link; this reading is stated in SKILL.md.
import { confirmIfDialog } from "./confirm-dialog.mjs";
import { contextFor, signInRole } from "./crawl.mjs";
import { countJourneyTaps } from "./journeys.mjs";
import { resetDemo } from "./numbers.mjs";

export const JOURNEY_SIZES = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];
const T = 30000;

const cents = (page, id) => page.evaluate((x) => { const e = document.querySelector(`[data-testid="${x}"]`); const v = e?.getAttribute("data-cents") ?? e?.querySelector("[data-cents]")?.getAttribute("data-cents"); return v == null ? null : Number(v); }, id);
const planIdOf = (href) => /#plan-([^#?]+)$/.exec(href ?? "")?.[1] ?? null;
const planCard = (page, id) => page.locator(`[data-testid="plan-card"][data-plan-id="${id}"]`);
const coCard = (page, co) => page.getByTestId("co-card").filter({ has: page.locator("h3", { hasText: new RegExp(`^\\s*${co} ·`) }) }).first();

/** The #78 table. step: the next-step label regex. target(page, ctx) → locator of the action control (null: no action). */
export const JOURNEYS504 = {
  "super-submit": { role: "superintendent", name: "superintendent: submit tomorrow's Cedar plan for Bridge Crew 2", limit: 3, step: /^Submit tomorrow's plan: Bridge Crew 2 on 25-031/,
    target: (page, c) => planCard(page, c.planId).getByTestId("submit-plan"),
    settled: (page, c) => page.locator(`[data-testid="plan-card"][data-plan-id="${c.planId}"][data-status="issued"]`) },
  "super-approve": { role: "superintendent", name: "superintendent: approve the seeded 24-118 report", limit: 3, step: /^Approve .*24-118/,
    target: (page, c) => planCard(page, c.planId).getByTestId("approve-report"),
    settled: (page, c) => page.locator(`[data-testid="plan-card"][data-plan-id="${c.planId}"][data-status="approved"]`) },
  "foreman-report": { role: "foreman", name: "foreman: report today's work on 24-077", limit: 3, step: /^Report today's .*24-077/,
    target: (page, c) => planCard(page, c.planId).getByTestId("report-work"),
    settled: (page, c) => page.locator(`[data-testid="plan-card"][data-plan-id="${c.planId}"][data-status="reported"]`) },
  "foreman-submit": { role: "foreman", name: "foreman: submit tomorrow's Cedar plan for Bridge Crew 2", limit: 3, step: /^Submit tomorrow's plan: Bridge Crew 2 on 25-031/,
    target: (page, c) => planCard(page, c.planId).getByTestId("submit-plan"),
    settled: (page, c) => page.locator(`[data-testid="plan-card"][data-plan-id="${c.planId}"][data-status="issued"]`) },
  "pm-co": { role: "pm", name: "pm: approve CO-001 on 25-031", limit: 3, step: /^Approve CO-001 on 25-031/,
    target: (page) => coCard(page, "CO-001").getByTestId("co-approve"),
    settled: (page) => page.locator('[data-testid="co-card"][data-status="approved"]').filter({ has: page.locator("h3", { hasText: /^\s*CO-001 ·/ }) }).first() },
  "pm-estimate": { role: "pm", name: "pm: approve the Harbor estimate", limit: 3, step: /^Approve the estimate .*26-010/,
    target: (page) => page.getByTestId("approve-estimate"),
    settled: (page) => page.locator('[data-testid="estimate-status"][data-status="approved"]') },
  "pm-forecast": { role: "pm", name: "pm: review the forecast on the lowest-CPI cost item", limit: 2, step: /^Review the forecast on /, target: null },
  "exec-open": { role: "executive", name: "executive: open the job most at risk", limit: 2, step: /^Open /, target: null },
};

/** In-page: the scrollY change needed before el is fully in the viewport (0 when it already is). */
export const SCROLL_NEED = (el) => {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.top >= 0 && r.bottom <= vh) return 0;
  return r.bottom > vh ? Math.ceil(r.bottom - vh) : Math.floor(r.top);
};
export const DEAD_END = () => {
  const shown = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const here = location.pathname;
  const nextStep = [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).some(shown);
  const done = [...document.querySelectorAll('[data-testid$="-done"]')].some(shown);
  const forward = [...document.querySelectorAll("main a[href]")].filter(shown).some((a) => { try { const u = new URL(a.href); return u.origin === location.origin && u.pathname.startsWith("/app") && u.pathname !== here; } catch { return false; } });
  return { nextStep, done, forward, path: here };
};

/**
 * S8, one-tap hook (Planner ruling 2026-10-27, #86): the hook is `data-role` set to the signed-in role. In-page, for
 * the element `el` the journey is about to tap: the visible elements carrying `data-role="<role>"`, any other visible
 * `data-role` values, and whether `el` is the hook. Visible: a box, not display:none / visibility:hidden, and not
 * inside a closed <details> (outside its summary).
 */
export const HOOK_PROBE = (el, role) => {
  const vis = (e) => {
    if (!e || e.getClientRects().length === 0) return false;
    for (let a = e; a && a.nodeType === 1; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      if (a.tagName === "DETAILS" && !a.open && !(e.closest("summary") && e.closest("summary").parentElement === a)) return false;
    }
    return true;
  };
  const all = [...document.querySelectorAll("[data-role]")].filter(vis);
  const mine = all.filter((e) => e.getAttribute("data-role") === role);
  const label = (e) => `${e.tagName.toLowerCase()}${e.getAttribute("data-testid") ? `[data-testid="${e.getAttribute("data-testid")}"]` : ""} "${(e.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 40)}"`;
  const firstStep = [...document.querySelectorAll('[data-testid="next-step"]')].find(vis) ?? null;
  return {
    path: location.pathname,
    count: mine.length,
    firstStepIsHook: firstStep ? mine.includes(firstStep) : null,
    hooks: mine.slice(0, 6).map(label),
    others: all.filter((e) => e.getAttribute("data-role") !== role).slice(0, 6).map((e) => `${label(e)} data-role="${e.getAttribute("data-role")}"`),
    isTarget: el ? mine.includes(el) : false,
    targetRole: el ? el.getAttribute("data-role") : null,
    target: el ? label(el) : null,
  };
};

/**
 * S7: count the app's writes (POST with a Next-Action header) between start and stop only. The old counter stayed
 * attached for the rest of the run, so the cleanup Reset demo (and the foreman-submit superintendent sign-in) were
 * counted as the action's posts.
 */
export function countWrites(page) {
  const urls = [];
  const on = (r) => { if (r.method() === "POST" && r.headers()["next-action"]) urls.push(r.url()); };
  page.on("request", on);
  let stopped = false;
  return { urls, stop() { if (!stopped) { page.off("request", on); stopped = true; } return urls.length; } };
}

export async function runJourney504(browser, base, key, { width, height }) {
  const J = JOURNEYS504[key];
  const out = { key, name: J.name, role: J.role, width, height, limit: J.limit, entries: [], bad: [], posts: 0 };
  const ctx = await browser.newContext(contextFor(width, height, "light"));
  const page = await ctx.newPage();
  page.on("response", (r) => { if (r.status() >= 400) out.bad.push(`${r.status()} ${r.request().method()} ${r.url().replace(base, "")}`); });
  const tap = async (loc, label) => { await loc.click({ timeout: T }); out.entries.push({ kind: "tap", label }); };
  const c = {};
  try {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await tap(page.getByTestId(`role-${J.role}`), `role card ${J.role}`);
    await page.waitForURL(/\/app(\?|$)/, { timeout: T });
    await page.waitForLoadState("networkidle");
    const steps = await page.evaluate(() => [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).map((e) => ({ label: (e.innerText ?? "").replace(/\s+/g, " ").trim(), href: e.getAttribute("href") })));
    const idx = steps.findIndex((s) => J.step.test(s.label));
    out.stepLabels = steps.map((s) => s.label);
    if (idx < 0) { out.error = `no next-step on /app matches ${J.step}`; return out; }
    c.href = steps[idx].href;
    c.planId = planIdOf(c.href);
    if (key === "pm-co") { await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "networkidle" }).catch(() => {}); c.before = { cb: await cents(page, "job-budget"), eac: await cents(page, "job-eac") }; await page.goto(`${base}/app`, { waitUntil: "networkidle" }); }
    if (key === "super-approve") { await page.goto(`${base}/app/jobs/24-118`, { waitUntil: "networkidle" }).catch(() => {}); c.before = { ac: await cents(page, "job-actual") }; await page.goto(`${base}/app`, { waitUntil: "networkidle" }); }
    const tapsBefore = out.entries.filter((e) => e.kind === "tap").length;
    const stepLoc = page.locator('[data-testid="next-step"]:visible').nth(idx);
    // S8: the /app screen's hook, read on the next-step this journey taps.
    out.appHook = { ...(await stepLoc.evaluate(HOOK_PROBE, J.role)), tappedIndex: idx };
    await tap(stepLoc, `next step "${steps[idx].label.slice(0, 60)}"`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);
    out.landed = page.url().replace(base, "");
    // Measured: taps recorded from /app until the action control is on the landed page (checked below).
    out.firstActionTaps = out.entries.filter((e) => e.kind === "tap").length - tapsBefore;
    if (J.target) {
      const loc = J.target(page, c).first();
      out.targetFound = (await loc.count()) > 0;
      if (!out.targetFound) { out.error = `action control not found on ${out.landed}`; return out; }
      out.scrollNeed = await loc.evaluate(SCROLL_NEED);
      // S8: the action screen's hook, read on the control the tap limit counts.
      out.actionHook = await loc.evaluate(HOOK_PROBE, J.role);
      const writes = countWrites(page);
      try {
        await tap(loc, "action");
        const r = await confirmIfDialog(page, { settled: J.settled(page, c), timeout: T });
        if (r.dialog) out.entries.push({ kind: "confirm", action: key, sawOpen: true, role: r.role ?? "alertdialog", label: `confirm ${key}` });
        await J.settled(page, c).waitFor({ timeout: T });
        out.settled = true;
        await page.waitForLoadState("networkidle");
      } finally {
        out.posts = writes.stop();
        out.postUrls = writes.urls.map((u) => u.replace(base, ""));
      }
    } else {
      // S8: read-only end screens (executive, PM forecast) carry no hook.
      out.endHook = await page.evaluate(HOOK_PROBE, J.role).catch(() => null);
    }
    // Done states
    if (key === "pm-forecast") out.doneState = { costItemPage: /\/cost-items\//.test(out.landed), cb: await page.getByTestId("cost-item-cb").first().isVisible().catch(() => false) };
    if (key === "exec-open") out.doneState = await page.evaluate(() => { const vh = window.innerHeight; const inV = (e) => { if (!e || e.getClientRects().length === 0) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= vh; }; return { jobPage: /^\/app\/jobs\/[^/]+$/.test(location.pathname), kpi: inV(document.querySelector('[data-testid="job-eac"]')?.closest("[data-card]")), status: inV(document.querySelector('[data-testid="job-status"]')) }; });
    out.deadEnd = await page.evaluate(DEAD_END);
    if (key === "pm-co") { await page.reload({ waitUntil: "networkidle" }); c.after = { cb: await cents(page, "job-budget"), eac: await cents(page, "job-eac") }; out.doneState = { before: c.before, after: c.after }; }
    if (key === "super-approve") { await page.reload({ waitUntil: "networkidle" }); out.doneState = { before: c.before, after: { ac: await cents(page, "job-actual") } }; }
    if (/submit|report/.test(key) && key !== "super-approve") {
      await page.goto(`${base}/app`, { waitUntil: "networkidle" });
      const left = await page.evaluate((src) => [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).map((e) => (e.innerText ?? "").replace(/\s+/g, " ").trim()).filter((t) => new RegExp(src).test(t)), J.step.source);
      out.doneState = { itemLeft: left };
      if (key === "foreman-submit") {
        await signInRole(page, base, "superintendent");
        out.doneState.superLeft = await page.evaluate((src) => [...document.querySelectorAll('[data-testid="next-step"]')].filter((e) => e.getClientRects().length > 0).map((e) => (e.innerText ?? "").replace(/\s+/g, " ").trim()).filter((t) => new RegExp(src).test(t)), J.step.source);
      }
    }
    if (key === "super-approve") out.doneState.settled = out.settled;
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

export const CO_DELTA_CENTS = 6_000_000;

/**
 * S8 (#86 "carry the one-tap primary action hook"): on /app exactly one visible `data-role="<role>"`, on the first
 * next-step, and when this journey taps the first next-step that hook is the tapped element. On the action screen
 * exactly one visible `data-role="<role>"`, and it is the control the tap limit counts. Read-only end screens carry none.
 */
export function hookFailures(r) {
  const f = [];
  const desc = (h) => [h.hooks?.length ? `hooks: ${h.hooks.join(", ")}` : "", h.others?.length ? `other data-role: ${h.others.join(", ")}` : ""].filter(Boolean).join("; ");
  const a = r.appHook;
  if (!a) f.push("one-tap hook on /app not read");
  else {
    if (a.count !== 1) f.push(`/app has ${a.count} visible data-role="${r.role}" element(s) (want exactly 1, on the first next-step)${desc(a) ? ` (${desc(a)})` : ""}`);
    if (a.count === 1 && a.firstStepIsHook === false) f.push(`/app: the data-role="${r.role}" hook ${a.hooks?.[0] ?? ""} is not the first next-step`);
    // #86: on /app the first next-step's hook "is the only visible [data-role] element", so any other value fails too.
    if (a.others?.length) f.push(`/app has other visible data-role element(s) besides the data-role="${r.role}" hook: ${a.others.join(", ")}`);
    // #86: the PM estimate journey taps the "Approve the estimate" next-step, which carries no data-role.
    if (r.key === "pm-estimate") { if (a.targetRole != null) f.push(`/app: the "Approve the estimate" next-step carries data-role="${a.targetRole}" (#86: it carries none)`); }
    else if (a.tappedIndex === 0 && !a.isTarget) f.push(`/app: the tapped first next-step ${a.target} is not the data-role="${r.role}" hook (it has data-role=${a.targetRole == null ? "none" : `"${a.targetRole}"`})`);
  }
  if (r.targetFound) {
    const h = r.actionHook;
    if (!h) f.push("one-tap hook on the action screen not read");
    else {
      if (h.count !== 1) f.push(`action screen ${h.path} has ${h.count} visible data-role="${r.role}" element(s) (want exactly 1, on the measured action)${desc(h) ? ` (${desc(h)})` : ""}`);
      if (!h.isTarget) f.push(`action screen ${h.path}: the measured action ${h.target} is not the data-role="${r.role}" hook (it has data-role=${h.targetRole == null ? "none" : `"${h.targetRole}"`})`);
    }
  }
  if (r.endHook && r.endHook.count > 0) f.push(`read-only end screen ${r.endHook.path} carries ${r.endHook.count} data-role="${r.role}" element(s) (want none): ${r.endHook.hooks.join(", ")}`);
  return f;
}

export function evaluateJourney504(r) {
  const w = `${r.name} @${r.width}x${r.height}`;
  const f = [];
  if (r.error) return [`${w}: ${r.error}${r.stepLabels ? ` (next steps: ${r.stepLabels.join(" | ") || "none"})` : ""}`];
  const counted = countJourneyTaps(r.entries).counted;
  if (counted > r.limit) f.push(`${w}: ${counted} counted taps > ${r.limit} (${r.entries.map((e) => e.label).join(" → ")})`);
  if (r.firstActionTaps !== 1) f.push(`${w}: first real action is ${r.firstActionTaps} taps from /app (want exactly 1)`);
  if (r.scrollNeed != null && r.scrollNeed !== 0) f.push(`${w}: scroll to action ${r.scrollNeed} px (want 0 px) on ${r.landed}`);
  if (r.bad.length) f.push(`${w}: ${r.bad.length} response(s) with 4xx/5xx: ${r.bad.slice(0, 3).join("; ")}`);
  f.push(...hookFailures(r).map((x) => `${w}: ${x}`));
  const d = r.deadEnd;
  if (!d || !(d.nextStep || d.done || d.forward)) f.push(`${w}: dead end on ${d?.path ?? r.landed} (no next-step link, no forward link, no [data-testid$="-done"])`);
  const s = r.doneState ?? {};
  switch (r.key) {
    case "pm-forecast": if (!s.costItemPage || !s.cb) f.push(`${w}: done state: ${s.costItemPage ? "" : "not a cost-item page; "}${s.cb ? "" : "cost-item-cb not visible"}`.replace(/; $/, "")); break;
    case "exec-open": if (!s.jobPage || !s.kpi || !s.status) f.push(`${w}: done state: job page ${!!s.jobPage}, KPI card in viewport ${!!s.kpi}, job-status in viewport ${!!s.status}`); break;
    case "pm-co": {
      const dcb = s.after?.cb - s.before?.cb, deac = s.after?.eac - s.before?.eac;
      if (dcb !== CO_DELTA_CENTS || deac !== CO_DELTA_CENTS) f.push(`${w}: done state: ΔCB ${dcb}¢, ΔEAC ${deac}¢ (want +${CO_DELTA_CENTS} each)`);
      break;
    }
    case "super-approve":
      if (!(s.after?.ac > s.before?.ac)) f.push(`${w}: done state: job-actual ${s.before?.ac} → ${s.after?.ac} (want a rise)`);
      if (r.posts !== 1) f.push(`${w}: approve posted ${r.posts} time(s) (want once: "AC on its cost items rises once")`);
      break;
    default:
      if (s.itemLeft?.length) f.push(`${w}: done state: next step still listed "${s.itemLeft[0]}"`);
      if (s.superLeft?.length) f.push(`${w}: done state: superintendent still sees "${s.superLeft[0]}"`);
  }
  return f;
}

export async function runJourneys504(browser, base) {
  const rows = [];
  for (const key of Object.keys(JOURNEYS504)) for (const size of JOURNEY_SIZES) rows.push(await runJourney504(browser, base, key, size));
  return rows;
}
