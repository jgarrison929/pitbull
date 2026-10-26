/**
 * Regression lock for leftover shell/docs chrome prefetch after #29:
 * /changelog and /roadmap still used next/link for Back → /app, which fired
 * /app?_rsc= after paint and aborted (ERR_ABORTED) when the crawl left.
 * Those pages (and /status cross-links) are plain <a> now.
 */
import { expect, test, type Browser } from "@playwright/test";

const DOCS_PAGES = ["/changelog", "/roadmap", "/status"] as const;

async function assertNoAppRscAfterLoad(browser: Browser, path: string) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  const appRscAfterLoad: string[] = [];
  let loadAt = 0;
  page.on("request", (req) => {
    if (loadAt === 0) return;
    const u = new URL(req.url());
    if (!u.searchParams.has("_rsc")) return;
    if (Date.now() < loadAt) return;
    if (u.pathname === "/app" || u.pathname === "/changelog" || u.pathname === "/roadmap" || u.pathname === "/status") {
      appRscAfterLoad.push(`${u.pathname}${u.search}`);
    }
  });

  const res = await page.goto(path, { waitUntil: "load" });
  loadAt = Date.now();
  await page.waitForLoadState("networkidle");

  expect(res?.status()).toBe(200);
  expect(
    appRscAfterLoad,
    `docs chrome RSC after load on ${path}: ${appRscAfterLoad.join(", ")}`,
  ).toEqual([]);
  await context.close();
}

test.describe("docs chrome prefetch", () => {
  for (const path of DOCS_PAGES) {
    test(`${path}: no /app|/changelog|/roadmap|/status ?_rsc= after document`, async ({
      browser,
    }) => {
      await assertNoAppRscAfterLoad(browser, path);
    });
  }
});
