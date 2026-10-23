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

/** Layout viewport must stay at the phone width (no sideways page scroll). */
async function assertNoPageOverflow(page: Page) {
  const { scrollWidth, viewportWidth } = await page.evaluate(() => {
    const vv = window.visualViewport;
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: vv?.width ?? window.innerWidth,
    };
  });
  expect(scrollWidth).toBeLessThanOrEqual(Math.ceil(viewportWidth));
}

test("PM approves priced CO-001; budget and EAC rise once", async ({
  page,
}) => {
  await signIn(page, "pm");
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
  await expect(page.getByTestId("job-changes")).toContainText("Marcus Lee");

  const again = await ask(page, "Approve change order CO-001 on 25-031");
  await expect(again).toHaveAttribute("data-action", "changeOrder.approve");
  await expect(again.getByTestId("action-summary")).toContainText(/already approved/i);
  expect(await cents(page, "job-budget")).toBe(cb0 + DELTA);
  expect(await cents(page, "job-eac")).toBe(eac0 + DELTA);
  expect(await attr(page, "co-ledger", "data-original-cents")).toBe(ob0);
});

test("foreman cannot approve; reject or void moves nothing", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await expect(card(page, 1)).toHaveAttribute("data-status", "priced");
  await expect(page.getByTestId("co-approve")).toHaveCount(0);
  const refused = await ask(page, "Approve change order CO-001 on 25-031");
  await expect(refused).toHaveAttribute("data-action", "changeOrder.approve");
  await expect(refused.getByTestId("action-summary")).toContainText(
    /project manager|executive|Switch role/i,
  );
  await expect(refused.getByTestId("action-name")).toHaveText(
    "Couldn't approve change order on 25-031",
  );
  await expect(card(page, 1)).toHaveAttribute("data-status", "priced");

  await signIn(page, "executive");
  await page.goto("/app/jobs/24-118");
  const cb0 = await cents(page, "job-budget");
  const eac0 = await cents(page, "job-eac");
  const ob0 = await attr(page, "co-ledger", "data-original-cents");

  // Seeded CO-001 is draft — void it; money must not move.
  await expect(card(page, 1)).toHaveAttribute("data-status", "draft");
  await card(page, 1).getByTestId("co-void-reason").fill("Opened by mistake");
  await card(page, 1).getByTestId("co-void").click();
  await expect(card(page, 1)).toHaveAttribute("data-status", "voided");
  expect(await cents(page, "job-budget")).toBe(cb0);
  expect(await cents(page, "job-eac")).toBe(eac0);
  expect(await attr(page, "co-ledger", "data-original-cents")).toBe(ob0);
  await expect(page.getByTestId("job-changes")).toContainText("Nothing moved");

  await page.goto("/app/jobs/24-077");
  const cb1 = await cents(page, "job-budget");
  const eac1 = await cents(page, "job-eac");
  // Seeded CO-002 is priced — reject it.
  await expect(card(page, 2)).toHaveAttribute("data-status", "priced");
  await card(page, 2).getByTestId("co-reject-reason").fill("Owner declined");
  await card(page, 2).getByTestId("co-reject").click();
  await expect(card(page, 2)).toHaveAttribute("data-status", "rejected");
  expect(await cents(page, "job-budget")).toBe(cb1);
  expect(await cents(page, "job-eac")).toBe(eac1);
  await expect(page.getByTestId("job-changes")).toContainText("Nothing moved");
});

test.describe("phone job page does not scroll sideways", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  for (const role of ["pm", "foreman", "executive"] as const) {
    test(`25-031 as ${role}`, async ({ page }) => {
      await signIn(page, role);
      await page.goto("/app/jobs/25-031");
      await expect(page.getByTestId("co-ledger")).toBeVisible();
      await expect(page.getByTestId("co-lines-stack")).toBeVisible();
      await assertNoPageOverflow(page);
    });
  }
});
