import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

test.describe("5.1.0-c schedule Gantt", () => {
  test("Cedar seeded Gantt lists A–E; expanding C shows 04-210", async ({
    page,
  }) => {
    await signIn(page, "pm");
    await page.goto("/app/jobs/25-031/schedule");
    await expect(page.getByTestId("job-gantt")).toBeVisible();
    for (const code of ["A", "B", "C", "D", "E"]) {
      await expect(
        page.locator(`[data-testid="gantt-activity"][data-code="${code}"]`),
      ).toHaveCount(2); // stack (phone CSS) + chart (desktop CSS); both in DOM
    }
    // Expand C on the visible surface (desktop chart at default 1280).
    const chartRow = page
      .getByTestId("gantt-chart")
      .locator('[data-testid="gantt-activity"][data-code="C"]');
    await chartRow.getByTestId("gantt-activity-toggle").click();
    await expect(chartRow.getByTestId("gantt-linked-cost")).toContainText(
      "04-210",
    );
  });

  test("Harbor draft has no Schedule section and schedule URL 404s", async ({
    page,
  }) => {
    await signIn(page, "pm");
    await page.goto("/app/jobs/26-010");
    await expect(page.getByTestId("job-schedule-section")).toHaveCount(0);
    const res = await page.goto("/app/jobs/26-010/schedule");
    expect(res?.status()).toBe(404);
  });

  test("phone stacked list: no chart, tab bar on screen, no overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031/schedule");
    await expect(page.getByTestId("gantt-stack")).toBeVisible();
    await expect(page.getByTestId("gantt-chart")).toBeHidden();
    await expect(page.getByTestId("phone-tab-bar")).toBeVisible();
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      const vw = Math.min(390, window.visualViewport?.width ?? 390);
      const sw = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0);
      return sw - Math.ceil(vw);
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });

  for (const width of [320, 375, 390] as const) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await signIn(page, "superintendent");
      await page.goto("/app/jobs/25-031/schedule");
      await expect(page.getByTestId("gantt-stack")).toBeVisible();
      const overflow = await page.evaluate((w) => {
        const doc = document.documentElement;
        const vw = Math.min(w, window.visualViewport?.width ?? w);
        const sw = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0);
        return sw - Math.ceil(vw);
      }, width);
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByTestId("phone-tab-bar")).toBeVisible();
    });
  }
});
