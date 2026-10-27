import { expect, test, type Page } from "@playwright/test";

/**
 * RC phone bar: secondary labels (company name + job-strip) may ellipsize at
 * ≤480 only when own `title` equals full text (verify-v5 secondaryReachable).
 *
 * Staging / RC hard gate: untitled ellipsis on "Summit Highway & Bridge" and
 * "SR-99 Interchange 24-118" fails the crawl (hundreds of clipped hits).
 *
 * Must-fail: drop `title` from SecondaryEllipsis in shell.tsx (or strip titles
 * below) → `reachable` is false on truncated labels.
 */

const PHONE = { width: 320, height: 568 } as const;

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

type ClipHit = {
  testId: string;
  text: string;
  ellipsis: boolean;
  truncated: boolean;
  title: string | null;
  reachable: boolean;
};

/** Same reachability rule as verify-v5 `secondaryReachable` (own title === text). */
async function measureSecondaryLabels(page: Page): Promise<ClipHit[]> {
  return page.evaluate(() => {
    const oneLine = (s: string | null | undefined) =>
      String(s ?? "")
        .replace(/\s+/g, " ")
        .trim();
    const hits: ClipHit[] = [];
    const nodes = document.querySelectorAll(
      '[data-testid="company-name"], [data-testid="job-strip-label"], [data-testid="strip-estimate-draft"], [data-testid="strip-plan-state"]',
    );
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      const ellipsis = cs.textOverflow === "ellipsis";
      const hides =
        cs.overflowX === "hidden" ||
        cs.overflowX === "clip" ||
        (ellipsis && cs.overflowX !== "visible");
      const truncated =
        hides && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 0.5;
      const text = oneLine(el.textContent);
      const title = el.getAttribute("title");
      const reachable = oneLine(title) === text && text.length > 0;
      hits.push({
        testId: el.getAttribute("data-testid") ?? "",
        text,
        ellipsis,
        truncated,
        title,
        reachable,
      });
    }
    return hits;
  });
}

test.describe("phone secondary labels @ 320", () => {
  test.use({
    viewport: { width: PHONE.width, height: PHONE.height },
    isMobile: true,
    hasTouch: true,
  });

  test("company name and job-strip labels are reachable when truncated", async ({
    page,
  }) => {
    await signIn(page, "pm");
    await expect(page.getByTestId("company-name")).toBeVisible();
    await expect(page.getByTestId("job-strip")).toBeVisible();

    const company = page.getByTestId("company-name");
    await expect(company).toHaveText("Summit Highway & Bridge");
    await expect(company).toHaveAttribute("title", "Summit Highway & Bridge");

    const sr99 = page
      .getByTestId("job-strip-label")
      .filter({ hasText: "SR-99 Interchange" });
    await expect(sr99.first()).toBeVisible();
    await expect(sr99.first()).toHaveAttribute(
      "title",
      "SR-99 Interchange 24-118",
    );

    const hits = await measureSecondaryLabels(page);
    expect(hits.length).toBeGreaterThan(0);
    const truncated = hits.filter((h) => h.truncated);
    // At 320 the company name and long job labels typically truncate; when they
    // do, title must equal full text (verify-v5 secondary exception).
    for (const h of truncated) {
      expect(
        h.reachable,
        `truncated secondary "${h.text}" (${h.testId}) needs own title equal to full text`,
      ).toBe(true);
      expect(h.ellipsis, `hard clip on "${h.text}"`).toBe(true);
    }
    // Known seed labels must be present even if this viewport does not truncate.
    expect(hits.some((h) => h.text === "Summit Highway & Bridge")).toBe(true);
    expect(hits.some((h) => h.text === "SR-99 Interchange 24-118")).toBe(true);
  });

  test("must-fail: untitled truncated secondary labels are unreachable", async ({
    page,
  }) => {
    await signIn(page, "pm");
    await expect(page.getByTestId("company-name")).toBeVisible();

    // Simulate the pre-fix shell (truncate without title).
    await page.evaluate(() => {
      for (const el of document.querySelectorAll(
        '[data-testid="company-name"], [data-testid="job-strip-label"]',
      )) {
        el.removeAttribute("title");
      }
    });

    const hits = await measureSecondaryLabels(page);
    const bad = hits.filter((h) => h.truncated && !h.reachable);
    expect(
      bad.length,
      "expected at least one untitled truncated secondary label after stripping titles",
    ).toBeGreaterThan(0);
    expect(
      bad.some(
        (h) =>
          h.text === "Summit Highway & Bridge" ||
          h.text === "SR-99 Interchange 24-118",
      ),
    ).toBe(true);
  });
});
