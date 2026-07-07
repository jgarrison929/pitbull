import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const API_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:5081";
const SCRATCH = process.env.E2E_OUTPUT_DIR ?? path.join(__dirname, "..", "recordings");

function appendEvidence(line: string) {
  const logPath = path.join(SCRATCH, "owner-signup-wizard-e2e.log");
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.appendFileSync(logPath, `${line}\n`);
}

/** Expected POST body after buildOwnerRegisterPayload trims wizard state. */
function expectedRegisterBody(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  companyName: string;
}) {
  return {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim(),
    password: input.password,
    companyName: input.companyName.trim(),
  };
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
    const firstName = "Test";
    const lastName = "Owner";

    appendEvidence(`WIZARD_START email=${email} company=${companyName}`);

    await page.goto("/signup");
    await page.waitForLoadState("domcontentloaded");

    // Step 1 — account (pressSequentially + blur for controlled React inputs)
    const firstNameInput = page.locator("#firstName");
    await firstNameInput.click();
    await firstNameInput.pressSequentially(firstName);
    await firstNameInput.blur();

    const lastNameInput = page.locator("#lastName");
    await lastNameInput.click();
    await lastNameInput.pressSequentially(lastName);
    await lastNameInput.blur();

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

    // Step 3 — assert POST body contract before status
    const expectedBody = expectedRegisterBody({
      firstName,
      lastName,
      email,
      password,
      companyName,
    });

    const registerRequestPromise = page.waitForRequest(
      (req) =>
        req.url().includes("/api/auth/register") &&
        req.method() === "POST",
      { timeout: 30_000 }
    );
    const registerResponsePromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/auth/register") && r.request().method() === "POST",
      { timeout: 30_000 }
    );

    await page.getByRole("button", { name: /create account/i }).click();

    const registerReq = await registerRequestPromise;
    const posted = registerReq.postDataJSON() as Record<string, string>;
    appendEvidence(`WIZARD_POST_BODY ${JSON.stringify(posted)}`);

    expect(posted.firstName).toBe(expectedBody.firstName);
    expect(posted.lastName).toBe(expectedBody.lastName);
    expect(posted.email).toBe(expectedBody.email);
    expect(posted.password).toBe(expectedBody.password);
    expect(posted.companyName).toBe(expectedBody.companyName);

    const registerResp = await registerResponsePromise;
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

    await page.goto("/admin/users");
    await page.waitForLoadState("domcontentloaded");
    appendEvidence(`WIZARD_ADMIN_USERS url=${page.url()}`);

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText(email, { exact: false })).toBeVisible({ timeout: 15_000 });
    appendEvidence("WIZARD_OK admin users visible for registered owner");
  });
});