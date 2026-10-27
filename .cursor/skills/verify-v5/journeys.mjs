// First-task journey tap counts (5.0.4 spec, "First-task journeys"). A tap is one click on a link,
// button, summary or form control. Spec rule (docs/v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md,
// main 05a1b710): "A `ConfirmDialog` confirm click (#65 and 5.0.4-h) is not a tap in this table.
// Journeys that end on a confirmed action count exactly 1 confirm click on top of the tap limit."
// Narrow by design: a click is excluded only when it is the confirm button of a dialog that
// confirmIfDialog saw open (role dialog/alertdialog), and at most once per action. No blanket +1.
import { CONFIRM_DIALOG_CONFIRM, CONFIRM_DIALOG_ROLE, confirmIfDialog, watchForDialog } from "./confirm-dialog.mjs";
import { resetDemo } from "./numbers.mjs";

export const JOURNEY_TAP_LIMIT = 3;
const DIALOG_ROLES = new Set(["dialog", "alertdialog"]);

/**
 * entries: [{ kind: "tap", label }, { kind: "confirm", action, sawOpen, role, label }]
 * @returns {{ counted: number, excluded: object[], countedEntries: object[] }}
 */
export function countJourneyTaps(entries) {
  const excludedFor = new Set();
  const excluded = [];
  const countedEntries = [];
  for (const e of entries) {
    const exempt = e.kind === "confirm" && e.sawOpen === true && DIALOG_ROLES.has(e.role) && typeof e.action === "string" && e.action && !excludedFor.has(e.action);
    if (exempt) {
      excludedFor.add(e.action);
      excluded.push(e);
    } else countedEntries.push(e);
  }
  return { counted: countedEntries.length, excluded, countedEntries };
}

/** Failures for one journey's tap log against the limit (counted taps only). */
export function evaluateJourneyTaps(entries, { limit = JOURNEY_TAP_LIMIT, name = "journey" } = {}) {
  const c = countJourneyTaps(entries);
  return c.counted > limit ? [`${name}: ${c.counted} counted taps > ${limit} (${c.countedEntries.map((e) => e.label).join(" → ")})`] : [];
}

function tapLog() {
  const entries = [];
  return {
    entries,
    async tap(locator, label) {
      await locator.click();
      entries.push({ kind: "tap", label });
    },
    confirmed(action, r) {
      if (r.dialog) entries.push({ kind: "confirm", action, sawOpen: true, role: r.role ?? CONFIRM_DIALOG_ROLE, label: `confirm ${action}` });
    },
  };
}

const T = 30000;
const jobLink = (page, job) => page.locator(`a[href="/app/jobs/${job}"]:visible, a[href^="/app/jobs/${job}#"]:visible`).first();
const coCard = (page, co) => page.getByTestId("co-card").filter({ has: page.locator("h3", { hasText: new RegExp(`^\\s*${co} ·`) }) });

/** The three journeys that end on a confirmed action. `trigger` returns { locator, settled, action }. */
export const JOURNEYS = {
  co: {
    name: "pm: approve CO-001 on 25-031", role: "pm", job: "25-031",
    trigger: async (page) => ({ action: "co-approve CO-001", locator: coCard(page, "CO-001").first().getByRole("button", { name: /^Approve$/ }), settled: coCard(page, "CO-001").and(page.locator('[data-status="approved"]')).first() }),
  },
  estimate: {
    name: "pm: approve the Harbor estimate on 26-010", role: "pm", job: "26-010",
    trigger: async (page) => ({ action: "approve-estimate 26-010", locator: page.getByTestId("approve-estimate"), settled: page.locator('[data-testid="estimate-status"][data-status="approved"]') }),
  },
  report: {
    name: "superintendent: approve the seeded 24-118 report", role: "superintendent", job: "24-118",
    trigger: async (page) => {
      const card = page.locator('[data-testid="plan-card"][data-status="reported"]').first();
      const id = await card.getAttribute("data-plan-id", { timeout: T });
      return { action: `approve-report ${id}`, locator: card.getByTestId("approve-report"), settled: page.locator(`[data-testid="plan-card"][data-plan-id="${id}"][data-status="approved"]`) };
    },
  },
};

/**
 * Drive one journey from /login in a fresh context and return its tap log.
 * mutant: null | "extra-tap" (one extra real tap: open and close the user menu) | "double-confirm"
 * (double-click the dialog's confirm: both clicks are logged against the same action).
 */
export async function runJourney(browser, base, key, { mutant = null, width = 1280, height = 800 } = {}) {
  const J = JOURNEYS[key];
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const log = tapLog();
  try {
    await page.goto(`${base}/login`, { waitUntil: "networkidle" });
    await log.tap(page.getByTestId(`role-${J.role}`), `role card ${J.role}`);
    await page.waitForURL(/\/app(\?|$)/, { timeout: T });
    await page.waitForLoadState("networkidle");
    if (mutant === "extra-tap") {
      await log.tap(page.getByTestId("user-menu"), "user menu (extra)");
      await page.keyboard.press("Escape");
    }
    await log.tap(jobLink(page, J.job), J.job);
    await page.waitForURL(new RegExp(`/app/jobs/${J.job}(#|$|\\?)`), { timeout: T });
    await page.waitForLoadState("networkidle");
    const t = await J.trigger(page);
    await log.tap(t.locator, t.action);
    let dialog = false;
    if (mutant === "double-confirm") {
      const w = await watchForDialog(page, { settled: t.settled, timeout: T });
      if (w.outcome === "dialog") {
        dialog = true;
        await page.getByRole(CONFIRM_DIALOG_ROLE).getByTestId(CONFIRM_DIALOG_CONFIRM).dblclick({ timeout: T });
        for (let i = 0; i < 2; i++) log.entries.push({ kind: "confirm", action: t.action, sawOpen: true, role: CONFIRM_DIALOG_ROLE, label: `confirm ${t.action} (#${i + 1})` });
      }
    } else {
      const r = await confirmIfDialog(page, { settled: t.settled, timeout: T });
      dialog = r.dialog;
      log.confirmed(t.action, r);
    }
    await t.settled.waitFor({ timeout: T });
    const c = countJourneyTaps(log.entries);
    const failures = evaluateJourneyTaps(log.entries, { name: J.name });
    await resetDemo(page, base);
    return { key, name: J.name, mutant, dialog, entries: log.entries, counted: c.counted, excluded: c.excluded.map((e) => e.label), failures };
  } finally {
    await ctx.close();
  }
}
