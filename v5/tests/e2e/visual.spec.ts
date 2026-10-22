import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Small, stable visual baselines for the trust bar.
 * Masks live timestamps and sandbox ids so drift is about real UI, not clocks.
 */

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

/** Regions that change every sandbox / every second. */
function masks(page: Page): Locator[] {
  return [
    page.getByTestId("sandbox-id"),
    page.getByTestId("seeded-at"),
    page.getByTestId("data-source"),
    page.locator("time[datetime]"),
  ];
}

async function shot(page: Page, name: string) {
  // Wait for primary content; disable CSS animations for deterministic pixels.
  await page.addStyleTag({
    content: `*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }`,
  });
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: false,
    animations: "disabled",
    mask: masks(page),
    maxDiffPixelRatio: 0.02,
  });
}

test.describe("visual baselines", () => {
  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("login", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shot(page, "login-desktop");
    });

    test("portfolio as executive", async ({ page }) => {
      await signIn(page, "executive");
      await expect(page.getByTestId("portfolio-table")).toBeVisible();
      await shot(page, "portfolio-desktop");
    });

    test("job page as pm", async ({ page }) => {
      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("cost-table")).toBeVisible();
      await expect(page.getByTestId("plan-card")).toBeVisible();
      await shot(page, "job-desktop");
    });

    test("daily plan as foreman", async ({ page }) => {
      await signIn(page, "foreman");
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("plan-card")).toBeVisible();
      await expect(page.getByTestId("submit-plan")).toBeVisible();
      await shot(page, "plan-desktop");
    });
  });

  test.describe("phone", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    test("login", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shot(page, "login-phone");
    });

    test("portfolio as executive", async ({ page }) => {
      await signIn(page, "executive");
      await expect(page.getByTestId("portfolio-table")).toBeVisible();
      await shot(page, "portfolio-phone");
    });

    test("job page as pm", async ({ page }) => {
      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("cost-list")).toBeVisible();
      await shot(page, "job-phone");
    });

    test("daily plan as foreman", async ({ page }) => {
      await signIn(page, "foreman");
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("plan-card")).toBeVisible();
      await shot(page, "plan-phone");
    });
  });
});
