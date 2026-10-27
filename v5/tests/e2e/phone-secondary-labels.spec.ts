import { expect, test, type Page } from "@playwright/test";

/**
 * RC phone bar: company name + job-strip labels must not hard-clip or rely on
 * hover titles (strict own-text scan ignores title). Wrap / reflow instead.
 *
 * Must-fail: restore `truncate` + `overflow-hidden` on company-name /
 * job-strip-label without wrapping → `clipped` is true below.
 */

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const;

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

type ClipHit = {
  testId: string;
  text: string;
  ellipsis: boolean;
  clipped: boolean;
};

/** Own-text overflow clip (same shape as verify-v5 isClipped). */
async function measureShellLabels(page: Page): Promise<ClipHit[]> {
  return page.evaluate(() => {
    const oneLine = (s: string | null | undefined) =>
      String(s ?? "")
        .replace(/\s+/g, " ")
        .trim();
    const hits: ClipHit[] = [];
    const nodes = document.querySelectorAll(
      '[data-testid="company-name"], [data-testid="job-strip-label"], [data-testid="strip-estimate-draft"], [data-testid="strip-plan-state"], [data-testid="strip-cost-indexes"]',
    );
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      const ellipsis = cs.textOverflow === "ellipsis";
      const hides =
        cs.overflowX === "hidden" ||
        cs.overflowX === "clip" ||
        (ellipsis && cs.overflowX !== "visible");
      const clipped =
        hides && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 0.5;
      hits.push({
        testId: el.getAttribute("data-testid") ?? "",
        text: oneLine(el.textContent),
        ellipsis,
        clipped,
      });
    }
    return hits;
  });
}

for (const viewport of VIEWPORTS) {
  test.describe(`shell labels @ ${viewport.width}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: true,
      hasTouch: true,
    });

    test("company name and job-strip labels wrap without clipping", async ({
      page,
    }) => {
      await signIn(page, "pm");
      await expect(page.getByTestId("company-name")).toBeVisible();
      await expect(page.getByTestId("job-strip")).toBeVisible();

      const company = page.getByTestId("company-name");
      await expect(company).toHaveText("Summit Highway & Bridge");

      const sr99 = page
        .getByTestId("job-strip-label")
        .filter({ hasText: "SR-99 Interchange" });
      await expect(sr99.first()).toBeVisible();
      await expect(sr99.first()).toContainText("24-118");

      const hits = await measureShellLabels(page);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.some((h) => h.text === "Summit Highway & Bridge")).toBe(true);
      expect(hits.some((h) => h.text.includes("SR-99 Interchange"))).toBe(true);
      for (const h of hits) {
        expect(h.clipped, `clipped "${h.text}" (${h.testId})`).toBe(false);
        expect(h.ellipsis, `ellipsis on "${h.text}" (${h.testId})`).toBe(false);
      }
    });

    test("foreman job pill shows the plan state without clipping", async ({
      page,
    }) => {
      await signIn(page, "foreman");
      await page.goto("/app/jobs/24-077");
      await expect(page.getByTestId("company-name")).toBeVisible();
      const pill = page
        .getByTestId("job-strip")
        .locator("a")
        .filter({ hasText: "24-077" });
      await expect(pill).toBeVisible();
      await expect(pill).toContainText("I-5 Culvert");
      await expect(pill).toContainText(/Report due|Reported|No plan today/);
      const hits = await measureShellLabels(page);
      expect(hits.some((h) => h.text.includes("24-077"))).toBe(true);
      for (const h of hits) {
        expect(h.clipped, `clipped "${h.text}" (${h.testId})`).toBe(false);
        expect(h.ellipsis, `ellipsis on "${h.text}" (${h.testId})`).toBe(false);
      }
    });
  });
}

test.describe("must-fail shell truncate @ 320", () => {
  test.use({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });

  test("forced truncate on company-name is detected as a clip", async ({
    page,
  }) => {
    await signIn(page, "pm");
    await expect(page.getByTestId("company-name")).toBeVisible();

    await page.evaluate(() => {
      const el = document.querySelector(
        '[data-testid="company-name"]',
      ) as HTMLElement | null;
      if (!el) return;
      el.style.overflow = "hidden";
      el.style.textOverflow = "ellipsis";
      el.style.whiteSpace = "nowrap";
      el.style.maxWidth = "40px";
    });

    const hits = await measureShellLabels(page);
    const company = hits.find((h) => h.testId === "company-name");
    expect(company?.clipped).toBe(true);
    expect(company?.ellipsis).toBe(true);
  });
});
