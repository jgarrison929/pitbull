// 5.0.4-h checks 1 to 7 and the #65 regression guard (main 1381687f, the Planner's #78). Check 8 is the existing M2
// drive (numbers.mjs runM2 + confirmIfDialog, fixtures/m2-awkward-expected.json); verify-v5 has no lock drive and 5.0.4
// adds none. Every observation is recorded by the drives below; every rule is a pure evaluate* function.
//
// #78: "A **post** below is a request with method `POST` and a `Next-Action` header (a Next.js server action),
// recorded by Verify with `page.on("request")` from the trigger press until the check ends. A **lock row** is an `li`
// in `[data-testid="job-changes-full"]` on `/app/jobs/25-031/changes` whose text matches
// `/Locked Period 2 on Cedar Creek Bridge:/`. An **approve row** is an `li` … on `/app/jobs/26-010/changes` whose text
// matches `/Approved the estimate on Harbor Abutment:/`."
import { changesPath, contextFor, signInRole, THEME_COOKIE } from "./crawl.mjs";
import { MIN_TAP_PX } from "./checks.mjs";
import { resetDemo } from "./numbers.mjs";

/** The 5.0.4-h copy table, exact. "The copy above is the bar." */
export const H_COPY = {
  lock: { job: "25-031", trigger: "lock-claim", triggerText: "Lock Period 2", title: "Lock Period 2 on 25-031?", description: "Cost entries and installed quantities in Period 2 are frozen by this lock and can no longer be edited. This cannot be undone.", confirm: "Lock period" },
  estimate: { job: "26-010", trigger: "approve-estimate", triggerText: "Approve estimate", title: "Approve estimate on 26-010?", description: "Current Estimate $86,750.00 becomes Current Budget, and Original Budget freezes at that amount. This cannot be undone.", confirm: "Approve estimate" },
};
export const H_CANCEL = "Cancel";
export const LOCK_ROW = /Locked Period 2 on Cedar Creek Bridge:/;
export const APPROVE_ROW = /Approved the estimate on Harbor Abutment:/;
export const LOCK_AFTER = "Lock Period 3";
export const OVERLAY_POINT = { x: 8, y: 8 };
export const H_ROLES = ["pm", "executive"]; // h-7: "As the executive, both dialogs behave as in checks 1 to 4"
export const H_SIZES = [{ width: 390, height: 844 }, { width: 1280, height: 800 }];
export const H_THEMES = ["light", "dark"];
export const H_PHONES = [{ width: 320, height: 568 }, { width: 390, height: 844 }];
export const H_NO_BUTTON_ROLES = ["superintendent", "foreman"];
/** #65 guard: "Approve change order CO-001 on 25-031?" on /app/jobs/25-031#co-CO-001 at 390×844, light and dark. */
export const CO_GUARD = { path: "/app/jobs/25-031#co-CO-001", title: "Approve change order CO-001 on 25-031?" };
/** #80: "as wide as the dialog's content box, within ±1 px for subpixel rounding: |button.getBoundingClientRect().width −
 * (dialog.clientWidth − paddingLeft − paddingRight)| ≤ 1". */
export const CO_WIDTH_TOL_PX = 1;

const oneLine = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

function recordPosts(page) {
  const posts = [];
  page.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"]) posts.push(r.url()); });
  return { mark: () => posts.length, since: (m) => posts.length - m };
}

