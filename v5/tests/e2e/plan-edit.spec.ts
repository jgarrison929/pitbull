import { expect, test, type Page } from "@playwright/test";

/** Seeded typed-action history: foreman plan note; PM CO creates/prices/void + lock × 3. */
const SEED_FOREMAN_RUNS = 1;
const SEED_PM_RUNS = 14;

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

const pourLine = (page: Page) =>
  page.locator('[data-testid="plan-line"][data-code="04-210"]');

async function ask(page: Page, prompt: string) {
  const rail = page.getByTestId("assistant-rail");
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  const before = await rail.getByTestId("action-run").count();
  await rail.getByTestId("assistant-input").fill(prompt);
  await rail.getByRole("button", { name: "Send" }).click();
  await expect(rail.getByTestId("action-run")).toHaveCount(before + 1);
  return rail.getByTestId("action-run").last();
}

test("Joshua's steps on screen: foreman changes the pour from 60 to 80 man-hours and it persists", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
  await pourLine(page).getByTestId("edit-line").click();
  const form = pourLine(page).getByTestId("line-form");
  await form.getByLabel("Man-hours").fill("80");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("80");
  await expect(pourLine(page)).toContainText("8 workers × 10 h");
  await page.reload();
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("80");
  const run = page
    .getByTestId("assistant-rail")
    .getByTestId("action-run")
    .last();
  await expect(run).toHaveAttribute("data-action", "dailyPlan.updateLine");
  await expect(run.getByTestId("action-summary")).toContainText(
    "man-hours 60 → 80",
  );
});

test("Joshua's steps via the assistant: 'change the pour to 80 man-hours' persists", async ({
  page,
}) => {
  await signIn(page, "foreman");
  const run = await ask(page, "Change the pour to 80 man-hours");
  await expect(run).toHaveAttribute("data-action", "dailyPlan.updateLine");
  await expect(run.getByTestId("action-summary")).toContainText(
    "Changed 04-210",
  );
  await expect(run.getByTestId("action-summary")).toContainText(
    "man-hours 60 → 80",
  );
  await page.goto("/app/jobs/25-031");
  await page.reload();
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("80");
});

test("the cost code field lists this job's real codes and the server rejects any other", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");
  await pourLine(page).getByTestId("edit-line").click();
  const form = pourLine(page).getByTestId("line-form");
  const code = form.getByTestId("async-cost-search");
  // Selected label comes from the line itself — never blank when outside first-40.
  await expect(code).toHaveValue(/04-210 Pier column concrete/);
  // Wait for the settled open-search response — buggy code searches the full
  // selected label and lands on "No matches" after the 150ms debounce.
  const openSearch = page.waitForResponse(
    (r) =>
      r.url().includes("/cost-items/search") &&
      r.ok() &&
      new URL(r.url()).searchParams.get("q") === "",
  );
  await code.click();
  const openBody = await openSearch.then((r) => r.json());
  expect(openBody.items?.length).toBeGreaterThanOrEqual(12);
  const options = form.getByRole("option");
  await expect(options).toHaveCount(12, { timeout: 10_000 });
  await expect(form.getByText("No matches")).toHaveCount(0);
  await expect(
    options.filter({ hasText: "04-210 Pier column concrete" }),
  ).toHaveCount(1);
  // Quantity unit comes from the line / picked option, not only the first-40 slice.
  await expect(form.getByText(/Quantity \(CY\)/)).toBeVisible();
  // Prefix-first: "04-2" should keep 04-210 near the top, not drown in mid-code hits.
  const prefixSearch = page.waitForResponse(
    (r) =>
      r.url().includes("/cost-items/search") &&
      r.ok() &&
      (new URL(r.url()).searchParams.get("q") ?? "") === "04-2",
  );
  await code.fill("04-2");
  const prefixBody = await prefixSearch.then((r) => r.json());
  expect(
    (prefixBody.items as { label: string }[]).some((i) =>
      i.label.startsWith("04-2"),
    ),
  ).toBe(true);
  const filterSearch = page.waitForResponse(
    (r) =>
      r.url().includes("/cost-items/search") &&
      r.ok() &&
      (new URL(r.url()).searchParams.get("q") ?? "")
        .toLowerCase()
        .includes("cofferdam"),
  );
  await code.fill("cofferdam");
  await filterSearch;
  await expect(options).toHaveCount(1, { timeout: 10_000 });
  await code.press("Escape");

  // Forge a value that isn't one of the listed codes; only the server can catch this.
  await form
    .locator('input[type="hidden"][name="costItemId"]')
    .evaluate(
      (el) =>
        ((el as HTMLInputElement).value =
          "00000000-0000-0000-0000-000000000000"),
    );
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByTestId("error-costItemId")).toHaveText(
    "Pick a cost code from this job's list.",
  );
  await page.reload();
  await expect(pourLine(page)).toContainText("04-210");
});

test("bad numbers show inline errors from the server and change nothing", async ({
  page,
}) => {
  await signIn(page, "superintendent");
  await page.goto("/app/jobs/25-031");
  await pourLine(page).getByTestId("edit-line").click();
  const form = pourLine(page).getByTestId("line-form");
  // Skip the browser's own min/max check so the server's validation is what answers.
  await form.evaluate((f) => f.setAttribute("novalidate", ""));
  await form.getByLabel("Workers").fill("2.5");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form.getByTestId("error-workers")).toContainText("whole number");
  await form.getByRole("button", { name: "Cancel" }).click();
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
});

test("an ambiguous line makes the assistant ask instead of guessing", async ({
  page,
}) => {
  await signIn(page, "foreman");
  const run = await ask(page, "Change the column to 5 workers");
  await expect(run.getByTestId("action-summary")).toContainText(
    "Which line do you mean?",
  );
  await expect(run.getByTestId("action-summary")).toContainText("04-210");
  await expect(run.getByTestId("action-summary")).toContainText("04-310");
});

test("roles without edit rights see no Edit button and the action refuses them", async ({
  page,
}) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("edit-line")).toHaveCount(0);
  const run = await ask(page, "Change the pour to 80 man-hours");
  await expect(run.getByTestId("action-summary")).toContainText(
    "needs a foreman or a superintendent",
  );
  await page.goto("/app/jobs/25-031");
  await expect(pourLine(page).getByTestId("line-mh")).toHaveText("60");
});

test("a foreman's line edit is in the job's changes for the PM, not in the PM's chat", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await ask(page, "Change the pour to 80 man-hours");
  await signIn(page, "pm");
  const rail = page.getByTestId("assistant-rail");
  await expect(rail.getByTestId("assistant-input")).toBeVisible();
  // PM chat has the seeded locks and CO-001, never the foreman's pour edit.
  await expect(rail.getByTestId("action-run")).toHaveCount(SEED_PM_RUNS);
  await expect(
    rail
      .getByTestId("action-run")
      .filter({ hasText: "Change the pour to 80 man-hours" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(rail.getByTestId("action-run")).toHaveCount(SEED_PM_RUNS);
  await expect(
    rail
      .getByTestId("action-run")
      .filter({ hasText: "Change the pour to 80 man-hours" }),
  ).toHaveCount(0);
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("job-changes")).toContainText("Luis Ortega");
  await expect(page.getByTestId("job-changes")).toContainText(
    "man-hours 60 → 80",
  );

  await signIn(page, "foreman");
  await expect(rail.getByTestId("action-run")).toHaveCount(
    SEED_FOREMAN_RUNS + 1,
  );
  await expect(
    rail
      .getByTestId("action-run")
      .filter({ hasText: "Change the pour to 80 man-hours" }),
  ).toHaveCount(1);
});
