import { expect, test, type Page } from "@playwright/test";
import { mh } from "@/lib/ev";

/**
 * Spec #80 hooks. Markup only:
 * - job-name on the portfolio phone card (not job-link)
 * - crew-name on EntryDetail (crew text only)
 * - data-actual-mh-milli on each leaf cost-tree-row
 *
 * 07-300 is a cost code on job 24-077 (Catch basins & inlets), the item
 * spec #80 maps to cost-item-actual-mh.
 */

async function signIn(page: Page, role = "pm") {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("24-077 exposes job-name, crew-name, and leaf actual-MH hooks", async ({
  page,
}) => {
  await signIn(page);

  const card = page
    .getByTestId("portfolio-cards")
    .locator("[data-card]")
    .filter({ hasText: "24-077" });
  const name = card.getByTestId("job-name");
  await expect(name).toBeVisible();
  await expect(name).toHaveText("I-5 Culvert & Drainage Rehab");
  await expect(name).not.toContainText("24-077");
  const link = card.getByTestId("job-link");
  await expect(link).toContainText("24-077");
  await expect(link).toContainText("I-5 Culvert & Drainage Rehab");
  expect(
    await name.evaluate(
      (el) => el === el.closest("[data-testid='job-link']"),
    ),
  ).toBe(false);
  await expect(
    page.locator("[data-testid='job-link'][data-testid='job-name']"),
  ).toHaveCount(0);

  await page.goto("/app/jobs/24-077");
  await expect(page.getByTestId("cost-list")).toBeVisible();

  // Two leaves: read the row, open that cost item, compare locked MH.
  for (const code of ["07-300", "03-210"]) {
    await page.getByTestId("cost-tree-filter").fill(code);
    const row = page
      .locator(`[data-testid="cost-tree-row"][data-code="${code}"]`)
      .locator("visible=true");
    await expect(row).toBeVisible();
    const milli = await row.getAttribute("data-actual-mh-milli");
    expect(milli, code).toMatch(/^\d+$/);
    await row.getByTestId(`cost-code-link-${code}`).click();
    await expect(page).toHaveURL(
      new RegExp(`/app/jobs/24-077/cost-items/${code}$`),
    );
    await expect(page.getByTestId("cost-item-actual-mh")).toHaveText(
      mh(Number(milli)),
    );
    if (code === "07-300") {
      const crews = page.getByTestId("crew-name");
      await expect(crews.first()).toBeAttached();
      const n = await crews.count();
      expect(n).toBeGreaterThan(0);
      for (let i = 0; i < n; i++) {
        await expect(crews.nth(i)).toHaveText("Culvert Crew A");
      }
      // The plan link can fall back to "Daily report"; the name hook must not.
      const links = page.getByTestId("cost-entry-plan-link");
      const linkCount = await links.count();
      for (let i = 0; i < linkCount; i++) {
        expect(
          await links.nth(i).evaluate((el) => el.getAttribute("data-testid")),
        ).toBe("cost-entry-plan-link");
      }
    }
    await page.goto("/app/jobs/24-077");
  }
});
