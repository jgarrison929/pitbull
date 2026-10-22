import { expect, test, type Page } from "@playwright/test";

const DELTA = 6_000_000;

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

async function ask(page: Page, prompt: string) {
  const rail = page.getByTestId("assistant-rail");
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  const before = await rail.getByTestId("action-run").count();
  await rail.getByTestId("assistant-input").fill(prompt);
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 1);
  return rail.getByTestId("action-run").last();
}

async function cents(page: Page, testId: string) {
  const el = page.getByTestId(testId);
  const own = await el.getAttribute("data-cents");
  if (own !== null) return Number(own);
  const child = await el.locator("[data-cents]").first().getAttribute("data-cents");
  if (child === null) throw new Error(`${testId} has no data-cents`);
  return Number(child);
}

async function attr(page: Page, testId: string, name: string) {
  const value = await page.getByTestId(testId).getAttribute(name);
  if (value === null) throw new Error(`${testId} has no ${name}`);
  return value;
}

function card(page: Page, number: number) {
  return page.locator(`[data-testid="co-card"][data-co-number="${number}"]`);
}

test("executive approves priced CO-001; budget and EAC rise once", async ({
  page,
}) => {
  await signIn(page, "executive");
  await page.goto("/app/jobs/25-031");
  const co = card(page, 1);
  await expect(co).toHaveAttribute("data-status", "priced");
  await expect(co).toHaveAttribute("data-total-cents", String(DELTA));
  await expect(page.getByTestId("co-ledger")).toHaveAttribute(
    "data-pending-cents",
    String(DELTA),
  );
  expect(await attr(page, "co-ledger", "data-original-cents")).toBe(
    await attr(page, "co-ledger", "data-current-cents"),
  );

  const cb0 = await cents(page, "job-budget");
  const eac0 = await cents(page, "job-eac");
  const ob0 = await attr(page, "co-ledger", "data-original-cents");

  await co.getByTestId("co-approve").click();
  await expect(co).toHaveAttribute("data-status", "approved");
  expect(await cents(page, "job-budget")).toBe(cb0 + DELTA);
  expect(await cents(page, "job-eac")).toBe(eac0 + DELTA);
  expect(await attr(page, "co-ledger", "data-original-cents")).toBe(ob0);
  await expect(page.getByTestId("co-ledger")).toHaveAttribute(
    "data-approved-cents",
    String(DELTA),
  );
  await expect(page.getByTestId("co-ledger")).toHaveAttribute(
    "data-pending-cents",
    "0",
  );
  await expect(page.getByTestId("co-approve")).toHaveCount(0);

  const screenRun = page.getByTestId("assistant-rail").getByTestId("action-run").last();
  await expect(screenRun).toHaveAttribute("data-action", "changeOrder.approve");
  await expect(page.getByTestId("job-changes").locator("li").first()).toContainText(
    /Approved CO-001/,
  );
  await expect(page.getByTestId("job-changes")).toContainText("Elena Brooks");

  const again = await ask(page, "Approve change order CO-001 on 25-031");
  await expect(again).toHaveAttribute("data-action", "changeOrder.approve");
  await expect(again.getByTestId("action-summary")).toContainText(/already approved/i);
  expect(await cents(page, "job-budget")).toBe(cb0 + DELTA);
  expect(await cents(page, "job-eac")).toBe(eac0 + DELTA);
  expect(await attr(page, "co-ledger", "data-original-cents")).toBe(ob0);
});

test("a project manager cannot approve, and reject or void moves nothing", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await expect(card(page, 1)).toHaveAttribute("data-status", "priced");
  await expect(page.getByTestId("co-approve")).toHaveCount(0);
  await expect(card(page, 1).getByTestId("co-price")).toBeVisible();

  await signIn(page, "executive");
  await page.goto("/app/jobs/24-118");
  const cb0 = await cents(page, "job-budget");
  const eac0 = await cents(page, "job-eac");
  const ob0 = await attr(page, "co-ledger", "data-original-cents");

  const raised = await ask(
    page,
    "Raise a change order on 24-118: Temporary sheet pile because the county moved the abutment",
  );
  await expect(raised).toHaveAttribute("data-action", "changeOrder.create");
  await expect(card(page, 1)).toHaveAttribute("data-status", "draft");
  await card(page, 1).getByTestId("co-void-reason").fill("Duplicate of the field note");
  await card(page, 1).getByTestId("co-void").click();
  await expect(card(page, 1)).toHaveAttribute("data-status", "voided");
  expect(await cents(page, "job-budget")).toBe(cb0);
  expect(await cents(page, "job-eac")).toBe(eac0);
  expect(await attr(page, "co-ledger", "data-original-cents")).toBe(ob0);
  await expect(page.getByTestId("job-changes")).toContainText("Nothing moved");

  await page.goto("/app/jobs/24-077");
  const cb1 = await cents(page, "job-budget");
  const eac1 = await cents(page, "job-eac");
  await ask(
    page,
    "Raise a change order on 24-077: Extra railing",
  );
  const priced = await ask(
    page,
    "Price CO-001 on 24-077: new 91-200 Extra railing LS labor 1,000",
  );
  await expect(priced).toHaveAttribute("data-action", "changeOrder.price");
  await expect(card(page, 1)).toHaveAttribute("data-status", "priced");
  await card(page, 1).getByTestId("co-reject-reason").fill("Owner declined");
  await card(page, 1).getByTestId("co-reject").click();
  await expect(card(page, 1)).toHaveAttribute("data-status", "rejected");
  expect(await cents(page, "job-budget")).toBe(cb1);
  expect(await cents(page, "job-eac")).toBe(eac1);
  await expect(page.getByTestId("job-changes")).toContainText("Nothing moved");
});
