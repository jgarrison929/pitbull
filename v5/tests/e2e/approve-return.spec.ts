import { expect, test, type Page } from "@playwright/test";
import { confirmDialog } from "./confirm-dialog";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";
import { usdCents, usdShort } from "@/lib/ev";

/** Cedar Creek (25-031) plans Bridge Crew 2 — pending/approve use its seeded rate. */
const BRIDGE_RATE_CENTS = CREW_LABOR_RATE_CENTS["Bridge Crew 2"];
/** Seeded Cedar working plan (tomorrow under V5_SEED_NOW=2026-10-20). */
const CEDAR_WORKING_DATE = "2026-10-21";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

/** Primary plan-card for Cedar's seeded working day — never a history row. */
function workingPlan(page: Page) {
  return page.locator(
    `[data-testid="plan-card"][data-plan-date="${CEDAR_WORKING_DATE}"]`,
  );
}

/** Live AC on the job card: locked cutoff plus cost posted since that lock. */
async function actualCents(page: Page) {
  return Number(
    await page
      .getByTestId("job-actual")
      .locator("[data-cents]")
      .getAttribute("data-cents"),
  );
}

/** Cost posted since last lock (approve lands here until the PM locks). */
async function sinceLockActualCents(page: Page) {
  const el = page.getByTestId("job-actual-since-lock").locator("[data-cents]");
  if ((await el.count()) === 0) return 0;
  return Number(await el.getAttribute("data-cents"));
}

/** On a phone the rail is hidden — use the assistant page. */
async function askOnPhone(page: Page, prompt: string) {
  await page.goto("/app/assistant");
  const pane = page.getByTestId("assistant-page");
  await expect(pane.getByTestId("assistant-input")).toBeVisible();
  const before = await pane.getByTestId("action-run").count();
  await pane.getByTestId("assistant-input").fill(prompt);
  await pane.getByRole("button", { name: "Send" }).click();
  await expect(pane.getByTestId("action-run")).toHaveCount(before + 1);
  return pane.getByTestId("action-run").last();
}

test.describe("superintendent approve / return", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("foreman report → super return → re-report → approve posts once; second approve does not double-post", async ({
    page,
  }) => {
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");

    const actualBefore = await actualCents(page);

    await workingPlan(page).getByTestId("submit-plan").click();
    await expect(workingPlan(page)).toHaveAttribute("data-status", "issued");

    await page.getByTestId("report-mh-04-210").fill("22");
    await page.getByTestId("report-qty-04-210").fill("12");
    await page.getByTestId("report-work").click();
    await expect(page.getByTestId("report-summary")).toContainText(/pending/i);
    await expect(workingPlan(page)).toHaveAttribute("data-status", "reported");

    // Check 4: nothing posted before approval; pending on the job page.
    expect(await actualCents(page)).toBe(actualBefore);
    // Phone + desktop both mount cost rows; assert the visible one (5.0.4-e).
    const pending = page.locator(
      '[data-testid="approval-pending-04-210"]:visible',
    );
    await expect(pending).toBeVisible();
    await expect(pending).toContainText("12");
    const pendingCents = 22 * BRIDGE_RATE_CENTS;
    await expect(pending).toHaveAttribute("data-cents", String(pendingCents));
    // Phone Money(exact): one compact figure; tap swaps to exact (no dual mount).
    await expect(pending).toContainText(usdShort(pendingCents));
    const moneyToggle = pending.getByTestId("money-exact-toggle");
    if (await moneyToggle.count()) {
      await moneyToggle.click();
      await expect(pending).toContainText(usdCents(pendingCents));
      await expect(pending).not.toContainText(usdShort(pendingCents));
    }

    // Superintendent returns with a reason (form unmounts on success — assert banner).
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await expect(workingPlan(page)).toHaveAttribute("data-status", "reported");
    await page.getByTestId("return-reason").fill("Recount pour 3");
    await confirmDialog(page, page.getByTestId("return-report"));
    await expect(workingPlan(page)).toHaveAttribute("data-status", "issued");
    await expect(page.getByTestId("return-reason-banner")).toContainText(
      "Recount pour 3",
    );
    expect(await actualCents(page)).toBe(actualBefore);
    await expect(page.getByTestId("job-changes")).toContainText(
      /Recount pour 3/,
    );

    // Foreman sees the reason and kept values, then re-reports.
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");
    await expect(page.getByTestId("return-reason-banner")).toContainText(
      "Recount pour 3",
    );
    await expect(page.getByTestId("report-mh-04-210")).toHaveValue("22");
    await expect(page.getByTestId("report-qty-04-210")).toHaveValue("12");
    await page.getByTestId("report-work").click();
    await expect(workingPlan(page)).toHaveAttribute("data-status", "reported");
    expect(await actualCents(page)).toBe(actualBefore);

    // Approve on screen — cost posts once into since-lock (cutoff AC stays put).
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await confirmDialog(page, workingPlan(page).getByTestId("approve-report"));
    await expect(workingPlan(page)).toHaveAttribute("data-status", "approved");

    const sinceAfterApprove = await sinceLockActualCents(page);
    expect(sinceAfterApprove).toBeGreaterThanOrEqual(22 * BRIDGE_RATE_CENTS);
    expect(await actualCents(page)).toBe(actualBefore + sinceAfterApprove);

    await expect(
      page.locator('[data-testid="approval-pending-04-210"]:visible'),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="pending-04-210"]:visible'),
    ).toContainText("12");
    await expect(page.getByTestId("job-changes")).toContainText(/Approved/i);

    // Second approve via assistant must not double-post.
    const run2 = await askOnPhone(
      page,
      "Approve the daily report for Cedar Creek",
    );
    await expect(run2).toHaveAttribute("data-action", "dailyPlan.approve");
    await expect(run2.getByTestId("action-summary")).toContainText(
      /already approved/i,
    );
    await page.goto("/app/jobs/25-031");
    expect(await actualCents(page)).toBe(actualBefore + sinceAfterApprove);
    expect(await sinceLockActualCents(page)).toBe(sinceAfterApprove);
  });

  test("assistant return refuses an empty reason", async ({ page }) => {
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");
    await workingPlan(page).getByTestId("submit-plan").click();
    await page.getByTestId("report-mh-04-210").fill("22");
    await page.getByTestId("report-qty-04-210").fill("12");
    await page.getByTestId("report-work").click();
    await expect(workingPlan(page)).toHaveAttribute("data-status", "reported");

    await signIn(page, "superintendent");
    const run = await askOnPhone(page, "Return the report for Cedar Creek");
    await expect(run).toHaveAttribute("data-action", "dailyPlan.return");
    await expect(run.getByTestId("action-summary")).toContainText(/reason/i);
    await page.goto("/app/jobs/25-031");
    await expect(workingPlan(page)).toHaveAttribute("data-status", "reported");
  });
});
