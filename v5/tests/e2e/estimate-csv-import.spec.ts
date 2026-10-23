import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function ask(scope: ReturnType<Page["getByTestId"]>, prompt: string) {
  await expect(scope.getByTestId("assistant-input")).toBeVisible();
  const before = await scope.getByTestId("action-run").count();
  await scope.getByTestId("assistant-input").fill(prompt);
  await scope.getByRole("button", { name: "Send" }).click();
  await expect(scope.getByTestId("action-run")).toHaveCount(before + 1);
  return scope.getByTestId("action-run").last();
}

const DRAFT_JOB = "26-010";
/** Hand-computed SHB fixture total. $86,750.00. */
const FIXTURE_CENTS = 8_675_000;
/**
 * Excavation qty 1000 instead of 1200.
 * 200 CY times $4.50 labor plus $6.25 equipment is $2,150.00, so 215000¢ under the fixture.
 */
const MUTATED_CENTS = 8_460_000;

function moneyLabel(cents: number) {
  const a = Math.abs(cents);
  const dollars = Math.trunc(a / 100).toLocaleString("en-US");
  const s = `$${dollars}.${String(a % 100).padStart(2, "0")}`;
  return cents < 0 ? `−${s}` : s;
}

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
  await expect(summary).toContainText(moneyLabel(cents));
  await expect(summary).not.toContainText("¢");
  await expect(summary).toContainText(/[1-9]\d* updated/);
  await expect(page.getByTestId("import-estimate-filename")).toHaveCount(0);
  await expect(money(page.getByTestId("job-estimate"))).toHaveAttribute(
    "data-cents",
    String(cents),
  );
}

test("executive cannot import; PM can", async ({ page }) => {
  await signIn(page, "executive");
  await page.goto(`/app/jobs/${DRAFT_JOB}`);
  await expect(page.getByTestId("import-estimate-form")).toHaveCount(0);

  const run = await ask(
    page.getByTestId("assistant-rail"),
    "Import the estimate CSV for Harbor Abutment",
  );
  await expect(run).toHaveAttribute("data-action", "estimate.importCsv");
  await expect(run.getByTestId("action-summary")).toContainText(
    /needs a project manager/i,
  );
  await expect(run.getByTestId("action-summary")).toContainText(
    /signed in as an executive/i,
  );

  await signIn(page, "pm");
  await page.goto(`/app/jobs/${DRAFT_JOB}`);
  await expect(page.getByTestId("import-estimate-form")).toBeVisible();
});

test("bad CSV lists one error per line and writes nothing", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto(`/app/jobs/${DRAFT_JOB}`);
  await expect(money(page.getByTestId("job-estimate"))).toHaveAttribute(
    "data-cents",
    String(FIXTURE_CENTS),
  );

  const file = path.join(__dirname, "../fixtures", "shb-bad.csv");
  const picker = page.getByTestId("import-estimate-file");
  // Sticky chrome can cover the picker; scroll + visible before setInputFiles
  // so onChange runs. Then wait for file.text() (filename) before submit.
  await picker.scrollIntoViewIfNeeded();
  await expect(picker).toBeVisible();
  await picker.setInputFiles(file);
  await expect(page.getByTestId("import-estimate-filename")).toHaveText(
    "shb-bad.csv",
  );
  await page.getByTestId("import-estimate-submit").click();

  await expect(page.getByTestId("import-estimate-summary")).toContainText(
    /Imported nothing/,
  );
  const errors = page.getByTestId("import-estimate-errors").locator("li");
  await expect(errors).not.toHaveCount(0);
  expect(await errors.count()).toBeGreaterThan(1);
  await expect(errors.first()).toContainText(/Line \d+/);
  await expect(money(page.getByTestId("job-estimate"))).toHaveAttribute(
    "data-cents",
    String(FIXTURE_CENTS),
  );
  await expect(page.getByTestId("import-estimate-filename")).toHaveText(
    "shb-bad.csv",
  );
});

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
  // Leaf shows exact dollars; parent roll-up may stay compact ($K).
  await expect(visibleRow(page, "02-100").locator("[data-cents]").first()).toHaveText(
    "$10,750.00",
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
