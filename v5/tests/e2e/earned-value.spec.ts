import { expect, test, type Page } from "@playwright/test";
import { CREW_LABOR_RATE_CENTS } from "@/lib/crew-rates";

/** Seeded Cedar working plan (tomorrow under V5_SEED_NOW=2026-10-20). */
const CEDAR_WORKING_DATE = "2026-10-21";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

function workingPlan(page: Page) {
  return page.locator(
    `[data-testid="plan-card"][data-plan-date="${CEDAR_WORKING_DATE}"]`,
  );
}

const pourLine = (page: Page) =>
  page.locator('[data-testid="plan-line"][data-code="04-210"]');

async function actualCents(page: Page) {
  // Cutoff AC (last lock). Exact cents from Money's data-cents.
  return Number(
    await page.getByTestId("job-actual").locator("[data-cents]").getAttribute(
      "data-cents",
    ),
  );
}

async function sinceLockActualCents(page: Page) {
  const el = page.getByTestId("job-actual-since-lock").locator("[data-cents]");
  if ((await el.count()) === 0) return 0;
  return Number(await el.getAttribute("data-cents"));
}

/** Issue plan, report pour actuals, leave status reported (no cost post yet). */
async function issueAndReportPour(
  page: Page,
  mh: string,
  qty: string,
) {
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute("data-status", "issued");
  await page.getByTestId("report-mh-04-210").fill(mh);
  await page.getByTestId("report-qty-04-210").fill(qty);
  await page.getByTestId("report-work").click();
  await expect(workingPlan(page)).toHaveAttribute("data-status", "reported");
}

async function approveAsSuperintendent(page: Page) {
  await signIn(page, "superintendent");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("approve-report").click();
  await expect(workingPlan(page)).toHaveAttribute("data-status", "approved");
}

test("foreman reports quantity; after super approve + PM locks claim, job earned and CPI move", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");

  // Foreman job page hides CPI (5.0.4-b); EV tile stays for the earned check.
  const earnedBefore = (await page.getByTestId("job-earned").textContent())!;
  await expect(page.getByTestId("job-cpi")).toHaveCount(0);
  const actualBefore = await actualCents(page);

  await expect(page.getByTestId("report-work")).toHaveCount(0);
  await issueAndReportPour(page, "72", "38");
  await expect(page.getByTestId("report-summary")).toContainText(/72/);
  await expect(page.getByTestId("report-summary")).toContainText(/38/);
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");

  // Pending approval — AC and installed unchanged.
  await expect(
    page.locator('[data-testid="approval-pending-04-210"]:visible'),
  ).toContainText("38");
  expect(await actualCents(page)).toBe(actualBefore);
  await expect(page.getByTestId("job-earned")).toHaveText(earnedBefore);

  // Amend while reported (still no cost post).
  await page.getByTestId("report-mh-04-210").fill("80");
  await page.getByTestId("report-qty-04-210").fill("40");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toContainText(/80/);
  await expect(
    page.locator('[data-testid="approval-pending-04-210"]:visible'),
  ).toContainText("40");
  expect(await actualCents(page)).toBe(actualBefore);

  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("80");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("40");

  await approveAsSuperintendent(page);
  // Superintendent keeps CPI on the job page — baseline before PM lock.
  const cpiBefore = (await page.getByTestId("job-cpi").textContent())!;
  // One cutoff: tile AC stays at last lock; approved cost shows as since-lock.
  expect(await actualCents(page)).toBe(actualBefore);
  const sinceAfterApprove = await sinceLockActualCents(page);
  expect(sinceAfterApprove).toBeGreaterThan(0);
  // 80 MH on the pour × Bridge Crew 2 seeded rate (other lines may also post).
  expect(sinceAfterApprove).toBeGreaterThanOrEqual(
    80 * CREW_LABOR_RATE_CENTS["Bridge Crew 2"],
  );
  await expect(page.locator('[data-testid="pending-04-210"]:visible')).toContainText("40");

  // Switch to PM and lock so claimed installed moves and EV/AC update at the new cutoff.
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("lock-claim")).toBeVisible();
  await expect(page.getByTestId("lock-claim")).toContainText("Period 2");
  await page.getByTestId("lock-claim").click();
  await expect(page.getByTestId("lock-claim")).toContainText("Period 3");

  await expect(page.getByTestId("earn-derivation").first()).toBeVisible();
  const earnedAfter = (await page.getByTestId("job-earned").textContent())!;
  const cpiAfter = (await page.getByTestId("job-cpi").textContent())!;
  expect(earnedAfter).not.toBe(earnedBefore);
  expect(cpiAfter).not.toBe(cpiBefore);
  await expect(page.getByTestId("job-cpi")).toContainText(/\d\.\d{2}/);
  // After lock, cutoff AC absorbs the approved cost; since-lock clears.
  expect(await actualCents(page)).toBe(actualBefore + sinceAfterApprove);
  expect(await sinceLockActualCents(page)).toBe(0);
});

