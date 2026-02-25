import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '..', '.auth', 'user.json');

setup('authenticate as demo CEO', async ({ page }) => {
  const email = process.env.DEMO_USER;
  const password = process.env.DEMO_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'DEMO_USER and DEMO_PASSWORD env vars are required.\n' +
      'Copy e2e/.env.example to e2e/.env and fill in credentials, ' +
      'or export them in your shell.'
    );
  }

  await page.goto('/login');

  // Wait for the Sign In button — proves the form is hydrated and interactive
  const signInButton = page.getByRole('button', { name: /sign in/i });
  await signInButton.waitFor({ state: 'visible', timeout: 15_000 });

  // Use role-based selectors — more reliable than #id with shadcn/ui inputs.
  // Label text comes from <Label htmlFor="email"> in app/(auth)/login/page.tsx.
  await page.getByRole('textbox', { name: /email address/i }).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await signInButton.click();

  // Wait for redirect away from /login
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
  await page.waitForLoadState('domcontentloaded');

  // Save auth state for subsequent tests
  await page.context().storageState({ path: authFile });
});
