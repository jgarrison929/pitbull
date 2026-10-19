import { expect, test } from "@playwright/test";

const roles = [
  ["executive", "Elena Brooks"],
  ["pm", "Marcus Lee"],
  ["superintendent", "Ray Dominguez"],
  ["foreman", "Luis Ortega"],
] as const;

test("signed-out visitors land on the role picker", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

for (const [role, name] of roles) {
  test(`role card signs in as ${role}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId(`role-${role}`).click();
    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByTestId("signed-in-as")).toContainText(name);
  });
}

test("switching roles keeps the sandbox, a new visitor gets a new one, reset reseeds", async ({
  page,
  browser,
}) => {
  await page.goto("/login");
  await page.getByTestId("role-pm").click();
  const sandbox = await page.getByTestId("sandbox-id").textContent();
  await page.goto("/login");
  await page.getByTestId("role-executive").click();
  await expect(page.getByTestId("sandbox-id")).toHaveText(sandbox!);

  const other = await browser.newPage();
  await other.goto("/login");
  await other.getByTestId("role-pm").click();
  await expect(other.getByTestId("sandbox-id")).not.toHaveText(sandbox!);
  await other.close();

  const seeded = await page.getByTestId("seeded-at").getAttribute("datetime");
  await page.getByTestId("user-menu").click();
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page).toHaveURL(/reset=1/);
  await expect(page.getByTestId("seeded-at")).not.toHaveAttribute(
    "datetime",
    seeded!,
  );
  await expect(page.getByTestId("sandbox-id")).toHaveText(sandbox!);
});
