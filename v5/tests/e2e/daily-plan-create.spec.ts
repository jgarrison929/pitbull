import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

async function ask(scope: ReturnType<Page["getByTestId"]>, prompt: string) {
  await expect(scope.getByTestId("assistant-input")).toBeVisible();
  const before = await scope.getByTestId("action-run").count();
  await scope.getByTestId("assistant-input").fill(prompt);
  await scope.getByRole("button", { name: "Send" }).click();
  await expect(scope.getByTestId("action-run")).toHaveCount(before + 1);
  return scope.getByTestId("action-run").last();
}

test.describe("superintendent creates a daily plan", () => {
  test("New plan on 25-031 for Bridge Crew 2 today", async ({ page }) => {
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await page.getByTestId("new-plan").click();
    const form = page.getByTestId("new-plan-form");
    await expect(form).toBeVisible();
    await form
      .getByTestId("new-plan-crew")
      .selectOption({ label: "Bridge Crew 2" });
    await form.getByTestId("new-plan-submit").click();

    const created = page
      .getByTestId("plan-card")
      .filter({ hasText: "Bridge Crew 2" })
      .filter({ has: page.getByTestId("plan-empty") });
    await expect(created.first()).toBeVisible({ timeout: 15_000 });
    await expect(created.first().getByTestId("plan-status")).toHaveText(
      "Draft",
    );
    await expect(created.first()).toContainText("Luis Ortega");
    await expect(created.first().getByTestId("plan-empty")).toHaveText(
      "Add a cost item to plan the day",
    );

    const changes = page.getByTestId("job-changes");
    await expect(changes).toContainText(/Created a draft plan/);
  });

  test("foreman cannot create a plan", async ({ page }) => {
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");
    await expect(page.getByTestId("new-plan")).toHaveCount(0);

    const rail = page.getByTestId("assistant-rail");
    const run = await ask(rail, "Plan today on 25-031 for Bridge Crew 2");
    await expect(run).toHaveAttribute("data-action", "dailyPlan.create");
    await expect(run.getByTestId("action-name")).toHaveText(
      "Couldn't create plan on 25-031",
    );
  });

  test("submit on empty Culvert card does not issue Bridge Crew seed draft", async ({
    page,
  }) => {
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    await page.getByTestId("new-plan").click();
    const form = page.getByTestId("new-plan-form");
    await form
      .getByTestId("new-plan-crew")
      .selectOption({ label: "Culvert Crew A" });
    // Far enough to avoid colliding with seeded Culvert plans; still in ±14 days.
    await form.getByTestId("new-plan-date").fill("2026-10-22");
    await form.getByTestId("new-plan-submit").click();

    const emptyCard = page
      .getByTestId("plan-card")
      .filter({ hasText: "Culvert Crew A" })
      .filter({ has: page.getByTestId("plan-empty") });
    await expect(emptyCard.first()).toBeVisible({ timeout: 15_000 });

    const submitForm = emptyCard
      .first()
      .locator("form")
      .filter({ has: page.getByTestId("submit-plan") });
    const planId = await submitForm.locator('input[name="planId"]').inputValue();
    expect(planId.length).toBeGreaterThan(10);

    const post = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        (req.postData()?.includes("dailyPlan.submit") ?? false),
    );
    await emptyCard.first().getByTestId("submit-plan").click();
    const req = await post;
    const body = req.postData() ?? "";
    expect(body).toContain("planId");
    expect(body).toContain(planId);

    // Wait for the round-trip — must-fail if planId is dropped (Bridge seed issues).
    await expect(emptyCard.first().getByTestId("plan-status")).toHaveText(
      "Draft",
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("job-changes")).toContainText(
      /Add a cost item before submitting/,
      { timeout: 15_000 },
    );
    const bridgeSeed = page
      .getByTestId("plan-card")
      .filter({ hasText: "Bridge Crew 2" })
      .filter({ hasNot: page.getByTestId("plan-empty") });
    await expect(bridgeSeed.first().getByTestId("plan-status")).toHaveText(
      "Draft",
    );
  });

  test("report form posts planId for this card only", async ({ page }) => {
    await signIn(page, "foreman");
    await page.goto("/app/jobs/25-031");

    const card = page.getByTestId("plan-card").first();
    await expect(card).toBeVisible();
    const submitForm = card
      .locator("form")
      .filter({ has: page.getByTestId("submit-plan") });
    const planId = await submitForm.locator('input[name="planId"]').inputValue();
    expect(planId.length).toBeGreaterThan(10);

    await card.getByTestId("submit-plan").click();
    await expect(card).toHaveAttribute("data-status", "issued", {
      timeout: 15_000,
    });

    const reportForm = card.getByTestId("report-work-form");
    await expect(reportForm).toBeVisible();
    expect(await reportForm.locator('input[name="planId"]').inputValue()).toBe(
      planId,
    );

    const post = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        (req.postData()?.includes("dailyReport.post") ?? false),
    );
    await reportForm.getByTestId("report-work").click();
    const req = await post;
    const body = req.postData() ?? "";
    expect(body).toContain("planId");
    expect(body).toContain(planId);

    await expect(card).toHaveAttribute("data-status", "reported", {
      timeout: 15_000,
    });
  });

  test("assistant creates today's plan then adds 04-210", async ({ page }) => {
    await signIn(page, "superintendent");
    await page.goto("/app/jobs/25-031");
    const rail = page.getByTestId("assistant-rail");

    const created = await ask(
      rail,
      "Plan today on 25-031 for Bridge Crew 2",
    );
    await expect(created).toHaveAttribute("data-action", "dailyPlan.create");
    await expect(created.getByTestId("action-name")).toHaveText(
      "Created plan on 25-031",
    );
    await expect(created.getByTestId("action-name")).not.toContainText(
      "dailyPlan.create",
    );
    // Wait for the job page to show the empty draft before the next ask.
    await expect(
      page
        .getByTestId("plan-card")
        .filter({ hasText: "Bridge Crew 2" })
        .getByTestId("plan-empty"),
    ).toBeVisible();
    await expect(rail.getByTestId("assistant-input")).toBeVisible();

    const added = await ask(
      rail,
      "Add 04-210 to today's plan on 25-031: 12 CY, 3 workers, 8 hours",
    );
    await expect(added).toHaveAttribute("data-action", "dailyPlan.addLine");
    await expect(added.getByTestId("action-name")).toHaveText(
      "Added plan line on 25-031",
    );

    // Today's new plan (not tomorrow's seeded Bridge Crew 2 draft).
    const pour = page
      .getByTestId("plan-card")
      .filter({ hasText: "Bridge Crew 2" })
      .filter({ has: page.getByTestId("line-mh").filter({ hasText: "24" }) })
      .locator('[data-testid="plan-line"][data-code="04-210"]');
    await expect(pour).toBeVisible();
    await expect(pour.getByTestId("line-mh")).toHaveText("24");
    await expect(pour).toContainText(/Over budget rate/);
  });
});
