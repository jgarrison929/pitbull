import { expect, test } from "@playwright/test";
import pkg from "../../package.json";

test("status page shows version, commit and health", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByText("Pitbull status")).toBeVisible();
  await expect(page.getByTestId("status-version")).toHaveText(pkg.version);
  await expect(page.getByTestId("status-commit")).toHaveText(
    process.env.EXPECT_COMMIT ?? /.+/,
  );
  await expect(page.getByTestId("health-status")).toHaveText("Operational");
  await expect(page.getByTestId("status-database")).toHaveText(
    process.env.DATABASE_URL ? "ok" : "not-configured",
  );
});

test("health route reports ok", async ({ request }) => {
  const res = await request.get("/health");
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.version).toBe(pkg.version);
});