/** In-page: the open dialog's state (count of visible alertdialogs, its copy by aria ids, buttons, focus). */
export const DIALOG_STATE = () => {
  const vis = (e) => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden";
  const all = [...document.querySelectorAll('[role="alertdialog"]')].filter(vis);
  const d = document.querySelector('[data-testid="confirm-dialog"]');
  const shown = vis(d);
  const byIds = (attr) => (d?.getAttribute(attr) ?? "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter(Boolean)[0] ?? null;
  const title = shown ? byIds("aria-labelledby") : null;
  const desc = shown ? byIds("aria-describedby") : null;
  const btn = (id) => d?.querySelector(`[data-testid="${id}"]`) ?? null;
  const fit = (e) => { if (!e) return null; const cs = getComputedStyle(e); return { sw: e.scrollWidth, cw: e.clientWidth, sh: e.scrollHeight, ch: e.clientHeight, textOverflow: cs.textOverflow }; };
  const rect = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height }; };
  const ae = document.activeElement;
  return {
    visibleAlertdialogs: all.length,
    isConfirmDialog: shown && all.length === 1 && all[0] === d,
    shown,
    text: shown ? (d.innerText ?? "").replace(/\s+/g, " ").trim() : null,
    title: title ? (title.innerText ?? "").replace(/\s+/g, " ").trim() : null,
    description: desc ? (desc.innerText ?? "").replace(/\s+/g, " ").trim() : null,
    confirmText: (btn("confirm-dialog-confirm")?.innerText ?? "").trim() || null,
    cancelText: (btn("confirm-dialog-cancel")?.innerText ?? "").trim() || null,
    destructive: d?.getAttribute("data-destructive") ?? null,
    focus: ae?.getAttribute?.("data-testid") ?? ae?.tagName?.toLowerCase() ?? null,
    focusInDialog: !!d && d.contains(ae),
    vw: document.documentElement.clientWidth, vh: window.innerHeight,
    dialogFit: fit(d), dialogRect: rect(d),
    contentBoxW: d ? d.clientWidth - parseFloat(getComputedStyle(d).paddingLeft) - parseFloat(getComputedStyle(d).paddingRight) : null,
    titleFit: fit(title), descFit: fit(desc),
    confirmRect: rect(btn("confirm-dialog-confirm")), cancelRect: rect(btn("confirm-dialog-cancel")),
  };
};

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(300);
}

async function dialogState(page) {
  await page.waitForTimeout(150);
  return page.evaluate(DIALOG_STATE);
}

