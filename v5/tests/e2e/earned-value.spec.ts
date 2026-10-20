import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

const pourLine = (page: Page) =>
  page.locator('[data-testid="plan-line"][data-code="04-210"]');

test("foreman reports quantity; after PM locks claim, job earned and CPI move", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");

  const earnedBefore = (await page.getByTestId("job-earned").textContent())!;
  const cpiBefore = (await page.getByTestId("job-cpi").textContent())!;

  // Boost the pour quantity on tomorrow's draft plan (foreman actuals).
  await pourLine(page).getByTestId("edit-line").click();
  const form = pourLine(page).getByTestId("line-form");
  await form.getByLabel(/Quantity/).fill("120");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();

  // Must submit before report — report is hidden on drafts and refused by the action.
  await expect(page.getByTestId("report-work")).toHaveCount(0);
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );

  // Plan ≠ actual: report the day's work to post hours/qty (submit alone does not).
  // Live installed goes pending; earned stays on the locked claim until PM locks.
  const earnedAfterReport = (
    await page.getByTestId("job-earned").textContent()
  )!;
  expect(earnedAfterReport).toBe(earnedBefore);
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("job-actual")).toBeVisible();
  await expect(page.getByTestId("pending-04-210")).toBeVisible();
  await expect(page.getByTestId("job-earned")).toHaveText(earnedBefore);

  // Switch to PM and lock the open period claim so installed qty drives EV.
  await page.goto("/login");
  await page.getByTestId("role-pm").click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("lock-claim")).toBeVisible();
  await expect(page.getByTestId("lock-claim")).toContainText("Period 2");
  await page.getByTestId("lock-claim").click();
  // Next draft opens after lock — button remains for Period 3.
  await expect(page.getByTestId("lock-claim")).toContainText("Period 3");

  // Derivation is visible per line.
  await expect(page.getByTestId("earn-derivation").first()).toBeVisible();
  await expect(page.getByTestId("earn-derivation").first()).not.toHaveText("");

  // Earned and CPI reflect the locked claim (qty bump on 04-210 raises earn).
  const earnedAfter = (await page.getByTestId("job-earned").textContent())!;
  const cpiAfter = (await page.getByTestId("job-cpi").textContent())!;
  expect(earnedAfter).not.toBe(earnedBefore);
  expect(cpiAfter).not.toBe(cpiBefore);
  await expect(page.getByTestId("job-cpi")).toContainText(/\d\.\d{2}/);
});
