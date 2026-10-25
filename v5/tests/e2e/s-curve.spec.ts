import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function cents(page: Page, testId: string) {
  return Number(
    await page.getByTestId(testId).locator("[data-cents]").first().getAttribute(
      "data-cents",
    ),
  );
}

async function curvePoint(page: Page, on: string) {
  const el = page.locator(
    `[data-testid="curve-point"][data-on="${on}"]`,
  );
  await expect(el).toHaveCount(1);
  return {
    planned: Number(await el.getAttribute("data-planned-cents")),
    earned: Number(await el.getAttribute("data-earned-cents")),
    actual: Number(await el.getAttribute("data-actual-cents")),
  };
}

test("check 1+2: job S-curve last PV = budget; cutoff matches tiles on 25-031", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  const section = page.getByTestId("s-curve-section");
  await expect(section).toBeVisible();
  const chart = page.getByTestId("s-curve");
  await expect(chart).toBeVisible();

  const budget = await cents(page, "job-budget");
  const lastPlanned = Number(
    await chart.getAttribute("data-last-planned-cents"),
  );
  expect(lastPlanned).toBe(budget);

  const cutoff = await chart.getAttribute("data-cutoff");
  expect(cutoff).toBeTruthy();
  const at = await curvePoint(page, cutoff!);
  expect(at.planned).toBe(await cents(page, "job-planned"));
  expect(at.earned).toBe(await cents(page, "job-earned"));
  expect(at.actual).toBe(await cents(page, "job-actual"));
});

test("check 2: cutoff matches tiles on 24-118 and 24-077", async ({ page }) => {
  await signIn(page, "pm");
  for (const number of ["24-118", "24-077"] as const) {
    await page.goto(`/app/jobs/${number}`);
    const chart = page.getByTestId("s-curve");
    await expect(chart).toBeVisible();
    const cutoff = await chart.getAttribute("data-cutoff");
    expect(cutoff, number).toBeTruthy();
    const at = await curvePoint(page, cutoff!);
    expect(at.planned, number).toBe(await cents(page, "job-planned"));
    expect(at.earned, number).toBe(await cents(page, "job-earned"));
    expect(at.actual, number).toBe(await cents(page, "job-actual"));
  }
});

test("check 5: portfolio S-curve last PV = active budgets; cutoff = tiles", async ({
  page,
}) => {
  await signIn(page, "executive");
  await page.goto("/app");
  const chart = page.getByTestId("portfolio-s-curve");
  await expect(chart).toBeVisible();
  const cutoff = await chart.getAttribute("data-cutoff");
  expect(cutoff).toBeTruthy();
  const at = await curvePoint(page, cutoff!);
  expect(at.earned).toBe(await cents(page, "kpi-earned"));
  expect(at.planned).toBe(await cents(page, "kpi-planned"));
});

test("check 6: draft 26-010 has no curve section and no empty chart", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/26-010");
  await expect(page.getByTestId("draft-label")).toBeVisible();
  await expect(page.getByTestId("s-curve-section")).toHaveCount(0);
  await expect(page.getByTestId("s-curve")).toHaveCount(0);
  await expect(page.getByTestId("curve-points")).toHaveCount(0);
  await expect(page.getByTestId("s-curve-svg")).toHaveCount(0);
});