test("assistant reports actuals that differ from the plan (pending until approve)", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute(
    "data-status",
    "issued",
  );
  const actualBefore = await actualCents(page);

  const rail = page.getByTestId("assistant-rail");
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  const before = await rail.getByTestId("action-run").count();
  await rail
    .getByTestId("assistant-input")
    .fill("we poured 38 CY with 72 hours on 04-210 for Cedar Creek");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 1);
  const run = rail.getByTestId("action-run").last();
  await expect(run).toHaveAttribute("data-action", "dailyReport.post");
  await expect(run.getByTestId("action-summary")).toContainText(/72/);
  await expect(run.getByTestId("action-summary")).toContainText(/38/);
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
  await expect(
    page.locator('[data-testid="approval-pending-04-210"]:visible'),
  ).toContainText("38");
  expect(await actualCents(page)).toBe(actualBefore);

  await rail
    .getByTestId("assistant-input")
    .fill("we poured 40 CY with 80 hours on the pour for Cedar Creek");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 2);
  const run2 = rail.getByTestId("action-run").last();
  await expect(run2).toHaveAttribute("data-action", "dailyReport.post");
  await expect(run2.getByTestId("action-summary")).toContainText(/80/);
  await expect(
    page.locator('[data-testid="approval-pending-04-210"]:visible'),
  ).toContainText("40");
  expect(await actualCents(page)).toBe(actualBefore);
});

test("report rejects negative man-hours", async ({ page }) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute(
    "data-status",
    "issued",
  );
  const actualBefore = await page.getByTestId("job-actual").textContent();
  await page.getByTestId("report-work-form").evaluate((f) =>
    f.setAttribute("novalidate", ""),
  );
  await page.getByTestId("report-mh-04-210").fill("-50");
  await page.getByTestId("report-qty-04-210").fill("38");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toContainText(/Man-hours/i);
  await expect(page.getByTestId("job-actual")).toHaveText(actualBefore!);
});

test("a 0 MH / 0 qty report persists and does not revert to the plan", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute(
    "data-status",
    "issued",
  );
  await page.getByTestId("report-mh-04-210").fill("0");
  await page.getByTestId("report-qty-04-210").fill("0");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toBeVisible();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-last-04-210")).toContainText(/0/);

  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-last-04-210")).toContainText(/0/);

  const actualAfterZero = await actualCents(page);
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-summary")).toBeVisible();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("0");
  expect(await actualCents(page)).toBe(actualAfterZero);
});

