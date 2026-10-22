import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

const DRAFT_JOB = "26-010";
/** Hand-computed SHB fixture total. $86,750.00. */
const FIXTURE_CENTS = 8_675_000;
/**
 * Excavation qty 1000 instead of 1200.
 * 200 CY times $4.50 labor plus $6.25 equipment is $2,150.00, so 215000¢ under the fixture.
 */
const MUTATED_CENTS = 8_460_000;

function money(root: Locator) {
  return root.locator("[data-cents]");
}

function visibleRow(page: Page, code: string) {
  return page
    .locator(`[data-testid="cost-tree-row"][data-code="${code}"]`)
    .filter({ visible: true });
}

async function importFile(page: Page, name: string, cents: number) {
  const file = path.join(__dirname, "../fixtures", name);
  await page.getByTestId("import-estimate-file").setInputFiles(file);
  await expect(page.getByTestId("import-estimate-filename")).toHaveText(name);
  await page.getByTestId("import-estimate-submit").click();
  const summary = page.getByTestId("import-estimate-summary");
  await expect(summary).toContainText(`${cents}¢`);
  await expect(summary).toContainText(/[1-9]\d* updated/);
  await expect(money(page.getByTestId("job-estimate"))).toHaveAttribute(
    "data-cents",
    String(cents),
  );
}

test("PM import rewrites Current Estimate, then Approve freezes Original and Current at the fixture", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto(`/app/jobs/${DRAFT_JOB}`);

  await expect(page.getByTestId("estimate-status")).toHaveAttribute(
    "data-status",
    "draft",
  );
  await expect(page.getByTestId("import-estimate-form")).toBeVisible();
  await expect(page.getByTestId("value-set")).toHaveAttribute("data-set", "ce");
  // Harbor already matches the fixture. An identical import would change nothing.
  await expect(money(page.getByTestId("job-estimate"))).toHaveAttribute(
    "data-cents",
    String(FIXTURE_CENTS),
  );
  await expect(money(page.getByTestId("job-budget"))).toHaveAttribute(
    "data-cents",
    "0",
  );
  await expect(money(page.getByTestId("job-original-budget"))).toHaveAttribute(
    "data-cents",
    "0",
  );

  await importFile(page, "shb-qty-1000.csv", MUTATED_CENTS);
  await expect(money(page.getByTestId("job-budget"))).toHaveAttribute(
    "data-cents",
    "0",
  );
  await expect(money(page.getByTestId("job-original-budget"))).toHaveAttribute(
    "data-cents",
    "0",
  );
  await expect(visibleRow(page, "02-100")).toHaveAttribute(
    "data-ce-cents",
    "1075000",
  );
  await expect(visibleRow(page, "02")).toHaveAttribute(
    "data-ce-cents",
    "3195000",
  );
  await expect(visibleRow(page, "02")).toHaveAttribute("data-mh-milli", "114000");
  await expect(money(page.getByTestId("estimate-labor"))).toHaveAttribute(
    "data-cents",
    "1930000",
  );

  await importFile(page, "shb-estimate.csv", FIXTURE_CENTS);
  await expect(money(page.getByTestId("job-budget"))).toHaveAttribute(
    "data-cents",
    "0",
  );
  await expect(money(page.getByTestId("cost-total-ce"))).toHaveAttribute(
    "data-cents",
    String(FIXTURE_CENTS),
  );
  await expect(money(page.getByTestId("cost-total-ob"))).toHaveAttribute(
    "data-cents",
    "0",
  );
  await expect(visibleRow(page, "02-100")).toHaveAttribute(
    "data-ce-cents",
    "1290000",
  );
  await expect(visibleRow(page, "02")).toHaveAttribute(
    "data-ce-cents",
    "3410000",
  );
  await expect(visibleRow(page, "02")).toHaveAttribute("data-mh-milli", "124000");
  await expect(money(page.getByTestId("estimate-labor"))).toHaveAttribute(
    "data-cents",
    "2020000",
  );

  await page.getByTestId("approve-estimate").click();

  await expect(page.getByTestId("estimate-status")).toHaveAttribute(
    "data-status",
    "approved",
  );
  await expect(page.getByTestId("import-estimate-form")).toHaveCount(0);
  await expect(page.getByTestId("approve-estimate")).toHaveCount(0);
  await expect(page.getByTestId("value-set")).toHaveAttribute("data-set", "cb");
  for (const id of ["job-original-budget", "job-budget", "cost-total-ob", "cost-total-cb"]) {
    await expect(money(page.getByTestId(id))).toHaveAttribute(
      "data-cents",
      String(FIXTURE_CENTS),
    );
  }
  await expect(visibleRow(page, "02")).toHaveAttribute("data-ob-cents", "3410000");
  await expect(visibleRow(page, "02")).toHaveAttribute("data-cb-cents", "3410000");
});
