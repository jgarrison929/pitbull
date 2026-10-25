// "portfolio loads from Postgres": the step verify.mjs runs, and the bounded, settled wait for job rows.
// The flake (PR #701 run at 19018eb8): the check counted rows right after Escape closed the user
// menu, got 0, and its own screenshot a moment later showed all 4. Waiting fixes the race without
// loosening the check. The count must reach the seeded count AND hold it for a settle window
// (PORTFOLIO_SETTLE_MS) inside the overall timeout, so a table that passes through 4 on its way to
// 5 or back to 0 fails just as the old immediate snapshot would have. A page that never settles at
// the expected count (0 rows, fewer, more, hidden, or flapping) reports its last real count and fails.

export const PORTFOLIO_STEP = "portfolio loads from Postgres";
export const PORTFOLIO_ROWS_TIMEOUT_MS = 10_000;
export const PORTFOLIO_SETTLE_MS = 750;
const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Polls `locator.count()` until it has equaled `expected` on every poll for `settleMs`, or until
 * `timeoutMs` (counted from the first poll) runs out. Returns `{ rows, settled, waitedMs }`:
 * `rows` is the last real count, `settled` is true only when the count held at `expected` for the
 * whole settle window and the final re-count still equals it. A count() error propagates.
 * `locator` only needs `count()`, so tests can pass a fake; `now`/`sleep` allow a virtual clock.
 */
export async function waitForRowCount(
  locator,
  expected,
  { timeoutMs = PORTFOLIO_ROWS_TIMEOUT_MS, settleMs = PORTFOLIO_SETTLE_MS, intervalMs = 100, now = Date.now, sleep = sleepReal } = {},
) {
  if (!Number.isInteger(expected) || expected < 1) throw new Error(`expected row count must be a positive integer (got ${expected})`);
  // A settle window <= 0 would "settle" on a single poll (the #701 race again); a NaN/0/negative timeout or
  // interval would make the deadline or poll cadence meaningless. Refuse them instead of quietly passing.
  for (const [name, v] of [["timeoutMs", timeoutMs], ["settleMs", settleMs], ["intervalMs", intervalMs]]) {
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new Error(`${name} must be a finite number > 0 (got ${String(v)})`);
  }
  const start = now();
  const deadline = start + timeoutMs;
  let rows = await locator.count();
  let since = rows === expected ? now() : null; // when the current unbroken run at `expected` began
  for (;;) {
    if (since !== null && now() - since >= settleMs) return { rows, settled: true, waitedMs: now() - start };
    if (now() >= deadline) return { rows, settled: false, waitedMs: now() - start };
    // Next poll: the usual interval, but land exactly on the settle-window end (the final re-check) or the deadline.
    await sleep(Math.min(intervalMs, deadline - now(), since === null ? Infinity : since + settleMs - now()));
    rows = await locator.count();
    if (rows !== expected) since = null;
    else since ??= now();
  }
}

/** The portfolio check's pass rule: exactly the seeded job count, held steady, plus sandbox, CPI, no dev footer. */
export function portfolioOk({ sandbox, rows, settled, expected, cpi, noDevFooter }) {
  // expected >= 1: 0 rows "settled" against an expected 0 is an empty portfolio, never a pass.
  return Boolean(sandbox) && Number.isInteger(expected) && expected >= 1 && rows === expected && settled === true && /^\d\.\d\d[+−]\$/.test(cpi ?? "") && Boolean(noDevFooter);
}

/**
 * The whole step as verify.mjs runs it on the signed-in desktop page: read the sandbox id from the
 * user menu, close it, wait for the job rows to settle, read CPI and the dev footer.
 * Returns `{ ok, detail, sandbox, rows, settled, waitedMs }`; any Playwright error propagates so the
 * caller's runStep records it as a FAIL.
 */
export async function runPortfolioStep(page, { expected, seedJobNumbers = [], textTimeoutMs = 20_000, ...waitOpts }) {
  await page.getByTestId("user-menu").click();
  const sandbox = (await page.getByTestId("sandbox-id").textContent({ timeout: textTimeoutMs }))?.trim();
  await page.keyboard.press("Escape");
  const wait = await waitForRowCount(
    page.getByTestId("portfolio-table").getByTestId("job-link").filter({ visible: true }),
    expected,
    waitOpts,
  );
  const cpi = (await page.getByTestId("kpi-cpi").textContent())?.trim();
  const noDevFooter = (await page.getByText("Live from Postgres").count()) === 0;
  const ok = portfolioOk({ sandbox, rows: wait.rows, settled: wait.settled, expected, cpi, noDevFooter });
  const unsettled = wait.rows === expected && !wait.settled ? ` (not steady for ${waitOpts.settleMs ?? PORTFOLIO_SETTLE_MS} ms before the timeout)` : "";
  const detail = `${wait.rows} jobs${unsettled} (seed expects ${expected}: ${seedJobNumbers.join(", ")}), CPI ${cpi}, sandbox ${sandbox}`;
  return { ok, detail, sandbox, ...wait };
}
