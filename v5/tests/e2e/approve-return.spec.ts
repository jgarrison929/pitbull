import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function actualCents(page: Page) {
  return Number(
    await page
      .getByTestId("job-actual")
      .locator("[data-cents]")
      .getAttribute("data-cents"),
  );
}

/** On a phone the rail is hidden — use the assistant page. */
async function askOnPhone(page: Page, prompt: string) {
  await page.goto("/app/assistant");
  const pane = page.getByTestId("assistant-page");
  await expect(pane.getByTestId("assistant-input")).toBeVisible();
  const before = await pane.getByTestId("action-run").count();
  await pane.getByTestId("assistant-input").fill(prompt);
  await pane.getByRole("button", { name: "Send" }).click();
  await expect(pane.getByTestId("action-run")).toHaveCount(before + 1);
  return pane.getByTestId("action-run").last();
}

test.describe("superintendent approve / return", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("foreman report → super return → re-report → approve posts once; second approve does not double-post", async ({
    page,
  }) => {
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");

    const actualBefore = await actualCents(page);

    await page.getByTestId("submit-plan").click();
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "issued",
    );

    await page.getByTestId("report-mh-04-210").fill("22");
    await page.getByTestId("report-qty-04-210").fill("12");
    await page.getByTestId("report-work").click();
    await expect(page.getByTestId("report-summary")).toContainText(/pending/i);
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "reported",
    );

    // Check 4: nothing posted before approval; pending on the job page.
    expect(await actualCents(page)).toBe(actualBefore);
    const pending = page.getByTestId("approval-pending-04-210").first();
    await expect(pending).toBeVisible();
    await expect(pending).toContainText("12");
    await expect(pending).toHaveAttribute("data-cents", String(22 * 8500));
    await expect(pending).toContainText("$1,870.00");

    // Superintendent returns with a reason (form unmounts on success — assert banner).
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "reported",
    );
    await page.getByTestId("return-reason").fill("Recount pour 3");
    await page.getByTestId("return-report").click();
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "issued",
    );
    await expect(page.getByTestId("return-reason-banner")).toContainText(
      "Recount pour 3",
    );
    expect(await actualCents(page)).toBe(actualBefore);
    await expect(page.getByTestId("job-changes")).toContainText(
      /Recount pour 3/,
    );

    // Foreman sees the reason and kept values, then re-reports.
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");
    await expect(page.getByTestId("return-reason-banner")).toContainText(
      "Recount pour 3",
    );
    await expect(page.getByTestId("report-mh-04-210")).toHaveValue("22");
    await expect(page.getByTestId("report-qty-04-210")).toHaveValue("12");
    await page.getByTestId("report-work").click();
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "reported",
    );
    expect(await actualCents(page)).toBe(actualBefore);

    // Approve on screen — cost posts once.
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await page.getByTestId("approve-report").click();
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "approved",
    );

    const afterFirst = await actualCents(page);
    expect(afterFirst).toBeGreaterThanOrEqual(actualBefore + 22 * 8500);

    await expect(page.getByTestId("approval-pending-04-210")).toHaveCount(0);
    await expect(page.getByTestId("pending-04-210").first()).toContainText(
      "12",
    );
    await expect(page.getByTestId("job-changes")).toContainText(/Approved/i);

    // Second approve via assistant must not double-post.
    const run2 = await askOnPhone(
      page,
      "Approve the daily report for Cedar Creek",
    );
    await expect(run2).toHaveAttribute("data-action", "dailyPlan.approve");
    await expect(run2.getByTestId("action-summary")).toContainText(
      /already approved/i,
    );
    await page.goto("/app/jobs/25-031");
    expect(await actualCents(page)).toBe(afterFirst);
  });

  test("assistant return refuses an empty reason", async ({ page }) => {
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");
    await page.getByTestId("submit-plan").click();
    await page.getByTestId("report-mh-04-210").fill("22");
    await page.getByTestId("report-qty-04-210").fill("12");
    await page.getByTestId("report-work").click();
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "reported",
    );

    await signIn(page, "superintendent");
    const run = await askOnPhone(page, "Return the report for Cedar Creek");
    await expect(run).toHaveAttribute("data-action", "dailyPlan.return");
    await expect(run.getByTestId("action-summary")).toContainText(/reason/i);
    await page.goto("/app/jobs/25-031");
    await expect(page.getByTestId("plan-card")).toHaveAttribute(
      "data-status",
      "reported",
    );
  });
});
