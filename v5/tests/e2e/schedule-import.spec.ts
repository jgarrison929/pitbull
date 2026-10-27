import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { MAX_SCHEDULE_IMPORT_BYTES } from "@/lib/schedule-import/types";

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

const SCHEDULE = "/app/jobs/25-031/schedule";
const HARBOR_SCHEDULE = "/app/jobs/26-010/schedule";

test("PM sees import; other roles are read-only on Schedule", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto(SCHEDULE);
  await expect(page.getByTestId("schedule-page")).toBeVisible();
  await expect(page.getByTestId("import-schedule-form")).toBeVisible();
  await expect(page.getByTestId("schedule-activity-list")).toBeVisible();
  await expect(
    page.locator('[data-testid="schedule-activity-row"][data-code="A"]'),
  ).toBeVisible();

  await signIn(page, "superintendent");
  await page.goto(SCHEDULE);
  await expect(page.getByTestId("import-schedule-form")).toHaveCount(0);
  await expect(page.getByTestId("schedule-readonly-note")).toBeVisible();
  await expect(page.getByTestId("schedule-activity-list")).toBeVisible();
});

test("Harbor draft has no Schedule page", async ({ page }) => {
  await signIn(page, "pm");
  const res = await page.goto(HARBOR_SCHEDULE);
  expect(res?.status()).toBe(404);
});

test("superintendent assistant import is refused on the rail", async ({
  page,
}) => {
  await signIn(page, "superintendent");
  await page.goto(SCHEDULE);
  const run = await ask(
    page.getByTestId("assistant-rail"),
    "Import the XER schedule for 25-031",
  );
  await expect(run).toHaveAttribute("data-action", "schedule.importXer");
  await expect(run.getByTestId("action-summary")).toContainText(
    /needs a project manager/i,
  );
  await expect(run.getByTestId("action-name")).toHaveText(
    "Couldn't import schedule on 25-031",
  );
});

test("oversize file is refused before parse on the Schedule page", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto(SCHEDULE);
  const big = Buffer.alloc(MAX_SCHEDULE_IMPORT_BYTES + 1, 0x41);
  await page.getByTestId("import-schedule-file").setInputFiles({
    name: "huge.xer",
    mimeType: "application/octet-stream",
    buffer: big,
  });
  await expect(page.getByTestId("import-schedule-summary")).toContainText(
    /10 MB/,
  );
  await expect(page.getByTestId("import-schedule-submit")).toBeDisabled();
});

test("invalid XER surfaces a clear read error and keeps seed activities", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto(SCHEDULE);
  const before = await page
    .locator('[data-testid="schedule-activity-row"]')
    .count();
  expect(before).toBeGreaterThanOrEqual(5);

  const file = path.join(__dirname, "../fixtures/schedule-soft.xer");
  await page.getByTestId("import-schedule-file").setInputFiles(file);
  await expect(page.getByTestId("import-schedule-filename")).toHaveText(
    "schedule-soft.xer",
  );
  await page.getByTestId("import-schedule-submit").click();
  await expect(page.getByTestId("import-schedule-summary")).toContainText(
    /XER file has no tables/i,
  );
  await expect(
    page.locator('[data-testid="schedule-activity-row"]'),
  ).toHaveCount(before);
});

test("cedar-ok.xer imports and lists skipped constructs", async ({ page }) => {
  await signIn(page, "pm");
  await page.goto(SCHEDULE);
  // Fixture from 5.1.3-a
  const xer = path.join(__dirname, "../../fixtures/schedule/cedar-ok.xer");
  await page.getByTestId("import-schedule-file").setInputFiles(xer);
  await expect(page.getByTestId("import-schedule-filename")).toHaveText(
    "cedar-ok.xer",
  );
  await page.getByTestId("import-schedule-submit").click();
  await expect(page.getByTestId("import-schedule-summary")).toContainText(
    /Imported schedule/i,
  );
  await expect(page.getByTestId("import-schedule-skipped")).toBeVisible();
  await expect(
    page.locator(
      '[data-testid="import-schedule-skipped-row"][data-kind="constraint"]',
    ),
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="schedule-activity-row"][data-code="A"]'),
  ).toBeVisible();
});
