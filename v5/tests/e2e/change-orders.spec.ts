import { expect, test, type Page } from "@playwright/test";

const DELTA = 6_000_000;

/** Must match SEED_JOB_NUMBERS in src/seed/history.ts (server-only — do not import). */
const SEED_JOB_NUMBERS = ["24-118", "25-031", "24-077"] as const;

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

/**
 * Stacked L/M/E/S rows must keep a gap between a value and the next label.
 * Catches 2-col squeeze at ~320px where "$8,000.00" runs into "Material".
 */
async function assertCoStackCategorySpacing(page: Page) {
  const stacks = page.getByTestId("co-lines-stack");
  const count = await stacks.count();
  if (count === 0) return;

  for (let s = 0; s < count; s++) {
    const bad = await stacks.nth(s).evaluate((stack) => {
      const rows = [...stack.querySelectorAll("dl > div")];
      for (let i = 0; i < rows.length - 1; i++) {
        const dd = rows[i]?.querySelector("dd");
        const nextDt = rows[i + 1]?.querySelector("dt");
        if (!dd || !nextDt) continue;
        const a = dd.getBoundingClientRect();
        const b = nextDt.getBoundingClientRect();
        const gapX = b.left - a.right;
        const gapY = b.top - a.bottom;
        // Same row (side-by-side): require horizontal gap.
        if (Math.abs(a.top - b.top) < 2) {
          if (gapX < 4) {
            return `${dd.textContent}${nextDt.textContent} (gapX=${gapX})`;
          }
          continue;
        }
        // Stacked: require vertical gap (or clear horizontal separation).
        if (gapY < 2 && gapX < 4) {
          return `${dd.textContent}${nextDt.textContent} (gapY=${gapY})`;
        }
      }
      return null;
    });
    expect(bad, `co-lines-stack[${s}] value ran into next label`).toBeNull();
  }
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

const PHONE_ROLES = [
  "pm",
  "foreman",
  "executive",
  "superintendent",
] as const;

/** Widths already used for phone CO layout, plus 320 where category squeeze showed. */
const PHONE_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 320, height: 568 },
] as const;

for (const viewport of PHONE_VIEWPORTS) {
  test.describe(`phone job page ${viewport.width}px — overflow and CO stack`, () => {
    test.use({
      viewport: { ...viewport },
      isMobile: true,
      hasTouch: true,
    });

    for (const role of PHONE_ROLES) {
      for (const job of SEED_JOB_NUMBERS) {
        test(`${job} as ${role}`, async ({ page }) => {
          await signIn(page, role);
          await page.goto(`/app/jobs/${job}`);
          await expect(page.getByTestId("co-ledger")).toBeVisible();
          // Every seeded job has at least one lined CO → phone stack.
          await expect(page.getByTestId("co-lines-stack").first()).toBeVisible();
          await assertNoPageOverflow(page);
          await assertCoStackCategorySpacing(page);
        });
      }
    }
  });
}
