import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

async function ask(scope: ReturnType<Page["getByTestId"]>, prompt: string) {
  // The transcript streams in after navigation; count runs only once the composer has rendered.
  await expect(scope.getByTestId("assistant-input")).toBeVisible();
  const before = await scope.getByTestId("action-run").count();
  await scope.getByTestId("assistant-input").fill(prompt);
  await scope.getByRole("button", { name: "Send" }).click();
  await expect(scope.getByTestId("action-run")).toHaveCount(before + 1);
  return scope.getByTestId("action-run").last();
}

test("the rail answers by running a typed action and shows which one", async ({
  page,
}) => {
  await signIn(page, "pm");
  const rail = page.getByTestId("assistant-rail");
  const run = await ask(rail, "Why is Cedar Creek over budget?");
  await expect(run).toHaveAttribute("data-action", "job.costVariance");
  await expect(run.getByTestId("action-name")).toHaveText(
    "job.costVariance(25-031)",
  );
  await expect(run.getByTestId("action-summary")).toContainText(
    "Cedar Creek Bridge is $644K over",
  );
});

test("a foreman submits tomorrow's plan from the rail, the screen agrees, reset undoes it", async ({
  page,
}) => {
  await signIn(page, "foreman");
  const rail = page.getByTestId("assistant-rail");
  const run = await ask(rail, "Submit tomorrow's plan");
  await expect(run).toHaveAttribute("data-action", "dailyPlan.submit");
  await expect(run.getByTestId("action-summary")).toContainText(
    "Submitted Bridge Crew 2's plan",
  );
  // The request named no job, so the history records the one the action picked.
  await expect(run.getByTestId("action-name")).toHaveText(
    "dailyPlan.submit(25-031)",
  );
  await expect(run.getByTestId("job-picked")).toBeVisible();
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );

  await page.getByTestId("user-menu").click();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page).toHaveURL(/reset=1/);
  await expect(
    page.getByTestId("assistant-rail").getByTestId("action-run"),
  ).toHaveCount(0);
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "draft",
  );
});

test("roles are enforced inside the action, and the refusal is logged", async ({
  page,
}) => {
  await signIn(page, "executive");
  const run = await ask(
    page.getByTestId("assistant-rail"),
    "Submit the plan for Cedar Creek",
  );
  await expect(run.getByTestId("action-summary")).toContainText(
    "needs a foreman or a superintendent",
  );
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "draft",
  );
  await expect(page.getByTestId("submit-plan")).toHaveCount(0);
});

test("the on-screen Submit button runs the same action and lands in the transcript", async ({
  page,
}) => {
  await signIn(page, "superintendent");
  await page.goto("/app/jobs/25-031");
  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "submitted",
  );
  const run = page
    .getByTestId("assistant-rail")
    .getByTestId("action-run")
    .last();
  await expect(run).toHaveAttribute("data-action", "dailyPlan.submit");
  await expect(run).toContainText("Submit plan (button)");
});

test("requests it can't map get examples, not a guess", async ({ page }) => {
  await signIn(page, "pm");
  const rail = page.getByTestId("assistant-rail");
  await rail.getByTestId("assistant-input").fill("order pizza for lunch");
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("assistant-help")).toContainText("Try:");
  await expect(rail.getByTestId("action-run")).toHaveCount(0);
});

test("on a phone the foreman lands on the chat view", async ({ browser }) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await signIn(page, "foreman");
  await expect(page.getByTestId("foreman-phone")).toBeVisible();
  await expect(page.getByTestId("portfolio-table")).toBeHidden();
  const run = await ask(
    page.getByTestId("assistant-page"),
    "Show tomorrow's plan for Cedar Creek",
  );
  await expect(run).toHaveAttribute("data-action", "dailyPlan.show");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page.close();
});

test("other roles on a phone keep the portfolio and reach the assistant from the nav", async ({
  browser,
}) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await signIn(page, "pm");
  await expect(page.getByTestId("portfolio-table")).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Assistant" })
    .filter({ visible: true })
    .click();
  await expect(page.getByTestId("assistant-page")).toBeVisible();
  await page.close();
});

for (const role of ["executive", "pm", "superintendent", "foreman"]) {
  test(`nav crawl as ${role} is clean`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`pageerror ${e.message}`));
    page.on(
      "console",
      (m) => m.type() === "error" && errors.push(`console ${m.text()}`),
    );
    await signIn(page, role);
    for (const path of [
      "/app",
      "/app/assistant",
      "/app/jobs/24-118",
      "/app/jobs/25-031",
      "/app/jobs/24-077",
      "/status",
      "/changelog",
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
      await expect(page.locator("main, body").first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
}

test("a job number that isn't in the sandbox is refused, not swapped for another job", async ({
  page,
}) => {
  await signIn(page, "foreman");
  const run = await ask(
    page.getByTestId("assistant-rail"),
    "Submit the plan for 99-999",
  );
  await expect(run.getByTestId("action-summary")).toContainText(
    "There is no job 99-999 in this sandbox",
  );
  await expect(run.getByTestId("action-name")).toHaveText(
    "dailyPlan.submit(99-999)",
  );

  // The Submit button posts the job number; a forged one is refused the same way.
  await page.goto("/app/jobs/25-031");
  await page
    .getByTestId("plan-card")
    .locator('input[name="job"]')
    .evaluate((el) => ((el as HTMLInputElement).value = "99-999"));
  await page.getByTestId("submit-plan").click();
  await expect(
    page.getByTestId("assistant-rail").getByTestId("action-run").last(),
  ).toContainText("There is no job 99-999");
  await expect(page.getByTestId("plan-card")).toHaveAttribute(
    "data-status",
    "draft",
  );
});

test("each role has its own conversation; the job page keeps everyone's changes", async ({
  page,
}) => {
  await signIn(page, "foreman");
  const rail = page.getByTestId("assistant-rail");
  await ask(rail, "Submit tomorrow's plan");

  // A new role starts a fresh conversation, filtered on the server, so a reload shows nothing either.
  await signIn(page, "pm");
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  await expect(rail.getByTestId("action-run")).toHaveCount(0);
  await page.reload();
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  await expect(rail.getByTestId("action-run")).toHaveCount(0);

  // The audit trail on the screen still says who changed what.
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("job-changes")).toContainText("Luis Ortega");
  await expect(page.getByTestId("job-changes")).toContainText(
    "Submitted Bridge Crew 2's plan",
  );

  await signIn(page, "foreman");
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  await expect(rail.getByTestId("action-run")).toHaveCount(1);
  await expect(rail.getByTestId("action-run")).toContainText(
    "Submit tomorrow's plan",
  );
});
