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

  // Plan: pour stays at seed 42 CY / 60 MH (6×10). Submit locks the plan.
  await expect(page.getByTestId("report-work")).toHaveCount(0);
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );
  // Plan lines stay at planned numbers after submit.
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");

  // Report with actuals that differ from the plan (38 CY, 72 MH — not 42 / 60).
  await expect(page.getByTestId("report-work-form")).toBeVisible();
  await page.getByTestId("report-mh-04-210").fill("72");
  await page.getByTestId("report-qty-04-210").fill("38");
  const earnedStill = (await page.getByTestId("job-earned").textContent())!;
  expect(earnedStill).toBe(earnedBefore);

  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toContainText(/72/);
  await expect(page.getByTestId("report-summary")).toContainText(/38/);
  // Plan MH unchanged — report does not rewrite the submitted plan.
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
  await expect(page.getByTestId("pending-04-210").first()).toBeVisible();
  await expect(page.getByTestId("pending-04-210").first()).toContainText("38");
  await expect(page.getByTestId("job-earned")).toHaveText(earnedBefore);

  // Switch to PM and lock so claimed installed moves and EV updates.
  await page.goto("/login");
  await page.getByTestId("role-pm").click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("lock-claim")).toBeVisible();
  await expect(page.getByTestId("lock-claim")).toContainText("Period 2");
  await page.getByTestId("lock-claim").click();
  await expect(page.getByTestId("lock-claim")).toContainText("Period 3");

  await expect(page.getByTestId("earn-derivation").first()).toBeVisible();
  const earnedAfter = (await page.getByTestId("job-earned").textContent())!;
  const cpiAfter = (await page.getByTestId("job-cpi").textContent())!;
  expect(earnedAfter).not.toBe(earnedBefore);
  expect(cpiAfter).not.toBe(cpiBefore);
  await expect(page.getByTestId("job-cpi")).toContainText(/\d\.\d{2}/);
});

test("assistant reports actuals that differ from the plan", async ({ page }) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );

  const rail = page.getByTestId("assistant-rail");
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  const before = await rail.getByTestId("action-run").count();
  await rail
    .getByTestId("assistant-input")
    .fill("we poured 38 CY with 72 hours on 04-210 for Cedar Creek");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 1);
  const run = rail.getByTestId("action-run").last();
  await expect(run).toHaveAttribute("data-action", "dailyReport.post");
  await expect(run.getByTestId("action-summary")).toContainText(/72/);
  await expect(run.getByTestId("action-summary")).toContainText(/38/);
  // Plan still shows seed planned MH.
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
  await expect(page.getByTestId("pending-04-210").first()).toContainText("38");
});