async function openDialog(page, trigger) {
  await page.getByTestId(trigger).first().click({ timeout: 10000 });
  await page.getByTestId("confirm-dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  return dialogState(page);
}

async function triggerText(page, base, job, trigger) {
  await page.goto(`${base}/app/jobs/${job}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  const el = page.getByTestId(trigger).first();
  return (await el.count()) ? oneLine(await el.innerText()) : null;
}

async function cents(page, id) {
  return page.evaluate((x) => { const e = document.querySelector(`[data-testid="${x}"]`); const v = e?.getAttribute("data-cents") ?? e?.querySelector("[data-cents]")?.getAttribute("data-cents"); return v == null ? null : Number(v); }, id);
}

async function changeRows(page, base, job, re) {
  await page.goto(base + changesPath(job), { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  return page.evaluate((src) => [...document.querySelectorAll('[data-testid="job-changes-full"] li')].filter((li) => new RegExp(src).test(li.innerText ?? "")).length, re.source);
}

async function estimateStatus(page) {
  return page.evaluate(() => document.querySelector('[data-testid="estimate-status"]')?.getAttribute("data-status") ?? null);
}

async function newPage(browser, base, role, { width, height }, theme) {
  const ctx = await browser.newContext(contextFor(width, height, theme));
  await ctx.addCookies([{ name: THEME_COOKIE, value: theme, url: base }]);
  const page = await ctx.newPage();
  await signInRole(page, base, role);
  return { ctx, page };
}

/** h-1 to h-4 in one fresh sandbox for one role × size × theme. Resets before and after. */
export async function confirmFlow(browser, base, role, size, theme) {
  const out = { role, ...size, theme, steps: [] };
  const { ctx, page } = await newPage(browser, base, role, size, theme);
  const posts = recordPosts(page);
  const L = H_COPY.lock, E = H_COPY.estimate;
  try {
    await resetDemo(page, base);
    // h-1
    await page.goto(`${base}/app/jobs/${L.job}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    out.before = { ev: await cents(page, "job-earned"), ac: await cents(page, "job-actual"), trigger: oneLine(await page.getByTestId(L.trigger).first().innerText().catch(() => "")) || null };
    let m = posts.mark();
    out.h1 = await openDialog(page, L.trigger);
    out.h1.posts = posts.since(m);
    out.steps.push("h-1");
    // h-2: cancel, Esc, overlay
    if (out.h1.shown) {
      m = posts.mark();
      await page.getByTestId("confirm-dialog-cancel").click();
      await settle(page);
      out.h2 = { cancel: { ...(await dialogState(page)), posts: posts.since(m) } };
      m = posts.mark();
      // Esc and overlay only prove something when the dialog really reopened first.
      const escOpen = await openDialog(page, L.trigger);
      await page.keyboard.press("Escape");
      await settle(page);
      out.h2.esc = { ...(await dialogState(page)), posts: posts.since(m), reopened: escOpen.shown === true };
      m = posts.mark();
      const overlayOpen = await openDialog(page, L.trigger);
      await page.mouse.click(OVERLAY_POINT.x, OVERLAY_POINT.y);
      await settle(page);
      out.h2.overlay = { ...(await dialogState(page)), posts: posts.since(m), reopened: overlayOpen.shown === true };
      if (out.h2.overlay.shown) await page.getByTestId("confirm-dialog-cancel").click();
      await settle(page);
      out.h2.after = { trigger: await triggerText(page, base, L.job, L.trigger), ev: await cents(page, "job-earned"), ac: await cents(page, "job-actual"), lockRows: await changeRows(page, base, L.job, LOCK_ROW) };
      out.steps.push("h-2");
      // h-3
      await page.goto(`${base}/app/jobs/${L.job}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      m = posts.mark();
      await openDialog(page, L.trigger);
      await page.getByTestId("confirm-dialog-confirm").dblclick({ timeout: 5000 }).catch((e) => { out.h3err = String(e.message).split("\n")[0]; });
      await settle(page);
      await page.waitForTimeout(1500);
      out.h3 = { posts: posts.since(m), trigger: await triggerText(page, base, L.job, L.trigger), lockRows: await changeRows(page, base, L.job, LOCK_ROW) };
      out.steps.push("h-3");
    }
    // h-4
    await resetDemo(page, base);
    await page.goto(`${base}/app/jobs/${E.job}`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    m = posts.mark();
    out.h4 = { open: await openDialog(page, E.trigger) };
    if (out.h4.open.shown) {
      await page.getByTestId("confirm-dialog-cancel").click();
      await settle(page);
      out.h4.cancel = { posts: posts.since(m), status: await estimateStatus(page), approveRows: await changeRows(page, base, E.job, APPROVE_ROW) };
      await page.goto(`${base}/app/jobs/${E.job}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      m = posts.mark();
      await openDialog(page, E.trigger);
      await page.getByTestId("confirm-dialog-confirm").dblclick({ timeout: 5000 }).catch((e) => { out.h4err = String(e.message).split("\n")[0]; });
      await settle(page);
      await page.waitForTimeout(1500);
      const p = posts.since(m);
      await page.goto(`${base}/app/jobs/${E.job}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      out.h4.confirm = { posts: p, status: await estimateStatus(page), approveRows: await changeRows(page, base, E.job, APPROVE_ROW) };
    } else out.h4.posts = posts.since(m);
    out.steps.push("h-4");
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

/** h-5 at 1280×800 (PM, light). */
export async function keyboardFlow(browser, base, { role = "pm", theme = "light" } = {}) {
  const out = { role, width: 1280, height: 800, theme };
  const { ctx, page } = await newPage(browser, base, role, { width: 1280, height: 800 }, theme);
  const posts = recordPosts(page);
  const focusId = () => page.evaluate(() => document.activeElement?.getAttribute?.("data-testid") ?? null);
  try {
    await resetDemo(page, base);
    await page.goto(`${base}/app/jobs/25-031`, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    let tabs = 0;
    while ((await focusId()) !== "lock-claim" && tabs < 400) { await page.keyboard.press("Tab"); tabs++; }
    out.reachedTrigger = (await focusId()) === "lock-claim";
    if (out.reachedTrigger) {
      let m = posts.mark();
      await page.keyboard.press("Enter");
      await page.getByTestId("confirm-dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      out.open = await dialogState(page);
      await page.keyboard.press("Tab");
      out.tab1 = await dialogState(page);
      await page.keyboard.press("Tab");
      out.tab2 = await dialogState(page);
      await page.keyboard.press("Escape");
      await settle(page);
      out.esc = { ...(await dialogState(page)), posts: posts.since(m) };
      m = posts.mark();
      await page.keyboard.press("Enter");
      await page.getByTestId("confirm-dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      await page.keyboard.press("Tab");
      out.beforeConfirm = await dialogState(page);
      await page.keyboard.press("Enter");
      await settle(page);
      await page.waitForTimeout(1500);
      out.confirm = { posts: posts.since(m), trigger: await triggerText(page, base, "25-031", "lock-claim") };
    }
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await resetDemo(page, base).catch(() => {});
    await ctx.close();
  }
  return out;
}

/** h-6: open each dialog at 320 and 390, light and dark, measure, Cancel. Writes nothing. */
export async function phoneFlow(browser, base, size, theme, { role = "pm" } = {}) {
  const out = { role, ...size, theme, dialogs: {} };
  const { ctx, page } = await newPage(browser, base, role, size, theme);
  try {
    for (const [k, c] of Object.entries(H_COPY)) {
      await page.goto(`${base}/app/jobs/${c.job}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      out.dialogs[k] = await openDialog(page, c.trigger).catch((e) => ({ error: String(e.message).split("\n")[0] }));
      if (out.dialogs[k].shown) await page.getByTestId("confirm-dialog-cancel").click();
    }
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await ctx.close();
  }
  return out;
}

/** h-7 second half: superintendent and foreman see neither trigger on 25-031 or 26-010. */
export async function noButtonFlow(browser, base, role, size = { width: 1280, height: 800 }) {
  const out = { role, ...size, theme: "light", pages: {} };
  const { ctx, page } = await newPage(browser, base, role, size, "light");
  try {
    for (const job of ["25-031", "26-010"]) {
      await page.goto(`${base}/app/jobs/${job}`, { waitUntil: "load" });
      await page.waitForLoadState("networkidle");
      out.pages[job] = await page.evaluate(() => Object.fromEntries(["lock-claim", "approve-estimate"].map((id) => [id, [...document.querySelectorAll(`[data-testid="${id}"]`)].filter((e) => e.getClientRects().length > 0).length])));
    }
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await ctx.close();
  }
  return out;
}

/** #65 regression guard at 390×844, light and dark (PM). */
export async function coGuardFlow(browser, base, theme) {
  const out = { role: "pm", width: 390, height: 844, theme };
  const { ctx, page } = await newPage(browser, base, "pm", { width: 390, height: 844 }, theme);
  try {
    await page.goto(base + CO_GUARD.path, { waitUntil: "load" });
    await page.waitForLoadState("networkidle");
    const card = page.locator('[data-testid="co-card"]').filter({ has: page.locator("h3", { hasText: /^\s*CO-001 ·/ }) }).first();
    const approve = card.getByRole("button", { name: "Approve", exact: true }).first();
    await approve.click({ timeout: 10000 });
    await page.getByTestId("confirm-dialog").waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    out.open = await dialogState(page);
    await page.keyboard.press("Escape");
    await settle(page);
    out.esc = await dialogState(page);
    out.focusOnApprove = await approve.evaluate((b) => document.activeElement === b).catch(() => false);
    out.status = await card.getAttribute("data-status");
  } catch (error) {
    out.error = String(error?.message ?? error).split("\n")[0];
  } finally {
    await ctx.close();
  }
  return out;
}

// ---- rules ----
const at = (r) => `${r.role}@${r.width}x${r.height} ${r.theme}`;

/** The exact copy and dialog shape for one open dialog (5.0.4-h copy table + rules). */
export function copyFailures(d, c, where) {
  const f = [];
  if (!d?.shown) return [`${where}: no visible [data-testid="confirm-dialog"] after pressing ${c.trigger}`];
  if (d.visibleAlertdialogs !== 1 || !d.isConfirmDialog) f.push(`${where}: ${d.visibleAlertdialogs} visible [role="alertdialog"] (want exactly 1, the confirm-dialog)`);
  if (d.title !== c.title) f.push(`${where}: title "${d.title}" ≠ "${c.title}"`);
  if (d.description !== c.description) f.push(`${where}: description "${d.description}" ≠ "${c.description}"`);
  if (d.confirmText !== c.confirm) f.push(`${where}: confirm reads "${d.confirmText}" (want "${c.confirm}")`);
  if (d.cancelText !== H_CANCEL) f.push(`${where}: cancel reads "${d.cancelText}" (want "${H_CANCEL}")`);
  if (d.destructive !== "false") f.push(`${where}: data-destructive="${d.destructive}" (want "false")`);
  if (d.focus !== "confirm-dialog-cancel") f.push(`${where}: focus on open is ${d.focus} (want confirm-dialog-cancel)`);
  return f;
}

export function evaluateConfirmFlow(r) {
  const w = at(r);
  const f = [];
  if (r.error) f.push(`${w}: ${r.error} (after ${r.steps.join(", ") || "nothing"})`);
  const L = H_COPY.lock, E = H_COPY.estimate;
  if (r.before && r.before.trigger !== L.triggerText) f.push(`${w} h-1: lock-claim reads "${r.before.trigger}" after reset (want "${L.triggerText}")`);
  if (r.h1) {
    f.push(...copyFailures(r.h1, L, `${w} h-1`));
    if (r.h1.posts !== 0) f.push(`${w} h-1: ${r.h1.posts} post(s) on opening the dialog (want 0)`);
  } else if (!r.error) f.push(`${w} h-1: not run`);
  if (r.h1?.shown) {
    const h = r.h2;
    if (!h) f.push(`${w} h-2: not run`);
    else {
      if (h.cancel.shown) f.push(`${w} h-2: dialog still visible after Cancel`);
      if (h.cancel.posts !== 0) f.push(`${w} h-2: Cancel posted ${h.cancel.posts} time(s)`);
      if (h.esc.reopened !== true) f.push(`${w} h-2: the dialog did not reopen before Esc, so Esc proves nothing`);
      if (h.overlay.reopened !== true) f.push(`${w} h-2: the dialog did not reopen before the overlay click`);
      if (h.esc.shown) f.push(`${w} h-2: dialog still visible after Esc`);
      if (h.esc.posts !== 0) f.push(`${w} h-2: Esc posted ${h.esc.posts} time(s)`);
      if (!h.overlay.shown) f.push(`${w} h-2: overlay click at (${OVERLAY_POINT.x}, ${OVERLAY_POINT.y}) closed the dialog`);
      if (h.overlay.posts !== 0) f.push(`${w} h-2: overlay click posted ${h.overlay.posts} time(s)`);
      if (h.after.trigger !== L.triggerText) f.push(`${w} h-2: after reload lock-claim reads "${h.after.trigger}" (want "${L.triggerText}")`);
      if (h.after.ev !== r.before.ev || h.after.ac !== r.before.ac) f.push(`${w} h-2: job-earned/job-actual ${h.after.ev}/${h.after.ac} ≠ before ${r.before.ev}/${r.before.ac}`);
      if (h.after.lockRows !== 0) f.push(`${w} h-2: ${h.after.lockRows} lock row(s) after Cancel/Esc/overlay (want 0)`);
    }
    const c = r.h3;
    if (!c) f.push(`${w} h-3: not run`);
    else {
      if (r.h3err) f.push(`${w} h-3: double-click failed: ${r.h3err}`);
      if (c.posts !== 1) f.push(`${w} h-3: double-click confirm posted ${c.posts} time(s) (want exactly 1)`);
      if (c.trigger !== LOCK_AFTER) f.push(`${w} h-3: after reload lock-claim reads "${c.trigger}" (want "${LOCK_AFTER}")`);
      if (c.lockRows !== 1) f.push(`${w} h-3: ${c.lockRows} lock row(s) (want exactly 1)`);
    }
  }
  const e = r.h4;
  if (!e) { if (!r.error) f.push(`${w} h-4: not run`); }
  else {
    f.push(...copyFailures(e.open, E, `${w} h-4`));
    if (e.open?.shown) {
      if (e.cancel.posts !== 0) f.push(`${w} h-4: Cancel posted ${e.cancel.posts} time(s)`);
      if (e.cancel.status !== "draft") f.push(`${w} h-4: estimate-status "${e.cancel.status}" after Cancel (want draft)`);
      if (e.cancel.approveRows !== 0) f.push(`${w} h-4: ${e.cancel.approveRows} approve row(s) after Cancel (want 0)`);
      if (!e.confirm) f.push(`${w} h-4: confirm not run`);
      else {
        if (r.h4err) f.push(`${w} h-4: double-click failed: ${r.h4err}`);
        if (e.confirm.posts !== 1) f.push(`${w} h-4: double-click confirm posted ${e.confirm.posts} time(s) (want exactly 1)`);
        if (e.confirm.status !== "approved") f.push(`${w} h-4: estimate-status "${e.confirm.status}" (want approved)`);
        if (e.confirm.approveRows !== 1) f.push(`${w} h-4: ${e.confirm.approveRows} approve row(s) (want exactly 1)`);
      }
    } else if (e.posts) f.push(`${w} h-4: pressing approve-estimate posted ${e.posts} time(s) with no dialog`);
  }
  return f;
}

export function evaluateKeyboard(r) {
  const w = `${at(r)} h-5`;
  if (r.error) return [`${w}: ${r.error}`];
  if (!r.reachedTrigger) return [`${w}: Tab never reached lock-claim`];
  const f = [];
  if (!r.open?.shown) return [`${w}: Enter on lock-claim opened no dialog`];
  if (r.open.focus !== "confirm-dialog-cancel") f.push(`${w}: focus on open is ${r.open.focus} (want confirm-dialog-cancel)`);
  if (r.tab1.focus !== "confirm-dialog-confirm" || !r.tab1.focusInDialog) f.push(`${w}: Tab moved focus to ${r.tab1.focus} (want confirm-dialog-confirm)`);
  if (r.tab2.focus !== "confirm-dialog-cancel" || !r.tab2.focusInDialog) f.push(`${w}: second Tab moved focus to ${r.tab2.focus} (want confirm-dialog-cancel, inside the dialog)`);
  if (r.esc.shown) f.push(`${w}: Esc did not close the dialog`);
  if (r.esc.posts !== 0) f.push(`${w}: Esc posted ${r.esc.posts} time(s)`);
  if (r.esc.focus !== "lock-claim") f.push(`${w}: focus after Esc is ${r.esc.focus} (want lock-claim)`);
  if (r.beforeConfirm?.focus !== "confirm-dialog-confirm") f.push(`${w}: Tab before confirm focused ${r.beforeConfirm?.focus}`);
  if (r.confirm?.posts !== 1) f.push(`${w}: Enter on confirm posted ${r.confirm?.posts} time(s) (want exactly 1)`);
  if (r.confirm?.trigger !== LOCK_AFTER) f.push(`${w}: after reload lock-claim reads "${r.confirm?.trigger}" (want "${LOCK_AFTER}")`);
  return f;
}

const inside = (b, vw, vh) => b && b.left >= 0 && b.top >= 0 && b.right <= vw && b.bottom <= vh;

export function evaluatePhoneDialogs(r) {
  const f = [];
  if (r.error) f.push(`${at(r)} h-6: ${r.error}`);
  for (const k of Object.keys(H_COPY)) {
    const d = r.dialogs?.[k];
    const w = `${at(r)} h-6 ${k}`;
    if (!d?.shown) { f.push(`${w}: dialog did not open${d?.error ? ` (${d.error})` : ""}`); continue; }
    if (!(d.dialogFit.sw <= d.dialogFit.cw)) f.push(`${w}: confirm-dialog scrollWidth ${d.dialogFit.sw} > clientWidth ${d.dialogFit.cw}`);
    if (!inside(d.dialogRect, d.vw, d.vh)) f.push(`${w}: confirm-dialog box not inside the ${d.vw}×${d.vh} viewport`);
    for (const [n, b] of [["confirm-dialog-confirm", d.confirmRect], ["confirm-dialog-cancel", d.cancelRect]]) {
      if (!b) { f.push(`${w}: ${n} missing`); continue; }
      if (b.w < MIN_TAP_PX || b.h < MIN_TAP_PX) f.push(`${w}: ${n} ${Math.floor(b.w)}×${Math.floor(b.h)} < ${MIN_TAP_PX}×${MIN_TAP_PX}`);
      if (!inside(b, d.vw, d.vh)) f.push(`${w}: ${n} not fully in the viewport`);
    }
    for (const [n, x] of [["title", d.titleFit], ["description", d.descFit]]) {
      if (!x) { f.push(`${w}: ${n} missing`); continue; }
      if (!(x.sw <= x.cw)) f.push(`${w}: ${n} scrollWidth ${x.sw} > clientWidth ${x.cw}`);
      if (!(x.sh <= x.ch)) f.push(`${w}: ${n} scrollHeight ${x.sh} > clientHeight ${x.ch}`);
      if (x.textOverflow === "ellipsis") f.push(`${w}: ${n} text-overflow is ellipsis`);
    }
  }
  return f;
}

export function evaluateNoButtons(r) {
  if (r.error) return [`${r.role} h-7: ${r.error}`];
  const f = [];
  for (const [job, c] of Object.entries(r.pages)) for (const [id, n] of Object.entries(c)) if (n) f.push(`${r.role} h-7: ${job} shows ${n} visible ${id} (want 0)`);
  return f;
}

export function evaluateCoGuard(r) {
  const w = `${at(r)} #65 guard`;
  if (r.error) return [`${w}: ${r.error}`];
  const f = [];
  const d = r.open;
  if (!d?.shown) return [`${w}: Approve on CO-001 opened no confirm-dialog`];
  if (d.title !== CO_GUARD.title) f.push(`${w}: title "${d.title}" ≠ "${CO_GUARD.title}"`);
  if (r.esc?.shown) f.push(`${w}: Esc did not close the dialog`);
  if (!r.focusOnApprove) f.push(`${w}: focus did not return to Approve`);
  if (r.status !== "priced") f.push(`${w}: CO-001 is "${r.status}" after Esc (want priced)`);
  for (const [n, b] of [["confirm-dialog-confirm", d.confirmRect], ["confirm-dialog-cancel", d.cancelRect]]) {
    if (!b) { f.push(`${w}: ${n} missing`); continue; }
    if (b.h < MIN_TAP_PX) f.push(`${w}: ${n} ${Math.floor(b.h)} px tall < ${MIN_TAP_PX}`);
    if (d.contentBoxW == null || Math.abs(b.w - d.contentBoxW) > CO_WIDTH_TOL_PX) f.push(`${w}: ${n} width ${b.w.toFixed(1)} ≠ dialog content box ${d.contentBoxW?.toFixed(1)} (±${CO_WIDTH_TOL_PX} px)`);
  }
  return f;
}

/** The full 5.0.4-h + #65 guard run: rows per check for the report. */
export async function runConfirm504(browser, base) {
  const out = { flows: [], keyboard: null, phones: [], noButtons: [], coGuard: [] };
  for (const role of H_ROLES) for (const size of H_SIZES) for (const theme of H_THEMES) out.flows.push(await confirmFlow(browser, base, role, size, theme));
  out.keyboard = await keyboardFlow(browser, base);
  for (const size of H_PHONES) for (const theme of H_THEMES) out.phones.push(await phoneFlow(browser, base, size, theme));
  for (const role of H_NO_BUTTON_ROLES) out.noButtons.push(await noButtonFlow(browser, base, role));
  for (const theme of H_THEMES) out.coGuard.push(await coGuardFlow(browser, base, theme));
  return out;
}

export function evaluateConfirm504(o) {
  return {
    "h-1..h-4 + h-7 (PM, executive)": o.flows.flatMap(evaluateConfirmFlow),
    "h-5": evaluateKeyboard(o.keyboard),
    "h-6": o.phones.flatMap(evaluatePhoneDialogs),
    "h-7 (no buttons)": o.noButtons.flatMap(evaluateNoButtons),
    "#65 guard": o.coGuard.flatMap(evaluateCoGuard),
  };
}
