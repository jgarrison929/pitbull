// ConfirmDialog (PR #65) for the drives that click a confirmed action: change-order approve, reject
// and void, plan-line remove, and plan approve and return; PR #71 adds Approve estimate
// (approve-estimate) and Lock Period (lock-claim) on the job page. With #65 the click opens an alertdialog
// and nothing posts until its confirm button is clicked. Before #65 the click posts at once.
// confirmIfDialog confirms the dialog only when it is present, so one skill works on main both
// before and after #65. A dialog that appears but cannot be confirmed always throws.
// The test ids are the ones in v5/src/components/ui/confirm-dialog.tsx (PR #65).

export const CONFIRM_DIALOG_ROLE = "alertdialog";
export const CONFIRM_DIALOG_CONFIRM = "confirm-dialog-confirm";
export const CONFIRM_DIALOG_CANCEL = "confirm-dialog-cancel";
/** Without a settled locator: how long to look for the dialog before treating it as absent. */
export const CONFIRM_GRACE_MS = 2000;
export const CONFIRM_POLL_MS = 100;

/**
 * One poll's decision. The dialog wins over the settled state: when both are visible, the dialog
 * still has to be confirmed (or the caller would leave it open over the page).
 * @returns {"confirm"|"settled"|"absent"|"timeout"|"wait"}
 */
export function confirmDecision({ dialogVisible, settledVisible, elapsedMs, budgetMs, hasSettled }) {
  if (dialogVisible) return "confirm";
  if (hasSettled && settledVisible) return "settled";
  if (elapsedMs >= budgetMs) return hasSettled ? "timeout" : "absent";
  return "wait";
}

const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));
const firstLine = (e) => String(e?.message ?? e).split("\n")[0];
// A read that throws while the page navigates counts as not visible this poll. Two dialogs at once
// (strict mode) is not transient and is rethrown.
const shown = async (loc) => {
  try {
    return await loc.isVisible();
  } catch (e) {
    if (/strict mode violation/i.test(String(e?.message ?? e))) throw e;
    return false;
  }
};

/**
 * Poll for the ConfirmDialog against `settled` (a locator that is visible only once the post landed,
 * e.g. the CO card with data-status="approved"). With no `settled`, poll for graceMs.
 * @returns {Promise<{ outcome: "dialog"|"settled"|"absent"|"timeout", waitedMs: number }>}
 */
export async function watchForDialog(page, { settled = null, timeout = 30000, graceMs = CONFIRM_GRACE_MS, pollMs = CONFIRM_POLL_MS, now = Date.now, sleep = realSleep } = {}) {
  const dialog = page.getByRole(CONFIRM_DIALOG_ROLE);
  const budgetMs = settled ? timeout : graceMs;
  const t0 = now();
  for (;;) {
    const elapsedMs = now() - t0;
    const dialogVisible = await shown(dialog);
    const settledVisible = settled && !dialogVisible ? await shown(settled) : false;
    const d = confirmDecision({ dialogVisible, settledVisible, elapsedMs, budgetMs, hasSettled: Boolean(settled) });
    if (d === "confirm") return { outcome: "dialog", waitedMs: elapsedMs };
    if (d !== "wait") return { outcome: d, waitedMs: elapsedMs };
    await sleep(pollMs);
  }
}

/**
 * Call right after the trigger click. Returns { dialog: true } after confirming a dialog that
 * appeared, { dialog: false } when the action posted without one (main before #65).
 * Throws when the dialog appeared but its confirm click failed or it did not hide, and when
 * `settled` is given and neither the dialog nor the settled state appeared within `timeout`.
 */
export async function confirmIfDialog(page, { settled = null, timeout = 30000, graceMs = CONFIRM_GRACE_MS, pollMs = CONFIRM_POLL_MS, now = Date.now, sleep = realSleep } = {}) {
  const w = await watchForDialog(page, { settled, timeout, graceMs, pollMs, now, sleep });
  if (w.outcome === "timeout") {
    throw new Error(`ConfirmDialog: neither the dialog nor the posted state appeared within ${timeout} ms of the click`);
  }
  if (w.outcome !== "dialog") return { dialog: false, outcome: w.outcome, waitedMs: w.waitedMs };
  const dialog = page.getByRole(CONFIRM_DIALOG_ROLE);
  // The dialog's words, for evidence only (never part of a pass rule).
  const text = typeof dialog.innerText === "function" ? await dialog.innerText().then((t) => t.replace(/\s+/g, " ").trim(), () => null) : null;
  try {
    await dialog.getByTestId(CONFIRM_DIALOG_CONFIRM).click({ timeout });
  } catch (e) {
    throw new Error(`ConfirmDialog appeared but its confirm click failed: ${firstLine(e)}`);
  }
  try {
    await dialog.waitFor({ state: "hidden", timeout });
  } catch (e) {
    throw new Error(`ConfirmDialog appeared and confirm was clicked, but the dialog did not hide: ${firstLine(e)}`);
  }
  return { dialog: true, outcome: "dialog", waitedMs: w.waitedMs, text };
}
