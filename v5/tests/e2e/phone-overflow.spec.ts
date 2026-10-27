import { expect, test, type Page } from "@playwright/test";

/**
 * 5.0.4-0: no sideways page scroll at phone widths for every demo role × nav page.
 * Spec: docs/v5/specs/5.0.4-clear-next-steps-and-mobile-polish.md (§ 5.0.4-0).
 *
 * Must-fail: restore JobStrip to `flex … overflow-x-auto` with `shrink-0` pills
 * (and drop html/shell `overflow-x-hidden`) → this file fails on scrollWidth and/or
 * job-strip children past clientWidth (the 422 px staging spill at 390).
 */

const ROLES = ["executive", "pm", "superintendent", "foreman"] as const;

/** Same paths as verify-v5 navCrawlPages for the Summit seed jobs. */
const NAV_PAGES = [
  "/app",
  "/app/jobs/24-077",
  "/app/jobs/24-118",
  "/app/jobs/25-031",
  "/app/jobs/26-010",
  "/app/assistant",
  "/changelog",
  "/status",
  "/roadmap",
] as const;

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const;

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

/** Spec 5.0.4-0 acceptance: scrollWidth ≤ clientWidth; strip children stay in view. */
async function assertNoPhoneOverflow(page: Page) {
  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const clientWidth = doc.clientWidth;
    const scrollWidth = Math.max(doc.scrollWidth, document.body?.scrollWidth ?? 0);
    const stripPast: string[] = [];
    const strip = document.querySelector('[data-testid="job-strip"]');
    if (strip) {
      for (const el of strip.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.right > clientWidth + 0.5) {
          stripPast.push(
            `${el.tagName.toLowerCase()}:${(el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40)}@${Math.round(r.right)}`,
          );
        }
      }
    }
    return { scrollWidth, clientWidth, stripPast };
  });

  expect(
    result.scrollWidth,
    `scrollWidth ${result.scrollWidth} > clientWidth ${result.clientWidth}`,
  ).toBeLessThanOrEqual(result.clientWidth);
  expect(
    result.stripPast,
    `job-strip past right edge: ${result.stripPast.join("; ")}`,
  ).toEqual([]);
}

for (const viewport of VIEWPORTS) {
  for (const role of ROLES) {
    test.describe(`${role} @ ${viewport.width}×${viewport.height}`, () => {
      test.use({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: true,
        hasTouch: true,
      });

      test(`nav pages do not scroll sideways`, async ({ page }) => {
        await signIn(page, role);
        // Spec: after Reset demo (fresh seed layout for the strip).
        await page.getByTestId("user-menu").click();
        await page.getByRole("button", { name: "Reset demo" }).click();
        await expect(page).toHaveURL(/reset=1/);

        for (const path of NAV_PAGES) {
          await page.goto(path);
          // Prefer visible chrome: foreman phone hides job-strip (hidden md:flex).
          await expect(
            page
              .locator(
                "main:visible, [data-testid='job-strip']:visible, [data-testid='phone-tab-bar']:visible",
              )
              .first(),
          ).toBeVisible({ timeout: 30_000 });
          await assertNoPhoneOverflow(page);
        }
      });
    });
  }
}
