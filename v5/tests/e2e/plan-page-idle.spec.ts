/**
 * Regression lock for plan-detail networkidle (staging 5.0.3 verify FAIL):
 * next/link on back + per-line cost-code hrefs fired ?_rsc= after document and
 * held idle ~1043–1616 ms for superintendent. Plain <a> + one-wave getPlanPage.
 *
 * CI: no shell/job RSC after load + idle ≤ 800 ms (stricter than verify 1.5 s).
 * Multi-sample p95: node scripts/plan-page-idle-acceptance.mjs
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

/** Product target for this slice — verify crawl budget stays 1500. */
const MAX_MS = 800;
const JOB = "24-118";

const SHELL_OR_JOB =
  /^\/(app|app\/assistant|status|changelog|app\/jobs\/\d{2}-\d{3})(\?|$)/;

async function signInSuperintendent(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByTestId("role-superintendent").click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

/** First labor-row plan link on a Part C cost-item page (ids are per sandbox). */
async function firstPlanPath(page: Page): Promise<string> {
  await page.goto(`/app/jobs/${JOB}/cost-items/03-200`, {
    waitUntil: "networkidle",
  });
  const link = page.getByTestId("cost-entry-plan-link").first();
  await expect(link).toBeVisible({ timeout: 15_000 });
  const href = await link.getAttribute("href");
  expect(href, "plan link href").toMatch(/\/plans\/[0-9a-f-]{36}$/i);
  return href!;
}

async function assertPlanIdle(browser: Browser, width: number) {
  const context = await browser.newContext(
    width < 768
      ? {
          viewport: { width, height: 844 },
          isMobile: true,
          hasTouch: true,
          deviceScaleFactor: 2,
        }
      : { viewport: { width, height: 900 } },
  );
  const page = await context.newPage();
  await signInSuperintendent(page);
  const path = await firstPlanPath(page);

  const rscAfterLoad: string[] = [];
  let loadAt = 0;
  page.on("request", (req) => {
    if (loadAt === 0) return;
    const u = new URL(req.url());
    if (!u.searchParams.has("_rsc")) return;
    if (Date.now() < loadAt) return;
    if (SHELL_OR_JOB.test(u.pathname) || /\/plans\//.test(u.pathname)) {
      rscAfterLoad.push(`${u.pathname}${u.search}`);
    }
  });

  const t0 = Date.now();
  const res = await page.goto(path, { waitUntil: "load" });
  loadAt = Date.now();
  await page.waitForLoadState("networkidle");
  const idleMs = Date.now() - t0;

  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("plan-detail-lines")).toBeVisible();
  expect(
    rscAfterLoad,
    `shell/plan RSC after load @${width}: ${rscAfterLoad.join(", ")}`,
  ).toEqual([]);
  expect(idleMs, `idle @${width} ${path}`).toBeLessThanOrEqual(MAX_MS);
  await context.close();
}

test.describe("plan detail idle", () => {
  test("superintendent@320: no post-load RSC + idle ≤ 800 ms", async ({
    browser,
  }) => {
    await assertPlanIdle(browser, 320);
  });

  test("superintendent@1280: no post-load RSC + idle ≤ 800 ms", async ({
    browser,
  }) => {
    await assertPlanIdle(browser, 1280);
  });
});
