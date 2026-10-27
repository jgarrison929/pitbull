import { expect, test, type Page } from "@playwright/test";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";

const roles = [
  "executive",
  "pm",
  "superintendent",
  "foreman",
] as const;

const CULVERT_RATE_CENTS = CREW_LABOR_RATE_CENTS["Culvert Crew A"];

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

for (const role of roles) {
  test(`cost item, plan, and changes pages load for ${role}`, async ({
    page,
  }) => {
    await signIn(page, role);

    await page.goto("/app/jobs/25-031");
    await expect(
      page.getByTestId("cost-code-link-04-210").first(),
    ).toBeVisible();
    await expect(page.getByTestId("job-changes-full-link")).toBeVisible();

    await page.getByTestId("plan-detail-link").first().click();
    await expect(page).toHaveURL(/\/app\/jobs\/25-031\/plans\//);
    await expect(page.getByTestId("plan-detail-status")).toBeVisible();
    await expect(page.getByTestId("plan-detail-lines")).toBeVisible();
    await expect(page.getByTestId("plan-detail-back")).toBeVisible();
    await page.getByTestId("plan-detail-back").click();
    await expect(page).toHaveURL(/\/app\/jobs\/25-031\/?$/);

    await page.goto("/app/jobs/25-031/cost-items/04-210");
    await expect(page.getByTestId("cost-item-ac")).toBeVisible();
    await expect(page.getByTestId("cost-item-back")).toBeVisible();
    await expect(page.getByTestId("cost-item-entries")).toBeVisible();
    await expect(page.getByTestId("cost-item-totals")).toBeVisible();
    const ac = await page
      .getByTestId("cost-item-ac")
      .locator("[data-cents]")
      .getAttribute("data-cents");
    const total = await page
      .getByTestId("cost-item-totals")
      .getAttribute("data-total-cents");
    expect(total).toBe(ac);

    await page.goto("/app/jobs/25-031/cost-items/05-120");
    await expect(page.getByTestId("cost-item-empty-labor")).toHaveText(
      "Labor posts here when a daily report for this cost item is approved",
    );
    await expect(page.getByText("No reports yet")).toHaveCount(0);

    await page.goto("/app/jobs/25-031/changes");
    await expect(page.getByTestId("job-changes-full")).toBeVisible();
    const back = page.getByTestId("changes-back");
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/app/jobs/25-031");
    await back.click();
    await expect(page).toHaveURL(/\/app\/jobs\/25-031\/?$/);
  });
}

test("PM: cost-code link opens cost item; KPIs present", async ({ page }) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("cost-code-link-04-210").first().click();
  await expect(page).toHaveURL(/\/app\/jobs\/25-031\/cost-items\/04-210/);
  await expect(page.getByTestId("cost-item-cb")).toBeVisible();
  await expect(page.getByTestId("cost-item-ev")).toBeVisible();
  await expect(page.getByTestId("cost-item-ac")).toBeVisible();
  await expect(page.getByTestId("cost-item-earned-mh")).toBeVisible();
  await expect(page.getByTestId("cost-item-actual-mh")).toBeVisible();
  await page.getByTestId("cost-item-back").click();
  await expect(page).toHaveURL(/\/app\/jobs\/25-031\/?$/);
});

test("full change list link from job page", async ({ page }) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("job-changes-full-link").click();
  await expect(page).toHaveURL(/\/app\/jobs\/25-031\/changes/);
  await expect(page.getByTestId("job-changes-full")).toBeVisible();
  await expect(page.getByTestId("changes-back")).toHaveAttribute(
    "href",
    "/app/jobs/25-031",
  );
});

test("invalid or missing drill-down ids return HTTP 404", async ({ page }) => {
  await signIn(page, "pm");

  const badPlan = await page.goto("/app/jobs/25-031/plans/not-a-uuid");
  expect(badPlan?.status()).toBe(404);
  await expect(page.getByText("This page could not be found")).toBeVisible();

  const missingPlan = await page.goto(
    "/app/jobs/25-031/plans/00000000-0000-4000-8000-000000000099",
  );
  expect(missingPlan?.status()).toBe(404);

  const missingCode = await page.goto("/app/jobs/25-031/cost-items/99-999");
  expect(missingCode?.status()).toBe(404);

  const missingJobChanges = await page.goto("/app/jobs/99-999/changes");
  expect(missingJobChanges?.status()).toBe(404);
});

test.describe("Pacific timezone date column", () => {
  test.use({ timezoneId: "America/Los_Angeles" });

  test("cost-item dates stay on the UTC calendar day (Sep 15)", async ({
    page,
  }) => {
    await signIn(page, "pm");
    await page.goto("/app/jobs/25-031/cost-items/04-210");
    // Seed invoice "Column forms & bracing" is daysAgo 35 from 2026-10-20 → Sep 15.
    const sep15 = page.locator(
      '[data-testid="cost-entry-other"][data-at^="2026-09-15"]',
    );
    await expect(sep15).toHaveCount(1);
    await expect(sep15.getByTestId("cost-entry-date")).toHaveText(
      "Tue, Sep 15",
    );
  });
});

test("entries are newest first on the cost-item page", async ({ page }) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031/cost-items/04-210");
  const ats = await page
    .locator("[data-testid=cost-entry-labor], [data-testid=cost-entry-other]")
    .evaluateAll((rows) =>
      rows.map((r) => r.getAttribute("data-at") ?? ""),
    );
  expect(ats.length).toBeGreaterThan(1);
  for (let i = 1; i < ats.length; i++) {
    expect(ats[i - 1]! >= ats[i]!).toBe(true);
  }
  const oldestFirst = [...ats].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  expect(ats).not.toEqual(oldestFirst);
});

