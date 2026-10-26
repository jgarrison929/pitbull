/**
 * Regression lock for cost-item drill networkidle:
 * next/link (even with prefetch={false}) still fired ?_rsc= after document —
 * shell/job-strip first, then desktop assistant-rail Open hrefs (aside is
 * lg:flex → @1280 only). Those are plain <a> now.
 *
 * CI: no shell/job RSC after load + idle ≤ 1.5 s at 320 and 1280.
 * Full 20-load p95: node scripts/cost-item-idle-acceptance.mjs
 */
import { expect, test, type Browser, type Page } from "@playwright/test";

const MAX_MS = 1500;
const FAILING_DRILL = "/app/jobs/24-118/cost-items/03-200";
const ALSO_DRILL = "/app/jobs/24-077/cost-items/09-500";

const SHELL_OR_JOB =
  /^\/(app|app\/assistant|status|changelog|app\/jobs\/\d{2}-\d{3})(\?|$)/;

async function signInExecutive(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByTestId("role-executive").click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

async function assertNoShellRscAfterLoad(
  browser: Browser,
  width: number,
  path: string,
) {
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
  await signInExecutive(page);

  const rscAfterLoad: string[] = [];
  let loadAt = 0;
  page.on("request", (req) => {
    if (loadAt === 0) return;
    const u = new URL(req.url());
    if (!u.searchParams.has("_rsc")) return;
    if (Date.now() < loadAt) return;
    if (SHELL_OR_JOB.test(u.pathname)) {
      rscAfterLoad.push(`${u.pathname}${u.search}`);
    }
  });

  const t0 = Date.now();
  const res = await page.goto(path, { waitUntil: "load" });
  loadAt = Date.now();
  await page.waitForLoadState("networkidle");
  const idleMs = Date.now() - t0;

  expect(res?.status()).toBe(200);
  expect(
    rscAfterLoad,
    `shell/job RSC after load @${width}: ${rscAfterLoad.join(", ")}`,
  ).toEqual([]);
  expect(idleMs, `idle @${width} ${path}`).toBeLessThanOrEqual(MAX_MS);
  await context.close();
}

test.describe("cost-item drill idle tail", () => {
  test("phone@320: no shell/job RSC after document on 09-500", async ({
    browser,
  }) => {
    await assertNoShellRscAfterLoad(browser, 320, ALSO_DRILL);
  });

  test("desktop@1280: no shell/job RSC after document on 03-200", async ({
    browser,
  }) => {
    await assertNoShellRscAfterLoad(browser, 1280, FAILING_DRILL);
  });
});
