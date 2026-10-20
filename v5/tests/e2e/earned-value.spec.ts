import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
}

const pourLine = (page: Page) =>
  page.locator('[data-testid="plan-line"][data-code="04-210"]');

test("foreman reports quantity; after PM locks claim, job earned and CPI move", async ({
  page,
}) => {
  await signIn(page, "foreman");
  await page.goto("/app/jobs/25-031");

  const earnedBefore = (await page.getByTestId("job-earned").textContent())!;
  const cpiBefore = (await page.getByTestId("job-cpi").textContent())!;

  // Boost the pour quantity on tomorrow's draft plan.
  await pourLine(page).getByTestId("edit-line").click();
  const form = pourLine(page).getByTestId("line-form");
  await form.getByLabel(/Quantity/).fill("120");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(form).toBeHidden();

  await page.getByTestId("submit-plan").click();
  await expect(page.getByTestId("submit-plan")).toHaveCount(0);

  // Switch to PM and lock the open period claim so installed qty drives EV.
  await page.goto("/login");
  await page.getByTestId("role-pm").click();
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/jobs/25-031");
  await expect(page.getByTestId("lock-claim")).toBeVisible();
  await page.getByTestId("lock-claim").click();
  await expect(page.getByTestId("lock-claim")).toHaveCount(0);

  // Derivation is visible per line.
  await expect(page.getByTestId("earn-derivation").first()).toBeVisible();
  await expect(page.getByTestId("earn-derivation").first()).not.toHaveText("");

  // Earned and CPI reflect the locked claim (qty bump on 04-210 raises earn).
  const earnedAfter = (await page.getByTestId("job-earned").textContent())!;
  const cpiAfter = (await page.getByTestId("job-cpi").textContent())!;
  expect(earnedAfter).not.toBe(earnedBefore);
  expect(cpiAfter).not.toBe(cpiBefore);
  await expect(page.getByTestId("job-cpi")).toContainText(/\d\.\d{2}/);
});
