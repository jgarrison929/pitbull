import { expect, test, type Locator, type Page } from "@playwright/test";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Visual baselines for the trust bar.
 *
 * Harness rules (Verify #661 / #676):
 * - Full-height viewport shots (rails span the page; phone tab bar hidden)
 * - Server seed calendar frozen via V5_SEED_NOW (finish dates unmasked)
 * - Client clock frozen; visible LocalTime → gray chips (not finish dates)
 * - Fonts pinned (bundled Geist woff2 via next/font/local + document.fonts.ready)
 * - maxDiffPixels: 0 — a one-digit KPI change must fail
 * - Every light baseline has a dark twin (5.0.3 Part C), same 0 px tolerance
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

async function seedThemeCookie(
  page: Page,
  theme: "light" | "dark",
  baseURL: string | undefined,
) {
  if (theme === "light") return;
  await page.context().addCookies([
    {
      name: THEME_COOKIE,
      value: "dark",
      url: baseURL ?? "http://localhost:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
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

/** Wait until next/font Geist faces are loaded — no system-fallback glyphs in shots. */
async function waitForPinnedFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = [...document.fonts].filter((f) => f.status === "loaded");
    if (loaded.length === 0) {
      throw new Error("screenshot fonts: no @font-face loaded (Geist missing)");
    }
    // next/font names faces like "Geist" / "__Geist_…" — require a Geist match.
    const geist = loaded.some((f) => /geist/i.test(f.family));
    if (!geist) {
      throw new Error(
        `screenshot fonts: Geist not loaded (got ${[...new Set(loaded.map((f) => f.family))].join(", ")})`,
      );
    }
  });
}

async function stabilize(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }
      /* Pin AA + families to next/font/local CSS vars (static Geist woff2). */
      html {
        -webkit-font-smoothing: antialiased !important;
        -moz-osx-font-smoothing: grayscale !important;
        /* geometricPrecision avoids optimizeLegibility's extra glyph hinting.
           It does not cause the old 20px harbor-phone miss — that was
           variable-font wght AA (fixed by static faces in layout.tsx). */
        text-rendering: geometricPrecision !important;
        font-synthesis: none !important;
      }
      body {
        font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif !important;
      }
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
  await waitForPinnedFonts(page);
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

function visualSuite(theme: "light" | "dark") {
  const suffix = theme === "dark" ? "-dark" : "";

  test.describe(`${theme}`, () => {
    test.describe("desktop", () => {
      test.use({ viewport: { width: 1280, height: 800 } });

      test.beforeEach(async ({ page, baseURL }) => {
        await seedThemeCookie(page, theme, baseURL);
      });

      test("login", async ({ page }) => {
        await freezeClock(page);
        await page.goto("/login");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (theme === "dark") {
          await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
        }
        await shotPage(page, `login-desktop${suffix}`);
      });

      test("portfolio as executive", async ({ page }) => {
        await signIn(page, "executive");
        await expect(page.getByTestId("portfolio-table")).toBeVisible();
        await shotPage(page, `portfolio-desktop${suffix}`);
      });

      test("job page as pm", async ({ page }) => {
        await signIn(page, "pm");
        await page.goto("/app/jobs/25-031");
        await expect(page.getByTestId("cost-table")).toBeVisible();
        // Working surface: seeded tomorrow plan only — past days are plan-history.
        await expect(
          page.locator('[data-testid="plan-card"][data-plan-date="2026-10-21"]'),
        ).toBeVisible();
        await expect(page.getByTestId("plan-history")).toBeVisible();
        await expect(page.getByTestId("job-changes")).toBeVisible();
        await expect(page.getByTestId("job-finish")).toBeVisible();
        await shotPage(page, `job-desktop${suffix}`);
      });

      test("harbor 26-010 change history as pm", async ({ page }) => {
        await signIn(page, "pm");
        await page.goto("/app/jobs/26-010");
        await expect(page.getByText("No changes yet.")).toHaveCount(0);
        const changes = page.getByTestId("job-changes");
        await expect(changes).toBeVisible();
        await expect(changes.locator("li").first()).toBeVisible();
        await shotPage(page, `job-harbor-desktop${suffix}`);
      });

      test("daily plan as foreman", async ({ page }) => {
        await signIn(page, "foreman");
        await page.goto("/app/jobs/25-031");
        const plan = page.getByTestId("plan-card");
        await expect(plan).toBeVisible();
        await expect(page.getByTestId("submit-plan")).toBeVisible();
        await shotElement(plan, `plan-desktop${suffix}`, page);
      });

      test("new plan as superintendent", async ({ page }) => {
        await signIn(page, "superintendent");
        await page.goto("/app/jobs/25-031");
        await expect(page.getByTestId("new-plan")).toBeVisible();
        await expect(
          page.locator('[data-testid="plan-card"][data-plan-date="2026-10-21"]'),
        ).toBeVisible();
        await expect(page.getByTestId("plan-history")).toBeVisible();
        await shotPage(page, `job-superintendent-desktop${suffix}`);
      });
    });

    test.describe("phone", () => {
      test.use({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });

      test.beforeEach(async ({ page, baseURL }) => {
        await seedThemeCookie(page, theme, baseURL);
      });

      test("login", async ({ page }) => {
        await freezeClock(page);
        await page.goto("/login");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await shotPage(page, `login-phone${suffix}`);
      });

      test("portfolio as executive", async ({ page }) => {
        await signIn(page, "executive");
        await expect(page.getByTestId("portfolio-table")).toBeVisible();
        await shotPage(page, `portfolio-phone${suffix}`);
      });

      test("job page as pm", async ({ page }) => {
        await signIn(page, "pm");
        await page.goto("/app/jobs/25-031");
        await expect(page.getByTestId("cost-list")).toBeVisible();
        await expect(
          page.locator('[data-testid="plan-card"][data-plan-date="2026-10-21"]'),
        ).toBeVisible();
        await expect(page.getByTestId("plan-history")).toBeVisible();
        await shotPage(page, `job-phone${suffix}`);
      });

      test("harbor 26-010 change history as pm", async ({ page }) => {
        await signIn(page, "pm");
        await page.goto("/app/jobs/26-010");
        await expect(page.getByText("No changes yet.")).toHaveCount(0);
        await expect(page.getByTestId("job-changes")).toBeVisible();
        await shotPage(page, `job-harbor-phone${suffix}`);
      });

      test("daily plan as foreman", async ({ page }) => {
        await signIn(page, "foreman");
        await page.goto("/app/jobs/25-031");
        const plan = page.getByTestId("plan-card");
        await expect(plan).toBeVisible();
        await expect(page.getByTestId("submit-plan")).toBeVisible();
        // Tab bar hidden in stabilize so Submit plan stays visible in the shot.
        await shotElement(plan, `plan-phone${suffix}`, page);
      });
    });
  });
}

test.describe("visual baselines", () => {
  visualSuite("light");
  visualSuite("dark");

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

    /**
     * Dark twin must also be zero-tolerance — a one-digit KPI change fails.
     */
    test("one digit fails the job-desktop-dark visual check", async ({
      page,
      baseURL,
    }, testInfo) => {
      test.skip(
        testInfo.config.updateSnapshots === "all" ||
          testInfo.config.updateSnapshots === "changed",
        "skip while updating snapshots",
      );

      await seedThemeCookie(page, "dark", baseURL);
      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031");
      const budget = page.getByTestId("job-budget");
      await expect(budget).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await stabilize(page);
      await fitViewportToPage(page);

      await expect(page).toHaveScreenshot("job-desktop-dark.png", {
        ...SHOT_OPTS,
        fullPage: false,
      });

      await budget.evaluate((el) => {
        el.textContent = (el.textContent ?? "").replace("$12.9M", "$12.8M");
      });

      let failed = false;
      try {
        await expect(page).toHaveScreenshot("job-desktop-dark.png", {
          ...SHOT_OPTS,
          fullPage: false,
        });
      } catch {
        failed = true;
      }
      expect(
        failed,
        "expected a one-digit Current budget change to fail the dark twin",
      ).toBe(true);
    });
  });
});
