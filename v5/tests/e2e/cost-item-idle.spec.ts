/**
 * Acceptance for the staging verify FAIL on cost-item drill networkidle:
 * document lands fast, then Next Link prefetch ?_rsc= for phone tabs + job
 * strip held idle ~1.6 s. Prefetch is off on those Links; this proves:
 *   1) after document load, no shell/job-strip RSC prefetch fires before idle
 *   2) 20 cold loads × listed cost-item drills @ 320/768/1280: p95 < 1.2 s,
 *      max < 1.5 s (verify crawl budget unchanged at 1.5 s; no retries)
 */
import { expect, test, type Page } from "@playwright/test";

const SAMPLES = 20;
const P95_MS = 1200;
const MAX_MS = 1500;
const WIDTHS = [320, 768, 1280] as const;
/** Seeded drills that staging hit hardest (24-077/09-500 was the 1,781 ms miss). */
const DRILLS = [
  "/app/jobs/24-077/cost-items/09-500",
  "/app/jobs/24-077/cost-items/08-200",
  "/app/jobs/24-118/cost-items/03-200",
] as const;

const SHELL_PREFETCH =
  /^\/(app|app\/assistant|status|changelog|app\/jobs\/\d{2}-\d{3})(\?|$)/;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

async function signInExecutive(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.getByTestId("role-executive").click();
  await page.waitForURL(/\/app(\?|$)/, { timeout: 30_000 });
  await page.waitForLoadState("networkidle");
}

async function measureIdle(page: Page, path: string) {
  const t0 = Date.now();
  const res = await page.goto(path, { waitUntil: "load" });
  const loadMs = Date.now() - t0;
  await page.waitForLoadState("networkidle");
  const idleMs = Date.now() - t0;
  return { status: res?.status() ?? 0, loadMs, idleMs };
}

test.describe("cost-item drill idle tail", () => {
  test("phone@320: no shell/job-strip RSC prefetch after document", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 320, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await signInExecutive(page);

    const path = DRILLS[0];
    const rscAfterLoad: string[] = [];
    let loadAt = 0;
    page.on("request", (req) => {
      if (loadAt === 0) return;
      const u = new URL(req.url());
      if (!u.searchParams.has("_rsc")) return;
      if (Date.now() < loadAt) return;
      const short = `${u.pathname}${u.search}`;
      if (SHELL_PREFETCH.test(u.pathname)) rscAfterLoad.push(short);
    });

    const t0 = Date.now();
    const res = await page.goto(path, { waitUntil: "load" });
    loadAt = Date.now();
    await page.waitForLoadState("networkidle");
    const idleMs = Date.now() - t0;

    expect(res?.status()).toBe(200);
    expect(
      rscAfterLoad,
      `shell RSC prefetch after load held idle: ${rscAfterLoad.join(", ")}`,
    ).toEqual([]);
    expect(idleMs).toBeLessThanOrEqual(MAX_MS);
    await context.close();
  });

  test("20 cold loads × drills @ 320/768/1280: p95 < 1.2s, max < 1.5s", async ({
    browser,
  }) => {
    test.setTimeout(10 * 60_000);
    const summary: Record<
      string,
      { p95: number; max: number; samples: number[] }
    > = {};

    for (const width of WIDTHS) {
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

      for (const path of DRILLS) {
        const samples: number[] = [];
        for (let i = 0; i < SAMPLES; i++) {
          // Fresh document each sample (cold-ish). No retries on over-budget.
          const { status, idleMs } = await measureIdle(page, path);
          expect(status).toBe(200);
          samples.push(idleMs);
        }
        const sorted = [...samples].sort((a, b) => a - b);
        const p95 = Math.round(percentile(sorted, 95));
        const max = Math.round(Math.max(...samples));
        const key = `w${width} ${path}`;
        summary[key] = { p95, max, samples: samples.map((ms) => Math.round(ms)) };
        expect(p95, `${key} p95 ${p95}`).toBeLessThan(P95_MS);
        expect(max, `${key} max ${max}`).toBeLessThan(MAX_MS);
      }
      await context.close();
    }

    console.log("cost-item-idle acceptance", JSON.stringify(summary, null, 2));
  });
});
