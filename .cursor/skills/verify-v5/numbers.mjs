// Browser half of the M2 / M4 / M5 number checks. Values are read from the job page the user sees
// (KPI tiles and cost-tree rows carry the exact cents in data-cents / data-*-cents next to the rendered
// dollars). Evaluation lives in checks.mjs. Every flow uses a fresh visitor sandbox and resets it after.
import path from "node:path";
import { confirmIfDialog } from "./confirm-dialog.mjs";
import { signInRole } from "./crawl.mjs";

const T = 30000;

async function cents(page, id) {
  const e = page.getByTestId(id).first();
  if (!(await e.count())) return null;
  const own = await e.getAttribute("data-cents").catch(() => null);
  if (own !== null) return Number(own);
  const v = await e.locator("[data-cents]").first().getAttribute("data-cents").catch(() => null);
  return v === null ? null : Number(v);
}

async function visible(page, id) {
  const e = page.getByTestId(id).first();
  return (await e.count()) ? (await e.innerText()).replace(/\s+/g, " ").trim() : null;
}

export async function resetDemo(page, base) {
  await page.goto(`${base}/app`, { waitUntil: "networkidle" });
  await page.getByTestId("user-menu").click();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await page.waitForURL(/reset=1/, { timeout: T });
}

export async function jobState(page, base, job) {
  await page.goto(`${base}/app/jobs/${job}`, { waitUntil: "networkidle" });
  const rows = await page.$$eval('[data-testid="cost-tree-row"]', (els) =>
    Object.fromEntries(
      els.map((e) => [e.dataset.code, { ob: +e.dataset.obCents, cb: +e.dataset.cbCents, ce: +e.dataset.ceCents, mh: +e.dataset.mhMilli }]),
    ),
  );
  return {
    original: await cents(page, "job-original-budget"),
    current: await cents(page, "job-budget"),
    estimate: await cents(page, "job-estimate"),
    ev: await cents(page, "job-earned"),
    ac: await cents(page, "job-actual"),
    eac: await cents(page, "job-eac"),
    shown: {
      original: await visible(page, "job-original-budget"),
      current: await visible(page, "job-budget"),
      estimate: await visible(page, "job-estimate"),
      cpi: await visible(page, "job-cpi"),
    },
    rows,
  };
}

/** M2 as the PM on 26-010: import the awkward estimate CSV, approve, read totals and per-code rows. */
export async function runM2(browser, base, { csv, shotDir, job = "26-010" }) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 2000 } });
  const page = await ctx.newPage();
  try {
    await signInRole(page, base, "pm");
    await page.goto(`${base}/app/jobs/${job}`, { waitUntil: "networkidle" });
    await page.getByTestId("import-estimate-file").setInputFiles(csv);
    await page.getByTestId("import-estimate-filename").waitFor({ timeout: T });
    await page.getByTestId("import-estimate-submit").click();
    await page.getByTestId("import-estimate-summary").waitFor({ timeout: T });
    const summary = await visible(page, "import-estimate-summary");
    await page.getByTestId("approve-estimate").click();
    // Approve estimate uses the same ConfirmDialog as the other irreversible actions.
    await confirmIfDialog(page, {
      settled: page.locator('[data-testid="estimate-status"][data-status="approved"]'),
      timeout: T,
    });
    await page.waitForFunction(
      () => document.querySelector('[data-testid="estimate-status"]')?.getAttribute("data-status") === "approved",
      null,
      { timeout: T },
    );
    const s = await jobState(page, base, job);
    if (shotDir) await page.screenshot({ path: path.join(shotDir, "m2-after-approve.png"), fullPage: true });
    await resetDemo(page, base);
    return { job, importSummary: summary, ...s };
  } finally {
    await ctx.close();
  }
}

/** M4 + M5 as the PM on 25-031: read EV/AC/CB/EAC, approve CO-001, read again, reset, read again. */
export async function runM4M5(browser, base, { shotDir, job = "25-031", co = "CO-001" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  const pick = (s) => ({ ob: s.original, cb: s.current, ev: s.ev, ac: s.ac, eac: s.eac, shown: s.shown });
  try {
    await signInRole(page, base, "pm");
    const before = pick(await jobState(page, base, job));
    if (shotDir) await page.screenshot({ path: path.join(shotDir, "m4m5-before.png"), fullPage: true });
    // Find the card by its user-facing label ("CO-001 · …"); data-co-number holds only the bare number.
    const byLabel = (loc) => loc.filter({ has: page.locator("h3", { hasText: new RegExp(`^\\s*${co} ·`) }) });
    const card = byLabel(page.getByTestId("co-card")).first();
    const coCents = Number(await card.getAttribute("data-total-cents"));
    const coStatus = await card.getAttribute("data-status");
    const coText = (await card.innerText()).replace(/\s+/g, " ").slice(0, 200);
    await card.getByRole("button", { name: /^Approve$/ }).click();
    // PR #65 ConfirmDialog: confirm it only when it opens (main before #65 posts on the click).
    await confirmIfDialog(page, { settled: byLabel(page.locator('[data-testid="co-card"][data-status="approved"]')).first(), timeout: T });
    await byLabel(page.locator('[data-testid="co-card"][data-status="approved"]')).first().waitFor({ timeout: T });
    const after = pick(await jobState(page, base, job));
    if (shotDir) await page.screenshot({ path: path.join(shotDir, "m4m5-after-approve.png"), fullPage: true });
    await resetDemo(page, base);
    const afterReset = pick(await jobState(page, base, job));
    return { job, co, coCents, coStatus, coText, before, after, afterReset };
  } finally {
    await ctx.close();
  }
}
