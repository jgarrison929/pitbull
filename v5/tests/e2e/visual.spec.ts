import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Visual baselines for the trust bar.
 *
 * Harness rules (Verify #661 / #676):
 * - Full-height viewport shots (rails span the page; phone tab bar hidden)
 * - Server seed calendar frozen via V5_SEED_NOW (finish dates unmasked)
 * - Client clock frozen; visible LocalTime → gray chips (not finish dates)
 * - maxDiffPixels: 0 — a one-digit KPI change must fail
 */

/** Must match playwright.config webServer env V5_SEED_NOW. */
const FROZEN_NOW = "2026-10-20T17:00:00.000Z";

/** Zero tolerance — measured run-to-run noise is 0 on Linux Chromium. */
const SHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixels: 0,
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
 * LocalTime SSR is `… UTC`; wait for hydration, then chip volatile times.
 * Never chip job-finish (frozen by V5_SEED_NOW; must stay readable) or
 * closed-menu seeded-at (layout still paints it).
 */
async function waitForHydratedTimes(page: Page) {
  const times = page.locator("time[datetime]");
  const n = await times.count();
  for (let i = 0; i < n; i++) {
    const t = times.nth(i);
    if (!(await t.isVisible())) continue;
    const skip = await t.evaluate((el) => {
      if (el.closest("details:not([open])")) return true;
      if (el.getAttribute("data-testid") === "job-finish") return true;
      return false;
    });
    if (skip) continue;
    await expect(t).not.toContainText("UTC");
  }
}

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      /* Hide fixed phone tab bar so full-page shots never paint it mid-content. */
      [data-testid="phone-tab-bar"] { display: none !important; }
      time[datetime] {
        display: inline-block !important;
        width: 8.5rem !important;
        height: 1em !important;
        overflow: hidden !important;
        color: transparent !important;
        background: #d4d4d8 !important;
        border-radius: 2px !important;
        vertical-align: -0.1em !important;
      }
      details:not([open]) time[datetime],
      time[data-testid="job-finish"] {
        display: inline !important;
        width: auto !important;
        height: auto !important;
        overflow: visible !important;
        color: inherit !important;
        background: transparent !important;
        border-radius: 0 !important;
        vertical-align: baseline !important;
      }
    `,
  });
  await expect(page.locator(".animate-pulse")).toHaveCount(0);
  await waitForHydratedTimes(page);
}

/**
 * Grow the viewport to the document height so sticky `h-svh` rails paint the
 * full page (fullPage stitching otherwise clips them at the original 800px).
 */
async function fitViewportToPage(page: Page) {
  const box = page.viewportSize();
  if (!box) throw new Error("no viewport");
  const contentHeight = await page.evaluate(() =>
    Math.ceil(
      Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0,
      ),
    ),
  );
  await page.setViewportSize({
    width: box.width,
    height: Math.max(box.height, contentHeight),
  });
}

async function shotPage(page: Page, name: string) {
  await stabilize(page);
  await fitViewportToPage(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    ...SHOT_OPTS,
    fullPage: false,
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
      await expect(page.getByTestId("job-finish")).toBeVisible();
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
      // Tab bar hidden in stabilize so Submit plan stays visible in the shot.
      await shotElement(plan, "plan-phone", page);
    });
  });

  test.describe("acceptance", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    /**
     * One visible digit in a headline KPI must fail the visual check.
     * Mutation is in-page only — never committed.
     */
    test("one digit in Current budget fails the job-desktop visual check", async ({
      page,
    }, testInfo) => {
      test.skip(
        testInfo.config.updateSnapshots === "all" ||
          testInfo.config.updateSnapshots === "changed",
        "skip while updating snapshots",
      );

      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      const budget = page.getByTestId("job-budget");
      await expect(budget).toBeVisible();
      await expect(budget).toContainText("$12.9M");
      await stabilize(page);
      await fitViewportToPage(page);

      await expect(page).toHaveScreenshot("job-desktop.png", {
        ...SHOT_OPTS,
        fullPage: false,
      });

      // One digit: $12.9M → $12.8M (Verify measured ~120px; with maxDiffPixels:0 must fail).
      await budget.evaluate((el) => {
        el.textContent = (el.textContent ?? "").replace("$12.9M", "$12.8M");
      });
      await expect(budget).toContainText("$12.8M");

      let failed = false;
      try {
        await expect(page).toHaveScreenshot("job-desktop.png", {
          ...SHOT_OPTS,
          fullPage: false,
        });
      } catch {
        failed = true;
      }
      expect(
        failed,
        "expected a one-digit Current budget change ($12.9M→$12.8M) to fail toHaveScreenshot",
      ).toBe(true);
    });
  });
});
