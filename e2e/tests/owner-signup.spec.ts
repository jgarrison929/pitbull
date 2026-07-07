import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:5081";
const SCRATCH = process.env.E2E_OUTPUT_DIR ?? path.join(__dirname, "..", "recordings");

function appendEvidence(line: string) {
  const logPath = path.join(SCRATCH, "owner-signup-wizard-e2e.log");
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`);
}

/**
 * Owner self-service signup — public UI wizard through register API to authenticated app.
 * Requires API at API_BASE_URL and web at DEMO_BASE_URL (NEXT_PUBLIC_API_BASE_URL baked at build).
 */
test.describe("Owner signup public flow", () => {
  test("login page links to signup wizard", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    const signupLink = page.getByRole("link", { name: /create an account/i });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute("href", "/signup");

    await signupLink.click();
    await page.waitForURL("**/signup");
    await expect(page.getByRole("heading", { name: /create your account/i })).toBeVisible();
  });

  test("signup page loads directly without demo redirect", async ({ page }) => {
    const response = await page.goto("/signup");
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
  });

  test("complete signup wizard registers owner and opens admin route via cookie", async ({
    page,
    request,
  }) => {
    test.slow();

    const health = await request.get(`${API_BASE}/health/live`);
    expect(health.ok(), `API not reachable at ${API_BASE}`).toBeTruthy();

    const email = `e2e-owner-${Date.now()}@example.com`;
    const password = "SecurePass123";
    const companyName = `E2E Owner Co ${Date.now()}`;

    appendEvidence(`WIZARD_START email=${email} company=${companyName}`);

    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    // Step 1 — account
    await page.locator("#firstName").fill("Test");
    await page.locator("#lastName").fill("Owner");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.locator("#confirmPassword").fill(password);
    await page.locator("label[for='terms']").click();
    const continueBtn = page.getByRole("button", { name: /continue/i }).first();
    await expect(continueBtn).toBeEnabled({ timeout: 10_000 });
    await continueBtn.click();

    await expect(page.getByRole("heading", { name: /set up your company/i })).toBeVisible();

    // Step 2 — company
    await page.locator("#companyName").fill(companyName);
    await page.getByRole("button", { name: /continue/i }).click();

    await expect(page.getByRole("heading", { name: /invite your team/i })).toBeVisible();

    // Step 3 — submit (skip invites)
    const registerPromise = page.waitForResponse(
      (r) => r.url().includes("/api/auth/register") && r.request().method() === "POST",
      { timeout: 30_000 }
    );

    await page.getByRole("button", { name: /create account/i }).click();
    const registerResp = await registerPromise;
    const registerBody = await registerResp.text();
    appendEvidence(`WIZARD_REGISTER status=${registerResp.status()} body=${registerBody}`);

    expect(registerResp.status()).toBe(201);
    expect(registerBody).toContain("Admin");

    await page.waitForURL("**/settings/company/setup**", { timeout: 30_000 });
    appendEvidence(`WIZARD_REDIRECT url=${page.url()}`);

    const cookies = await page.context().cookies();
    const tokenCookie = cookies.find((c) => c.name === "pitbull_token");
    expect(tokenCookie?.value, "pitbull_token cookie required for middleware").toBeTruthy();
    appendEvidence(`WIZARD_COOKIE pitbull_token_len=${tokenCookie?.value?.length ?? 0}`);

    // Middleware-protected route — would redirect to /login without cookie
    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");
    appendEvidence(`WIZARD_ADMIN_USERS url=${page.url()}`);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(email, { exact: false })).toBeVisible({ timeout: 15_000 });
    appendEvidence("WIZARD_OK admin users visible for registered owner");
  });
});