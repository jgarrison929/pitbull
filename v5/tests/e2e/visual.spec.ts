import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Visual baselines for the trust bar.
 *
 * Harness rules (Verify #661 follow-up):
 * - Full-page or element shots that include every asserted control
 * - Frozen client clock + V5_SEED_NOW so plan dates / LocalTime stay fixed
 * - No masks on closed-menu sandbox chips (Chromium still lays them out)
 * - Near-zero pixel tolerance (anti-alias only) so a money-digit drift fails
 */

/** Must match playwright.config webServer env V5_SEED_NOW. */
const FROZEN_NOW = "2026-10-20T17:00:00.000Z";

/** Anti-aliasing only — a changed dollar digit must fail. */
const SHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixels: 120,
};

async function freezeClock(page: Page) {
  await page.clock.install({ time: new Date(FROZEN_NOW) });
}

async function signIn(page: Page, role: string) {
  await freezeClock(page);
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

/**
 * LocalTime SSR is `… UTC`; the client hydrates to a locale string. Wait for
 * hydration, then replace visible action/history timestamps with fixed gray
 * chips so glyph anti-aliasing cannot flake the rail. Never touch closed-menu
 * `seeded-at` (masking that paints over the job strip / H1).
 */
async function waitForHydratedTimes(page: Page) {
  const times = page.locator(
    '[data-testid="action-run"] time[datetime], [data-testid="job-changes"] time[datetime]',
  );
  const n = await times.count();
  for (let i = 0; i < n; i++) {
    await expect(times.nth(i)).not.toContainText("UTC");
  }
}

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      [data-testid="action-run"] time[datetime],
      [data-testid="job-changes"] time[datetime] {
        display: inline-block !important;
        width: 8.5rem !important;
        height: 1em !important;
        overflow: hidden !important;
        color: transparent !important;
        background: #d4d4d8 !important;
        border-radius: 2px !important;
        vertical-align: -0.1em !important;
      }
    `,
  });
  // Drop Suspense pulse placeholders before we shoot.
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  await waitForHydratedTimes(page);
}

async function shotPage(page: Page, name: string) {
  await stabilize(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    ...SHOT_OPTS,
    fullPage: true,
  });
}

async function shotElement(locator: Locator, name: string, page: Page) {
  await stabilize(page);
  await expect(locator).toHaveScreenshot(`${name}.png`, {
    ...SHOT_OPTS,
  });
}

test.describe("visual baselines", () => {
  test.describe("desktop", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("login", async ({ page }) => {
      await freezeClock(page);
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shotPage(page, "login-desktop");
    });

    test("portfolio as executive", async ({ page }) => {
      await signIn(page, "executive");
      await expect(page.getByTestId("portfolio-table")).toBeVisible();
      await shotPage(page, "portfolio-desktop");
    });

    test("job page as pm", async ({ page }) => {
      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("cost-table")).toBeVisible();
      await expect(page.getByTestId("plan-card")).toBeVisible();
      await expect(page.getByTestId("job-changes")).toBeVisible();
      // Full page catches cost table + changes + rails (viewport-only missed them).
      await shotPage(page, "job-desktop");
    });

    test("harbor 26-010 change history as pm", async ({ page }) => {
      await signIn(page, "pm");
      await page.goto("/app/jobs/26-010");
      await expect(page.getByText("No changes yet.")).toHaveCount(0);
      const changes = page.getByTestId("job-changes");
      await expect(changes).toBeVisible();
      await expect(changes.locator("li").first()).toBeVisible();
      await shotPage(page, "job-harbor-desktop");
    });

    test("daily plan as foreman", async ({ page }) => {
      await signIn(page, "foreman");
      await page.goto("/app/jobs/25-031");
      const plan = page.getByTestId("plan-card");
      await expect(plan).toBeVisible();
      await expect(page.getByTestId("submit-plan")).toBeVisible();
      // Element shot keeps Submit plan + crew/MH footer in frame.
      await shotElement(plan, "plan-desktop", page);
    });
  });

  test.describe("phone", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    test("login", async ({ page }) => {
      await freezeClock(page);
      await page.goto("/login");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await shotPage(page, "login-phone");
    });

    test("portfolio as executive", async ({ page }) => {
      await signIn(page, "executive");
      await expect(page.getByTestId("portfolio-table")).toBeVisible();
      await shotPage(page, "portfolio-phone");
    });

    test("job page as pm", async ({ page }) => {
      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("cost-list")).toBeVisible();
      await shotPage(page, "job-phone");
    });

    test("harbor 26-010 change history as pm", async ({ page }) => {
      await signIn(page, "pm");
      await page.goto("/app/jobs/26-010");
      await expect(page.getByText("No changes yet.")).toHaveCount(0);
      await expect(page.getByTestId("job-changes")).toBeVisible();
      await shotPage(page, "job-harbor-phone");
    });

    test("daily plan as foreman", async ({ page }) => {
      await signIn(page, "foreman");
      await page.goto("/app/jobs/25-031");
      const plan = page.getByTestId("plan-card");
      await expect(plan).toBeVisible();
      await expect(page.getByTestId("submit-plan")).toBeVisible();
      await shotElement(plan, "plan-phone", page);
    });
  });

  test.describe("acceptance", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    /**
     * A $1 EAC mutation must fail the visual check. Uses exact-cent text so the
     * digit change is visible even when usdShort would still round to $14.7M.
     * The mutation is in-page only — never committed.
     */
    test("EAC $1 drift fails the job-desktop visual check", async ({
      page,
    }, testInfo) => {
      // Mutates the live page — never refresh baselines from this test.
      test.skip(
        testInfo.config.updateSnapshots === "all" ||
          testInfo.config.updateSnapshots === "changed",
        "skip while updating snapshots",
      );

      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("job-eac")).toBeVisible();
      await expect(page.getByTestId("cost-table")).toBeVisible();
      await stabilize(page);

      // Clean page must match baseline (regen before this is green in CI).
      await expect(page).toHaveScreenshot("job-desktop.png", {
        ...SHOT_OPTS,
        fullPage: true,
      });

      await page.getByTestId("job-eac").evaluate((el) => {
        const cents = Number(el.getAttribute("data-cents") ?? "0") + 100; // +$1
        const a = Math.abs(cents);
        const dollars = Math.trunc(a / 100).toLocaleString("en-US");
        el.textContent = `$${dollars}.${String(a % 100).padStart(2, "0")}`;
      });

      let failed = false;
      try {
        await expect(page).toHaveScreenshot("job-desktop.png", {
          ...SHOT_OPTS,
          fullPage: true,
        });
      } catch {
        failed = true;
      }
      expect(
        failed,
        "expected a $1 EAC text mutation to fail toHaveScreenshot",
      ).toBe(true);
    });
  });
});