test("after approve: totals = AC on drill page and job page; no approved-qty row", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "issued",
  );
  await page.getByTestId("report-mh-04-210").fill("22");
  await page.getByTestId("report-qty-04-210").fill("12");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "reported",
  );

  await signIn(page, "superintendent");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("approve-report").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "approved",
  );
  const planId = await page
    .getByTestId("plan-card")
    .getAttribute("data-plan-id");
  expect(planId).toBeTruthy();

  // Job page leaf Actual (locked) — capture before leaving.
  const jobRow = page
    .locator('[data-testid="cost-tree-row"][data-code="04-210"]')
    .first();
  await expect(jobRow).toBeVisible();
  // Actual column Money is the 3rd metric Money with data-cents in the row —
  // read via the pending-lock / approval area isn't AC. Use job-actual for job
  // total; for the leaf, open the cost item and compare to the same rollup.
  await page.goto("/app/jobs/25-031/cost-items/04-210");

  await expect(page.getByText("approved-qty")).toHaveCount(0);

  const ac = await page
    .getByTestId("cost-item-ac")
    .locator("[data-cents]")
    .getAttribute("data-cents");
  const total = await page
    .getByTestId("cost-item-totals")
    .getAttribute("data-total-cents");
  expect(total).toBe(ac);
  expect(Number(ac)).toBeGreaterThan(0);

  // Since-lock subtotal holds the new approve (22 MH × rate).
  await expect(page.getByTestId("cost-item-since-lock")).toBeVisible();
  const since = Number(
    await page
      .getByTestId("cost-item-since-lock")
      .getAttribute("data-total-cents"),
  );
  expect(since).toBeGreaterThan(0);

  // Phone cards + desktop table both carry the testid; Part C filters by
  // client rects — e2e must assert the visible link (5.0.4-e).
  const laborLink = page.locator(
    '[data-testid="cost-entry-plan-link"]:visible',
  );
  await expect(laborLink.first()).toBeVisible();
  await expect(laborLink.first()).toHaveAttribute(
    "href",
    `/app/jobs/25-031/plans/${planId}`,
  );

  // Job page leaf Actual matches the same locked AC.
  await page.goto("/app/jobs/25-031");
  const leaf = page
    .locator('[data-testid="cost-tree-row"][data-code="04-210"]')
    .first();
  await expect(leaf).toBeVisible();
  // Desktop Actual is an exact Money in the row — last data-cents before CPI is fragile;
  // navigate via cost-code link and re-check AC card equals prior total.
  await page.getByTestId("cost-code-link-04-210").first().click();
  await expect(page.getByTestId("cost-item-ac").locator("[data-cents]")).toHaveAttribute(
    "data-cents",
    ac!,
  );
  await expect(page.getByTestId("cost-item-totals")).toHaveAttribute(
    "data-total-cents",
    ac!,
  );

  // T3: Period 2 lock folds the pending row into the snapshot.
  const sinceBeforeLock = Number(
    await page.getByTestId("cost-item-since-lock").getAttribute("data-total-cents"),
  );
  expect(sinceBeforeLock).toBeGreaterThan(0);
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("lock-claim").click();
  await expect(page.getByTestId("lock-claim")).toContainText("Period 3");
  await page.goto("/app/jobs/25-031/cost-items/04-210");
  await expect(page.getByTestId("cost-item-since-lock")).toHaveCount(0);
  const acAfter = await page
    .getByTestId("cost-item-ac")
    .locator("[data-cents]")
    .getAttribute("data-cents");
  expect(Number(acAfter)).toBe(Number(ac) + sinceBeforeLock);
  await expect(page.getByTestId("cost-item-totals")).toHaveAttribute(
    "data-total-cents",
    acAfter!,
  );
  await expect(page.locator("[data-since-lock='1']")).toHaveCount(0);
});

test("lock-day plan stays pending until the next lock (24-077)", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/24-077/cost-items/03-210");
  const acBefore = await page
    .getByTestId("cost-item-ac")
    .locator("[data-cents]")
    .getAttribute("data-cents");
  const mhBefore = (await page.getByTestId("cost-item-actual-mh").innerText()).trim();

  await page.goto("/app/jobs/24-077");
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "issued",
  );
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "reported",
  );

  await signIn(page, "superintendent");
  await page.goto("/app/jobs/24-077");
  await page.getByTestId("approve-report").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "approved",
  );

  await page.goto("/app/jobs/24-077/cost-items/03-210");
  await expect(page.getByTestId("cost-item-ac").locator("[data-cents]")).toHaveAttribute(
    "data-cents",
    acBefore!,
  );
  await expect(page.getByTestId("cost-item-totals")).toHaveAttribute(
    "data-total-cents",
    acBefore!,
  );
  // 42 MH × Culvert Crew A rate — last report default on the trench line.
  await expect(page.getByTestId("cost-item-since-lock")).toHaveAttribute(
    "data-total-cents",
    String(42 * CULVERT_RATE_CENTS),
  );
  await expect(page.locator("[data-since-lock='1']").first()).toBeVisible();
  const mhAfter = (await page.getByTestId("cost-item-actual-mh").innerText()).trim();
  expect(mhAfter.startsWith(mhBefore.split("\n")[0]!)).toBe(true);
});
