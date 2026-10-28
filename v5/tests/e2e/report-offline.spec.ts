import { expect, test, type Page } from "@playwright/test";

const REPORT_ROW = /Reported Culvert Crew A's work on I-5 Culverts for /;

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByTestId("role-foreman").click();
  await expect(page).toHaveURL(/\/app$/);
}

function reportRows(page: Page) {
  return page.getByTestId("job-changes-full").locator("li").filter({
    hasText: REPORT_ROW,
  });
}

test.describe("offline report queue", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("queued report survives reload and Retry posts once", async ({
    page,
    context,
  }) => {
    await signIn(page);
    await page.goto("/app/jobs/24-077/changes");
    const rowsBefore = await reportRows(page).count();

    await page.goto("/app/jobs/24-077");
    const issued = page
      .locator('[data-testid="plan-card"][data-status="issued"]')
      .filter({ has: page.getByTestId("report-mh-03-210") });
    const planId = await issued.getAttribute("data-plan-id");
    expect(planId).toBeTruthy();
    const card = () =>
      page.locator(`[data-testid="plan-card"][data-plan-id="${planId}"]`);

    await card().getByTestId("report-qty-03-210").fill("12");
    await card().getByTestId("report-mh-03-210").fill("22");

    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && req.headers()["next-action"]) {
        posts.push(req.url());
      }
    });

    await context.setOffline(true);
    const offlineMark = posts.length;
    await card().getByTestId("report-work").click();
    const unsent = card().getByTestId("report-unsent");
    await expect(unsent).toBeVisible();
    await expect(unsent.getByTestId("report-retry")).toHaveText("Retry");
    await page.waitForTimeout(500);
    expect(posts.length).toBe(offlineMark);
    await expect(card()).toHaveAttribute("data-status", "issued");

    await context.setOffline(false);
    await page.reload();
    await expect(card().getByTestId("report-unsent")).toBeVisible();
    await expect(card().getByTestId("report-retry")).toHaveText("Retry");
    await expect(card()).toHaveAttribute("data-status", "issued");

    const retryMark = posts.length;
    await card().getByTestId("report-retry").dblclick();
    await expect(card()).toHaveAttribute("data-status", "reported", {
      timeout: 20_000,
    });
    await expect(card().getByTestId("report-unsent")).toHaveCount(0);
    await page.waitForTimeout(1000);
    expect(posts.length - retryMark).toBe(1);

    await page.goto("/app/jobs/24-077/changes");
    // The seeded report for this day is replaced, so the list stays at one row.
    expect(rowsBefore).toBeGreaterThan(0);
    await expect(reportRows(page)).toHaveCount(1);
  });
});
