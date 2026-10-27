import { expect, test, type Page } from "@playwright/test";
import { confirmDialog } from "./confirm-dialog";
import { SEED_ACTIVE_JOB_COUNT } from "../../src/seed";

/** Seeded Cedar working plan (tomorrow under V5_SEED_NOW=2026-10-20). */
const CEDAR_WORKING_DATE = "2026-10-21";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

function workingPlan(page: Page) {
  return page.locator(
    `[data-testid="plan-card"][data-plan-date="${CEDAR_WORKING_DATE}"]`,
  );
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

test("login job count comes from seed data, not a hardcoded three", async ({
  page,
}) => {
  await page.goto("/login");
  const copy =
    SEED_ACTIVE_JOB_COUNT === 1
      ? "1 live job"
      : `${SEED_ACTIVE_JOB_COUNT} live jobs`;
  await expect(page.getByText(copy)).toBeVisible();
});

test("draft 26-010 job page: dashes in cost table, no Lock claim", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/26-010");
  await expect(page.getByTestId("draft-label")).toBeVisible();
  await expect(page.getByTestId("lock-claim")).toHaveCount(0);
  const total = page.getByTestId("cost-job-total");
  await expect(total).toBeVisible();
  // EV metrics and OB/CB are dashes; Current Estimate stays real.
  await expect(
    total.getByTestId("cost-total-ob").getByTestId("metric-dash"),
  ).toHaveText("—");
  await expect(total.getByTestId("metric-dash").first()).toHaveText("—");
  await expect(total).not.toContainText("EAC $0");
  await expect(total).not.toContainText("ETC $0");
  await expect(
    total.getByTestId("cost-total-ce").locator("[data-cents]"),
  ).not.toHaveAttribute("data-cents", "0");
});

test("job strip labels draft as Estimate draft", async ({ page }) => {
  await signIn(page, "pm");
  // strip-estimate-draft lives on job-strip (Harbor draft) — not the job-page
  // empty-EV section. Wait for the strip to settle; avoid scrollIntoViewIfNeeded
  // on a stale node while shell RSC remounts (detach flake).
  await expect(page.getByTestId("job-strip")).toBeVisible();
  const strip = page
    .getByTestId("strip-estimate-draft")
    .filter({ visible: true })
    .first();
  await expect(strip).toHaveText("Estimate draft");
});

test("portfolio.summary counts active jobs only (excludes drafts)", async ({
  page,
}) => {
  await signIn(page, "executive");
  const run = await ask(page, "Summarize the portfolio");
  await expect(run).toHaveAttribute("data-action", "portfolio.summary");
  await expect(run.getByTestId("action-summary")).toContainText(
    `${SEED_ACTIVE_JOB_COUNT} active jobs`,
  );
  await expect(run.getByTestId("action-summary")).not.toContainText(
    "4 active jobs",
  );
});

test("mixed-unit approve lists CY, DAY, and LB separately", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await workingPlan(page).getByTestId("submit-plan").click();
  await expect(workingPlan(page)).toHaveAttribute("data-status", "issued");
  await page.getByTestId("report-mh-04-210").fill("10");
  await page.getByTestId("report-qty-04-210").fill("12");
  await page.getByTestId("report-mh-04-310").fill("8");
  await page.getByTestId("report-qty-04-310").fill("500");
  await page.getByTestId("report-mh-07-410").fill("10");
  await page.getByTestId("report-qty-07-410").fill("1");
  await page.getByTestId("report-work").click();
  await expect(workingPlan(page)).toHaveAttribute("data-status", "reported");

  await signIn(page, "superintendent");
  await page.goto("/app/jobs/25-031");
  await confirmDialog(page, workingPlan(page).getByTestId("approve-report"));
  await expect(workingPlan(page)).toHaveAttribute("data-status", "approved");
  const run = page
    .getByTestId("assistant-rail")
    .getByTestId("action-run")
    .last();
  await expect(run).toHaveAttribute("data-action", "dailyPlan.approve");
  await expect(run.getByTestId("action-summary")).toContainText(
    "12 CY, 1 DAY, 500 LB installed",
  );
});

test("Submit plan sits in the plan header above KPIs", async ({ page }) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  const plan = workingPlan(page);
  const submit = plan.getByTestId("submit-plan");
  await expect(submit).toBeVisible();
  const order = await page.evaluate((date) => {
    const planEl = document.querySelector(
      `[data-testid="plan-card"][data-plan-date="${date}"]`,
    );
    const kpi = document.querySelector('[data-testid="job-budget"]');
    if (!planEl || !kpi) return null;
    const pos = planEl.compareDocumentPosition(kpi);
    return (pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 ? "plan-then-kpi" : "kpi-then-plan";
  }, CEDAR_WORKING_DATE);
  expect(order).toBe("plan-then-kpi");
  // Submit is in the header, not the footer.
  await expect(plan.locator("header").getByTestId("submit-plan")).toBeVisible();
  await expect(
    plan.getByTestId("plan-footer").getByTestId("submit-plan"),
  ).toHaveCount(0);
});

test("phone portfolio wraps long job names instead of truncating", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await signIn(page, "pm");
  const name = page
    .getByTestId("portfolio-table")
    .locator("ul [data-estimate=approved] .font-medium.whitespace-normal")
    .first();
  await expect(name).toBeVisible();
  const overflow = await name.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      truncate: style.textOverflow === "ellipsis" || el.className.includes("truncate"),
      wrap: style.whiteSpace === "normal" || el.className.includes("whitespace-normal"),
    };
  });
  expect(overflow.truncate).toBe(false);
  expect(overflow.wrap).toBe(true);
  await page.close();
});

test("phone tab bar does not cover Submit plan", async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  const submit = page.getByTestId("submit-plan");
  await expect(submit).toBeVisible();
  await submit.scrollIntoViewIfNeeded();
  const ok = await page.evaluate(() => {
    const btn = document.querySelector(
      '[data-testid="submit-plan"]',
    ) as HTMLElement | null;
    const tabs = document.querySelector(
      'nav[aria-label="Main"].fixed',
    ) as HTMLElement | null;
    if (!btn || !tabs) return false;
    const b = btn.getBoundingClientRect();
    const t = tabs.getBoundingClientRect();
    return b.bottom <= t.top + 1;
  });
  expect(ok).toBe(true);
  await page.close();
});
