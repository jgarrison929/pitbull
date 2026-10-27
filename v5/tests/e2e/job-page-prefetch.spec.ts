/**
 * Behavior lock: job-page drill links must not fire post-paint `?_rsc=`
 * prefeches (Next 16.4 + partialPrefetching). Same root cause as #29 /
 * NavLink — those prefeches re-enter proxy+app pools and hold networkidle
 * on the warm 24-browser burst.
 */
import { expect, test } from "@playwright/test";

const JOBS = ["24-077", "24-118"] as const;

async function signInAsPm(
  page: import("@playwright/test").Page,
) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByTestId("role-pm").click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}

test.describe("job page drill prefetch", () => {
  for (const job of JOBS) {
    test(`${job}: no ?_rsc= after document load`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      const page = await context.newPage();
      await signInAsPm(page);

      const rscAfterLoad: string[] = [];
      let loadAt = 0;
      page.on("request", (req) => {
        if (loadAt === 0) return;
        const u = new URL(req.url());
        if (!u.searchParams.has("_rsc")) return;
        // Any post-paint RSC on this job (plans, cost-items, changes, self).
        if (u.pathname.startsWith(`/app/jobs/${job}`)) {
          rscAfterLoad.push(`${u.pathname}${u.search}`);
        }
      });

      const res = await page.goto(`/app/jobs/${job}`, {
        waitUntil: "load",
        timeout: 60_000,
      });
      loadAt = Date.now();
      await page.waitForLoadState("networkidle");

      expect(res?.status()).toBe(200);
      // Sanity: drill anchors are present and are real links.
      await expect(page.getByTestId("plan-detail-link").first()).toBeVisible();
      await expect(page.getByTestId("job-changes-full-link")).toBeVisible();
      const costLinks = page.locator('[data-testid^="cost-code-link-"]');
      await expect(costLinks.first()).toBeVisible();

      expect(
        rscAfterLoad,
        `post-paint RSC on /app/jobs/${job}: ${rscAfterLoad.join(", ")}`,
      ).toEqual([]);
      await context.close();
    });
  }
});
