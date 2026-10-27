import { expect, test, type Page } from "@playwright/test";

/**
 * PB-107 / staging UX: cost-entries must not hide MH / rate / $ in a sideways
 * scroll box on phones. Stacked cards show those figures; the wide table stays
 * md+ only (data-scroll-x).
 *
 * Must-fail: restore the main-era markup — a single
 *   <div className="overflow-x-auto" data-testid="cost-item-entries">
 *     <table className="w-full min-w-[40rem] …">
 * with no EntryCards / cost-item-entries-cards — then this file fails on
 * cards visibility, visible table, and/or entries-section overflow-x scroll.
 */

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
] as const;

async function signIn(page: Page, role = "pm") {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

async function assertNoEntriesSidewaysScroll(page: Page) {
  const result = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const pageScrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth ?? 0,
    );
    const section =
      document.querySelector('[data-testid="cost-item-entries-cards"]')
        ?.closest("section") ??
      document.querySelector('[data-testid="cost-item-entries"]')?.closest(
        "section",
      );
    const scrollerHits: string[] = [];
    const root = section ?? document.querySelector("main");
    if (root) {
      for (const el of root.querySelectorAll("*")) {
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const ox = style.overflowX;
        if (ox !== "auto" && ox !== "scroll") continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (el.scrollWidth > el.clientWidth + 1) {
          scrollerHits.push(
            `${el.getAttribute("data-testid") ?? el.tagName.toLowerCase()}:${el.scrollWidth}>${el.clientWidth}`,
          );
        }
      }
    }
    const visibleTables = [...document.querySelectorAll("main table")].filter(
      (t) => {
        const r = t.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(t).display !== "none";
      },
    ).length;
    return { clientWidth, pageScrollWidth, scrollerHits, visibleTables };
  });

  expect(
    result.pageScrollWidth,
    `page scrollWidth ${result.pageScrollWidth} > clientWidth ${result.clientWidth}`,
  ).toBeLessThanOrEqual(result.clientWidth);
  expect(
    result.scrollerHits,
    `cost-entries sideways scroller: ${result.scrollerHits.join("; ")}`,
  ).toEqual([]);
  expect(result.visibleTables, "no table on phone cost-item page").toBe(0);
}

for (const viewport of VIEWPORTS) {
  test.describe(`cost entries @ ${viewport.width}×${viewport.height}`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: true,
      hasTouch: true,
    });

    test("stacked cards show MH and $ without sideways scroll", async ({
      page,
    }) => {
      await signIn(page, "pm");
      await page.goto("/app/jobs/25-031/cost-items/04-210");
      await expect(page.getByTestId("cost-item-ac")).toBeVisible();

      const cards = page.getByTestId("cost-item-entries-cards");
      await expect(cards).toBeVisible();
      await expect(page.getByTestId("cost-item-entries")).toBeHidden();

      const laborCard = page
        .locator('[data-testid="cost-entry-card"][data-kind="labor"]')
        .first();
      await expect(laborCard).toBeVisible();
      await expect(laborCard.getByTestId("cost-entry-card-amount")).toBeVisible();
      await expect(laborCard.getByTestId("cost-entry-card-mh")).toBeVisible();
      await expect(laborCard.getByTestId("cost-entry-card-rate")).toBeVisible();

      // Amount / MH stay inside the viewport (not parked off to the right).
      const inView = await laborCard.evaluate((el) => {
        const vw = document.documentElement.clientWidth;
        const amount = el.querySelector('[data-testid="cost-entry-card-amount"]');
        const mh = el.querySelector('[data-testid="cost-entry-card-mh"]');
        if (!amount || !mh) return { ok: false, reason: "missing figures" };
        const ar = amount.getBoundingClientRect();
        const mr = mh.getBoundingClientRect();
        return {
          ok: ar.right <= vw + 0.5 && mr.right <= vw + 0.5 && ar.left >= -0.5,
          amountRight: ar.right,
          mhRight: mr.right,
          vw,
        };
      });
      expect(inView, JSON.stringify(inView)).toMatchObject({ ok: true });

      await assertNoEntriesSidewaysScroll(page);
    });
  });
}
