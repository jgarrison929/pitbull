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
      // Who: seeded people who ran typed actions (foreman plan edit / PM lock).
      await expect(first).toContainText(/Marcus Lee|Luis Ortega/);
      // What: lock summary or plan-line note edit (Harbor is note-only; others lock).
      await expect(first).toContainText(/Locked Period|Changed 0[24]-\d{3}|note/);
      // When: LocalTime renders a <time datetime>.
      await expect(first.locator("time[datetime]")).toBeVisible();
      const iso = await first.locator("time[datetime]").getAttribute("datetime");
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });
}
