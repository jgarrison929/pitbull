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
  await expect(page.getByTestId("kpi-cpi")).toHaveText(/^\d\.\d\d[+−]\$/);
  // No developer footers on product screens.
  await expect(page.getByText("Live from Postgres")).toHaveCount(0);
  await expect(page.getByText("not seed-only")).toHaveCount(0);
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
  // Virtualized tree: assert the filter count and that leaf codes mount as rows.
  await expect(page.getByTestId("cost-table")).toContainText("12 shown");
  await expect(
    page.getByTestId("cost-tree-row").filter({ hasText: "04-210" }),
  ).toBeVisible();
  await expect(
    page.getByTestId("cost-tree-row").filter({ hasText: "Mobilization" }),
  ).toBeVisible();
  await expect(page.getByTestId("job-cpi")).toHaveText(/^\d\.\d\d−\$/);
  await expect(page.getByTestId("plan-card")).toContainText("Bridge Crew 2");
  await expect(page.getByText("not seed-only")).toHaveCount(0);
  await expect(page.getByText("Live from Postgres")).toHaveCount(0);
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

/** Tablet: cards below lg so the 7-col table cannot expand the page. */
for (const width of [768, 800, 820] as const) {
  test(`portfolio at ${width}px uses cards and does not scroll sideways`, async ({
    browser,
  }) => {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
    });
    await signIn(page, "pm");
    await page.goto("/app");
    await expect(page.getByTestId("portfolio-cards")).toBeVisible();
    await expect(page.getByTestId("portfolio-table").locator("table")).toBeHidden();
    const { scrollWidth, viewportWidth } = await page.evaluate(() => {
      const vv = window.visualViewport;
      return {
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: vv?.width ?? window.innerWidth,
      };
    });
    expect(scrollWidth).toBeLessThanOrEqual(Math.ceil(viewportWidth));
    await page.close();
  });
}

test("an unknown job returns HTTP 404, not someone else's data", async ({
  page,
}) => {
  await signIn(page);
  const res = await page.goto("/app/jobs/99-999");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This page could not be found")).toBeVisible();
  await expect(page.getByTestId("cost-table")).toHaveCount(0);
});

test("a cost overrun is never green: Mobilization with CPI under 1 and lost money shows amber", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  const mob = page
    .getByTestId("cost-tree-row")
    .filter({ hasText: "Mobilization" });
  await expect(mob).toBeVisible();
  const cell = mob.locator("[data-status]");
  // Seed builds forward from invoices (not target CPI 0.98); overrun must stay amber.
  await expect(cell).toHaveAttribute("data-status", "watch");
  await expect(cell).toContainText("−$");
});
