import { expect, test } from "@playwright/test";

test("signed-out /roadmap lists shipped and Next in order", async ({ page }) => {
  const res = await page.goto("/roadmap");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Roadmap" })).toBeVisible();

  const shipped = page.locator("#roadmap-shipped").locator("..");
  await expect(shipped.getByRole("link", { name: "5.0.3" })).toBeVisible();
  await expect(shipped.getByRole("link", { name: "5.0.2" })).toBeVisible();
  await expect(shipped.getByRole("link", { name: "5.0.1" })).toBeVisible();
  await expect(shipped.getByRole("link", { name: "5.0.0" })).toHaveAttribute(
    "href",
    "/changelog#5.0.0",
  );

  const nextSection = page.locator("#roadmap-next").locator("..");
  await expect(nextSection.getByRole("link", { name: "5.0.3" })).toHaveCount(0);
  await expect(nextSection.getByRole("link", { name: "5.0.2" })).toHaveCount(0);
  await expect(nextSection.getByText("Next", { exact: true })).toBeVisible();
  const nextText = await nextSection.innerText();
  expect(nextText).toMatch(
    /5\.0\.4[\s\S]*5\.0\.5[\s\S]*5\.1 Schedule[\s\S]*5\.2 Contracts and subs[\s\S]*5\.3 Document control[\s\S]*5\.4 Compliance[\s\S]*5\.5 Owner billing and portfolio reporting/,
  );
  expect(nextText).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  expect(nextText).not.toMatch(/coming\s+soon|TBD|WIP|placeholder|\bERP\b/i);

  await expect(page.getByRole("link", { name: "Changelog" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Status" })).toBeVisible();
});

test("/status and /changelog link to /roadmap", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByRole("link", { name: "Roadmap" })).toHaveAttribute(
    "href",
    "/roadmap",
  );
  await page.goto("/changelog");
  await expect(page.getByRole("link", { name: "Roadmap" })).toHaveAttribute(
    "href",
    "/roadmap",
  );
});
