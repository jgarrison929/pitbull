import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role = "executive") {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

test("portfolio reads the visitor's sandbox from Postgres", async ({
  page,
}) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();
  const table = page.getByTestId("portfolio-table");
  for (const name of [
    "SR-99 / Airport Way Interchange",
    "Cedar Creek Bridge Replacement",
    "I-5 Culvert & Drainage Rehab",
  ]) {
    await expect(table.getByRole("link", { name })).toBeVisible();
  }
  await expect(page.getByTestId("kpi-cpi")).toHaveText(/^\d\.\d\d$/);
  await expect(page.getByTestId("data-source")).toContainText(
    "Live from Postgres",
  );
});

test("job page shows budget vs earned value by cost code and tomorrow's plan", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page
    .getByTestId("portfolio-table")
    .getByRole("link", { name: "Cedar Creek Bridge Replacement" })
    .click();
  await expect(page).toHaveURL(/\/app\/jobs\/25-031$/);
  await expect(page.getByTestId("cost-table").locator("tbody tr")).toHaveCount(
    12,
  );
  await expect(page.getByTestId("job-cpi")).toHaveText("0.91");
  await expect(page.getByTestId("plan-card")).toContainText("Bridge Crew 2");
});

test("on a phone the cost codes stack and nothing scrolls sideways", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("cost-list")).toBeVisible();
  await expect(page.getByTestId("cost-table").locator("table")).toBeHidden();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.close();
});

test("an unknown job shows not-found, not someone else's data", async ({ page }) => {
  await signIn(page);
  await page.goto("/app/jobs/99-999");
  await expect(page.getByText("This page could not be found")).toBeVisible();
  await expect(page.getByTestId("cost-table")).toHaveCount(0);
});
