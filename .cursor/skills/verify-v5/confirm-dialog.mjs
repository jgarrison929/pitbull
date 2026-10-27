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
  // S10: the write the confirm click starts is watched from the click on, so the caller never navigates away (and
  // aborts it, status -1) before it finishes.
  const writes = watchWrites(page);
  try {
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
    // S10: wait for each confirmed write's response (status line and headers). A Next.js Server Action answers only
    // after the action has run, so a 2xx status means the write is committed; an abort before it, or a 4xx/5xx, throws.
    // The response body is NOT awaited: the action's RSC payload is streamed and may stay open well after the UI has
    // updated (PR #87 CI: the 26-010 approve body was still open after 30 s, so response.finished() hung).
    writes.stop();
    const saved = await writes.responses(timeout);
    // S10: then the posted state. A save that answered but never shows its result is not a save, and a write that
    // fails while we wait (a stream aborted mid-way) throws.
    if (settled) {
      const t0 = now();
      for (;;) {
        writes.throwIfFailed();
        if (await shown(settled)) break;
        if (now() - t0 >= timeout) throw new Error(`ConfirmDialog confirmed${saved.length ? ` and the save answered (${saved.map((x) => `HTTP ${x.status}`).join(", ")})` : ""}, but the posted state did not appear within ${timeout} ms`);
        await sleep(pollMs);
      }
      writes.throwIfFailed();
    }
    return { dialog: true, outcome: "dialog", waitedMs: w.waitedMs, text, role: CONFIRM_DIALOG_ROLE, writes: writes.summary() };
  } finally {
    writes.close();
  }
}

/**
 * S10: the app's writes (POST with a Next-Action header) seen from now until stop(). responses(timeout) waits for each
 * one's response status: no response (aborted, status -1, net::ERR_*), a 4xx/5xx, or no answer within the timeout
 * throws. throwIfFailed() throws once a watched write has fired requestfailed (e.g. its streamed body was cut). The
 * body is never awaited (see confirmIfDialog). close() detaches everything. A page without request events (the
 * unit-test fakes) has nothing to watch.
 */
export function watchWrites(page) {
  const pending = [];
  const live = typeof page?.on === "function";
  const find = (r) => pending.find((p) => p.request === r);
  const onRequest = (r) => {
    if (r.method() === "POST" && r.headers()["next-action"]) pending.push({ request: r, url: r.url().replace(/^https?:\/\/[^/]+/, ""), status: null, failed: null, finished: false });
  };
  const onFailed = (r) => { const p = find(r); if (p) p.failed = r.failure()?.errorText ?? "request failed"; };
  const onFinished = (r) => { const p = find(r); if (p) p.finished = true; };
  if (live) { page.on("request", onRequest); page.on("requestfailed", onFailed); page.on("requestfinished", onFinished); }
  let collecting = live;
  let attached = live;
  const stop = () => { if (collecting) { page.off("request", onRequest); collecting = false; } };
  return {
    stop,
    close() { stop(); if (attached) { page.off("requestfailed", onFailed); page.off("requestfinished", onFinished); attached = false; } },
    throwIfFailed() { for (const p of pending) if (p.failed) throw new Error(`the save ${p.url} failed: ${p.failed}`); },
    summary: () => pending.map((p) => ({ url: p.url, status: p.status, body: p.finished ? "complete" : p.failed ? "failed" : "streaming" })),
    async responses(timeout = 30000) {
      for (const p of pending) {
        let timer;
        const late = new Promise((resolve) => { timer = setTimeout(() => resolve("timeout"), timeout); });
        const got = await Promise.race([p.request.response().catch(() => null), late]).finally(() => clearTimeout(timer));
        if (got === "timeout") throw new Error(`the save ${p.url} got no response within ${timeout} ms`);
        if (!got) throw new Error(`the save ${p.url} failed: ${p.failed ?? p.request.failure()?.errorText ?? "no response"}`);
        p.status = got.status();
        if (p.status >= 400) throw new Error(`the save ${p.url} answered HTTP ${p.status}`);
      }
      return pending.map((p) => ({ url: p.url, status: p.status }));
    },
  };
}
