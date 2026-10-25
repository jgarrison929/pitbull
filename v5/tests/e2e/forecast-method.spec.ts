import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
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

test.describe("5.0.3 Part B — Average Performance forecast", () => {
  test("check 7: PM switches 04-210; item EAC = AC÷%; job EAC moves by delta; Marcus in changes", async ({
    page,
  }) => {
    await signIn(page, "pm");

    await page.goto("/app/jobs/25-031");
    const jobEacBefore = Number(
      await page.getByTestId("job-eac").getAttribute("data-cents"),
    );

    await page.goto("/app/jobs/25-031/cost-items/04-210");
    const panel = page.getByTestId("cost-item-forecast");
    await expect(panel).toHaveAttribute("data-method", "current_budget");
    const eacBefore = Number(await panel.getAttribute("data-eac-cents"));
    const ac = Number(await panel.getAttribute("data-locked-ac-cents"));
    const pct = Number(await panel.getAttribute("data-locked-percent"));
    expect(ac).toBeGreaterThan(0);
    expect(pct).toBeGreaterThan(0);

    await page
      .getByTestId("forecast-method-select")
      .selectOption("average_performance");
    await page.getByTestId("forecast-method-save").click();
    await expect(page.getByTestId("cost-item-forecast")).toHaveAttribute(
      "data-method",
      "average_performance",
    );

    const eacAfter = Number(
      await page
        .getByTestId("cost-item-forecast")
        .getAttribute("data-eac-cents"),
    );
    const expected = Math.round(ac / pct);
    expect(eacAfter).toBe(expected);

    await page.goto("/app/jobs/25-031");
    const jobEacAfter = Number(
      await page.getByTestId("job-eac").getAttribute("data-cents"),
    );
    expect(jobEacAfter - jobEacBefore).toBe(eacAfter - eacBefore);

    const changes = page.getByTestId("job-changes");
    await expect(changes).toContainText("Marcus Lee");
    await expect(changes).toContainText(/Average Performance/i);
  });

  test("check 8: 05-120 at 0% claimed keeps EAC and shows fallback", async ({
    page,
  }) => {
    await signIn(page, "pm");
    await page.goto("/app/jobs/25-031/cost-items/05-120");
    const panel = page.getByTestId("cost-item-forecast");
    const eacBefore = Number(await panel.getAttribute("data-eac-cents"));
    expect(Number(await panel.getAttribute("data-locked-percent"))).toBe(0);

    await page
      .getByTestId("forecast-method-select")
      .selectOption("average_performance");
    await page.getByTestId("forecast-method-save").click();

    const after = page.getByTestId("cost-item-forecast");
    await expect(after).toHaveAttribute("data-method", "average_performance");
    await expect(after).toHaveAttribute("data-fallback", "1");
    expect(Number(await after.getAttribute("data-eac-cents"))).toBe(eacBefore);
    await expect(page.getByTestId("forecast-derivation")).toContainText(
      /fell back|fallback/i,
    );
  });

  test("check 9: executive rail refusal chip", async ({ page }) => {
    await signIn(page, "executive");
    const run = await ask(
      page,
      "Set 04-210 on 25-031 to average performance",
    );
    await expect(run).toHaveAttribute(
      "data-action",
      "costItem.setForecastMethod",
    );
    await expect(run.getByTestId("action-name")).toHaveText(
      "Couldn't set forecast method on 25-031",
    );
  });
});