test("blank or non-finite report fields are rejected, not replaced by the plan", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute(
    "data-status",
    "issued",
  );

  const actualBefore80 = await actualCents(page);
  await page.getByTestId("report-mh-04-210").fill("80");
  await page.getByTestId("report-qty-04-210").fill("38");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("80");
  await expect(page.getByTestId("report-summary")).toContainText(/80/);
  // AC must not move until approve.
  expect(await actualCents(page)).toBe(actualBefore80);
  await expect(
    page.locator('[data-testid="approval-pending-04-210"]:visible'),
  ).toContainText("38");

  await page.getByTestId("report-work-form").evaluate((form) => {
    const f = form as HTMLFormElement;
    f.setAttribute("novalidate", "");
    const mh = f.querySelector(
      '[data-testid="report-mh-04-210"]',
    ) as HTMLInputElement;
    const qty = f.querySelector(
      '[data-testid="report-qty-04-210"]',
    ) as HTMLInputElement;
    mh.type = "text";
    mh.value = "";
    mh.removeAttribute("required");
    qty.value = "38";
    (
      f.querySelector('[data-testid="report-work"]') as HTMLButtonElement
    ).click();
  });
  await expect(page.getByTestId("report-summary")).toContainText(
    /Man-hours must be from/i,
  );
  expect(await actualCents(page)).toBe(actualBefore80);

  await page.getByTestId("report-work-form").evaluate((form) => {
    const f = form as HTMLFormElement;
    f.setAttribute("novalidate", "");
    const mh = f.querySelector(
      '[data-testid="report-mh-04-210"]',
    ) as HTMLInputElement;
    const qty = f.querySelector(
      '[data-testid="report-qty-04-210"]',
    ) as HTMLInputElement;
    mh.type = "text";
    mh.value = "1e309";
    mh.removeAttribute("required");
    qty.value = "38";
    (
      f.querySelector('[data-testid="report-work"]') as HTMLButtonElement
    ).click();
  });
  await expect(page.getByTestId("report-summary")).toContainText(
    /Man-hours must be from/i,
  );
  expect(await actualCents(page)).toBe(actualBefore80);
  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("80");
  expect(await actualCents(page)).toBe(actualBefore80);
});

test("assistant updates one line without wiping other lines' last reports", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute(
    "data-status",
    "issued",
  );

  await page.getByTestId("report-mh-04-210").fill("0");
  await page.getByTestId("report-qty-04-210").fill("0");
  await page.getByTestId("report-mh-04-310").fill("50");
  await page.getByTestId("report-qty-04-310").fill("9000");
  await page.getByTestId("report-mh-07-410").fill("12");
  await page.getByTestId("report-qty-07-410").fill("1");
  await page.getByTestId("report-work").click();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-mh-04-310")).toHaveValue("50");
  await expect(page.getByTestId("report-mh-07-410")).toHaveValue("12");
  await expect(page.getByTestId("report-summary")).toBeVisible();

  const rail = page.getByTestId("assistant-rail");
  // Seed already logged one dailyReport.post (I-5); wait for this Cedar report.
  await expect(
    rail
      .locator('[data-testid="action-run"][data-action="dailyReport.post"]')
      .filter({ hasText: /Cedar Creek Bridge/ }),
  ).toHaveCount(1, { timeout: 15_000 });
  const before = await rail.getByTestId("action-run").count();

  await rail
    .getByTestId("assistant-input")
    .fill("we worked 70 hours on the pour for Cedar Creek");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 1);
  const pourRun = rail.getByTestId("action-run").nth(before);
  await expect(pourRun).toHaveAttribute("data-action", "dailyReport.post");
  await expect(pourRun.getByTestId("action-summary")).toContainText(/70/);

  await rail
    .getByTestId("assistant-input")
    .fill("we tied 9000 LB with 45 hours on the cage for Cedar Creek");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 2);
  const cageRun = rail.getByTestId("action-run").nth(before + 1);
  await expect(cageRun).toHaveAttribute("data-action", "dailyReport.post");
  await expect(cageRun.getByTestId("action-summary")).toContainText(/45/);

  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("70");
  await expect(page.getByTestId("report-qty-04-210")).toHaveValue("0");
  await expect(page.getByTestId("report-mh-04-310")).toHaveValue("45");
  await expect(page.getByTestId("report-qty-04-310")).toHaveValue("9000");
  await expect(page.getByTestId("report-mh-07-410")).toHaveValue("12");
  await expect(page.getByTestId("report-qty-07-410")).toHaveValue("1");
});

test("assistant rejects negative man-hours", async ({ page }) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute(
    "data-status",
    "issued",
  );
  const actualBefore = await actualCents(page);
  const rail = page.getByTestId("assistant-rail");
  const before = await rail.getByTestId("action-run").count();
  await rail
    .getByTestId("assistant-input")
    .fill("we worked -5 hours on the pour for Cedar Creek");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 1);
  const run = rail.getByTestId("action-run").last();
  await expect(run).toHaveAttribute("data-action", "dailyReport.post");
  await expect(run.getByTestId("action-summary")).toContainText(
    /Man-hours must be from/i,
  );
  expect(await actualCents(page)).toBe(actualBefore);
  await page.reload();
  await expect(page.getByTestId("report-mh-04-210")).toHaveValue("60");
});
