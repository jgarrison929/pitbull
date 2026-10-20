import { expect, test, type Page } from "@playwright/test";
import {
  STRESS_JOB_NUMBER,
  STRESS_OUTSIDE_SLICE_CODE,
} from "@/seed/stress";

/**
 * Seeds the 10k stress job into the current sandbox via ensure-stress
 * (not V5_SEED_STRESS on the shared webServer — that slows every Reset demo).
 */
async function signInWithStress(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app$/);
  const res = await page.request.post("/api/demo/ensure-stress");
  expect(res.ok()).toBeTruthy();
}

const outsideLine = (page: Page) =>
  page.locator(
    `[data-testid="plan-line"][data-code="${STRESS_OUTSIDE_SLICE_CODE}"]`,
  );

test("99-010: cost code label is present for a line outside the first-40 slice", async ({
  page,
}) => {
  await signInWithStress(page, "foreman");
  await page.goto(`/app/jobs/${STRESS_JOB_NUMBER}`);
  await expect(page.getByTestId("cost-tree-row").first()).toBeVisible({
    timeout: 30_000,
  });
  const line = outsideLine(page);
  await expect(line).toBeVisible();
  await line.getByTestId("edit-line").click();
  const form = line.getByTestId("line-form");
  const code = form.getByTestId("async-cost-search");
  // Must show the line's own code+description — not blank from slice(0,40).
  await expect(code).toHaveValue(
    new RegExp(`${STRESS_OUTSIDE_SLICE_CODE} Leaf ${STRESS_OUTSIDE_SLICE_CODE}`),
  );
  await expect(form.getByText(/Quantity \(CY\)/)).toBeVisible();
});

test("99-010: typing a code prefix ranks that branch first", async ({
  page,
}) => {
  await signInWithStress(page, "foreman");
  await page.goto(`/app/jobs/${STRESS_JOB_NUMBER}`);
  const line = outsideLine(page);
  await line.getByTestId("edit-line").click();
  const form = line.getByTestId("line-form");
  const code = form.getByTestId("async-cost-search");

  const prefixSearch = page.waitForResponse(
    (r) =>
      r.url().includes("/cost-items/search") &&
      r.ok() &&
      (new URL(r.url()).searchParams.get("q") ?? "") === "07-03",
  );
  await code.fill("07-03");
  const body = await prefixSearch.then((r) => r.json());
  const items = body.items as { label: string }[];
  expect(items.length).toBeGreaterThan(0);
  expect(items.every((i) => i.label.startsWith("07-03"))).toBe(true);
  const options = form.getByRole("option");
  await expect(options.first()).toContainText(/^07-03/);
});
