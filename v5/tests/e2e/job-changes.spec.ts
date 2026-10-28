import { expect, test, type Page } from "@playwright/test";

const roles = [
  "executive",
  "pm",
  "superintendent",
  "foreman",
] as const;

/** Must match SEED_JOB_NUMBERS in src/seed/history.ts — including draft Harbor. */
const jobs = ["24-118", "25-031", "24-077", "26-010"] as const;

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

test("?page=99 clamps to the last page", async ({ page }) => {
  await signIn(page, "pm");
  await page.goto("/app/jobs/25-031/changes?page=99");
  const card = page.getByTestId("changes-count-card");
  await expect(card).toBeVisible();
  const cardText = await card.innerText();
  expect(cardText).not.toMatch(/Page 99/);
  const paged = cardText.match(/Page (\d+) of (\d+)/);
  const lastHref = paged
    ? `/app/jobs/25-031/changes?page=${paged[1]}`
    : "/app/jobs/25-031/changes";
  if (paged) expect(paged[1]).toBe(paged[2]);
  else expect(cardText).toContain("One page");
  await page.goto(lastHref);
  const last = await page.getByTestId("job-changes-full").innerText();
  await page.goto("/app/jobs/25-031/changes?page=99");
  await expect(page.getByTestId("job-changes-full")).toHaveText(last);
  await expect(card).toHaveText(cardText);
});

for (const role of roles) {
  test(`every seeded job shows real change history for ${role}`, async ({
    page,
  }) => {
    await signIn(page, role);
    for (const number of jobs) {
      await page.goto(`/app/jobs/${number}`);
      await expect(page.getByText("No changes yet.")).toHaveCount(0);
      const list = page.getByTestId("job-changes");
      await expect(list).toBeVisible();
      const first = list.locator("li").first();
      await expect(first).toBeVisible();
      // Who: seeded people who ran typed actions (foreman plan / PM lock or import).
      await expect(first).toContainText(/Marcus Lee|Luis Ortega/);
      // What: Period 1 lock on approved jobs; Harbor is estimate.importCsv.
      await expect(first).toContainText(
        /Locked Period|Changed 04-210|note|Imported the estimate/,
      );
      // When: LocalTime renders a <time datetime>.
      await expect(first.locator("time[datetime]")).toBeVisible();
      const iso = await first.locator("time[datetime]").getAttribute("datetime");
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
}
