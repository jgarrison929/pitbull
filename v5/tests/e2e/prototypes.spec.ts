import { expect, test } from "@playwright/test";

test("switcher moves between the three shells, each labeled demo data", async ({
  page,
}) => {
  await page.goto("/prototypes/screen");
  // Next keeps the previous route mounted but hidden after client navigation, so match visible elements only.
  const switcher = page.getByTestId("shell-switcher").filter({ visible: true });
  const demoLabel = page.getByTestId("demo-label").filter({ visible: true });
  await expect(switcher.locator('a[aria-current="page"]')).toContainText("A");
  await expect(demoLabel).toContainText("Demo data");
  await expect(
    page.getByText("Cedar Creek Bridge Replacement").first(),
  ).toBeVisible();

  for (const [letter, slug, marker] of [
    ["B", "agent", "How are my jobs doing?"],
    ["C", "hybrid", "Daily plan draft"],
    ["A", "screen", "Save snapshot"],
  ] as const) {
    await switcher
      .getByRole("link", { name: new RegExp(`^${letter}`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`/prototypes/${slug}$`));
    await expect(switcher.locator('a[aria-current="page"]')).toContainText(
      letter,
    );
    await expect(demoLabel).toBeVisible();
    await expect(
      page.getByText(marker).filter({ visible: true }).first(),
    ).toBeVisible();
  }
});

test("prototype buttons respond and the plan submit is local only", async ({
  page,
}) => {
  await page.goto("/prototypes/agent");
  await page.getByRole("button", { name: "Submit plan" }).click();
  await expect(page.getByText("Submitted to Marcus Lee (demo)")).toBeVisible();
});

test("prototypes stay off the app's navigation and out of search", async ({
  page,
}) => {
  await page.goto("/status");
  await expect(page.locator('a[href^="/prototypes"]')).toHaveCount(0);
  await page.goto("/prototypes/screen");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});
