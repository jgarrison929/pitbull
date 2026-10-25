import { expect, test, type Page } from "@playwright/test";

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
/** Hand-computed SHB fixture total: $86,750.00 */
const OB_CENTS = 8_675_000;

test("PM approves draft estimate; budget matches fixture; second approve refused", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto(`/app/jobs/${DRAFT_JOB}`);

  await expect(page.getByTestId("estimate-status")).toHaveAttribute(
    "data-status",
    "draft",
  );
  // Draft: Current Budget is zero until Approve.
  await expect(
    page.getByTestId("job-budget").locator("[data-cents]"),
  ).toHaveAttribute("data-cents", "0");

  await page.getByTestId("approve-estimate").click();

  await expect(page.getByTestId("estimate-status")).toHaveAttribute(
    "data-status",
    "approved",
  );
  await expect(
    page.getByTestId("job-budget").locator("[data-cents]"),
  ).toHaveAttribute("data-cents", String(OB_CENTS));

  // Second approve is refused (button gone; assistant also refuses).
  await expect(page.getByTestId("approve-estimate")).toHaveCount(0);

  const run = await ask(
    page.getByTestId("assistant-rail"),
    `Approve the estimate on ${DRAFT_JOB}`,
  );
  await expect(run).toHaveAttribute("data-action", "estimate.approve");
  await expect(run.getByTestId("action-summary")).toContainText(
    /already approved|frozen/i,
  );
});

test("assistant can approve the Harbor draft estimate", async ({ page }) => {
  await signIn(page, "pm");
  const rail = page.getByTestId("assistant-rail");
  const run = await ask(rail, "Approve the estimate on Harbor Abutment");
  await expect(run).toHaveAttribute("data-action", "estimate.approve");
  await expect(run.getByTestId("action-summary")).toContainText(
    /Approved the estimate/,
  );
  await expect(run.getByTestId("action-summary")).toContainText(/\$87K/);

  await page.goto(`/app/jobs/${DRAFT_JOB}`);
  await expect(page.getByTestId("estimate-status")).toHaveAttribute(
    "data-status",
    "approved",
  );
  await expect(
    page.getByTestId("job-budget").locator("[data-cents]"),
  ).toHaveAttribute("data-cents", String(OB_CENTS));
});
