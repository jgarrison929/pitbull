import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

const pourLine = (page: Page) =>
  page.locator('[data-testid="plan-line"][data-code="04-210"]');

async function actualCents(page: Page) {
  // Exact cents from Money's data-cents — usdShort is too coarse for +$1k deltas.
  return Number(
    await page.getByTestId("job-actual").locator("[data-cents]").getAttribute(
      "data-cents",
    ),
  );
}

test("foreman reports quantity; after PM locks claim, job earned and CPI move", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");

  const earnedBefore = (await page.getByTestId("job-earned").textContent())!;
  const cpiBefore = (await page.getByTestId("job-cpi").textContent())!;
  const actualBefore = await actualCents(page);

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

  // AC must move with reported hours (form posts every line; pour is 72 MH @ $85/h).
  const actualAfterFirst = await actualCents(page);
  expect(actualAfterFirst).toBeGreaterThan(actualBefore);
  await expect(page.getByTestId("report-summary")).toContainText(/72/);

  // Form shows last reported values (not plan 60 / 42).
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("72");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("38");
  await expect(page.getByTestId("report-last-04-210")).toContainText(/72/);

  // Re-report different numbers — replace, don't add (idempotent).
  await page.getByTestId("report-mh-04-210").fill("80");
  await page.getByTestId("report-qty-04-210").fill("40");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toContainText(/80/);
  await expect(page.getByTestId("pending-04-210").first()).toContainText("40");
  // Pending is 40, not 38+40.
  await expect(page.getByTestId("pending-04-210").first()).not.toContainText(
    "78",
  );
  // Labor replace: +8 MH on the pour → +$680 AC; qty replace does not inflate AC.
  const actualAfterSecond = await actualCents(page);
  expect(actualAfterSecond).toBe(actualAfterFirst + 8 * 85_00);

  // Reload keeps reported values in the form.
  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("80");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("40");

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

  // Idempotent re-report via assistant with different numbers.
  await rail
    .getByTestId("assistant-input")
    .fill("we poured 40 CY with 80 hours on the pour for Cedar Creek");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 2);
  const run2 = rail.getByTestId("action-run").last();
  await expect(run2).toHaveAttribute("data-action", "dailyReport.post");
  await expect(run2.getByTestId("action-summary")).toContainText(/80/);
  await expect(page.getByTestId("pending-04-210").first()).toContainText("40");
});

test("report rejects negative man-hours", async ({ page }) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );
  const actualBefore = await page.getByTestId("job-actual").textContent();
  // Bypass browser min so the server is what refuses.
  await page.getByTestId("report-work-form").evaluate((f) =>
    f.setAttribute("novalidate", ""),
  );
  await page.getByTestId("report-mh-04-210").fill("-50");
  await page.getByTestId("report-qty-04-210").fill("38");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toContainText(/Man-hours/i);
  // AC unchanged — negative must not wipe labor.
  await expect(page.getByTestId("job-actual")).toHaveText(actualBefore!);
});

test("a 0 MH / 0 qty report persists and does not revert to the plan", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );
  await page.getByTestId("report-mh-04-210").fill("0");
  await page.getByTestId("report-qty-04-210").fill("0");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toBeVisible();
  // Prefill shows zeros + Last report — not plan 60 / 42.
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-last-04-210")).toContainText(/0/);

  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-last-04-210")).toContainText(/0/);

  // Untouched resubmit must not post plan 60 MH / +42 CY for the pour.
  const actualAfterZero = await actualCents(page);
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toBeVisible();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("0");
  // Idempotent zeros — AC must not jump by the pour's plan 60×$85.
  expect(await actualCents(page)).toBe(actualAfterZero);
});

test("blank or non-finite report fields are rejected, not replaced by the plan", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );

  await page.getByTestId("report-mh-04-210").fill("80");
  await page.getByTestId("report-qty-04-210").fill("38");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("80");
  const actualAfter80 = await actualCents(page);

  await page.getByTestId("report-work-form").evaluate((f) =>
    f.setAttribute("novalidate", ""),
  );
  // Blank MH must error — not silently post plan 60 and drop AC by $1,700.
  await page.getByTestId("report-mh-04-210").fill("");
  await page.getByTestId("report-qty-04-210").fill("38");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toContainText(/Man-hours/i);
  expect(await actualCents(page)).toBe(actualAfter80);
  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("80");

  // Non-finite (1e309 → Infinity) same rejection.
  await page.getByTestId("report-work-form").evaluate((f) =>
    f.setAttribute("novalidate", ""),
  );
  await page.getByTestId("report-mh-04-210").fill("1e309");
  await page.getByTestId("report-qty-04-210").fill("38");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toContainText(/Man-hours/i);
  expect(await actualCents(page)).toBe(actualAfter80);
  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("80");
});
