import { test, expect } from "@playwright/test";

/**
 * Owner self-service signup discoverability — no auth required.
 * Verifies middleware allows /signup and login cross-link works.
 */
test.describe("Owner signup public flow", () => {
  test("login page links to signup wizard", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const signupLink = page.getByRole("link", { name: /create an account/i });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute("href", "/signup");

    await signupLink.click();
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup$/);

    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
    await expect(page.getByLabel(/first name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("signup page loads directly without demo redirect", async ({ page }) => {
    const response = await page.goto("/signup");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByText(/account/i).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });
});