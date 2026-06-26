import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { PERSONAS, DEMO_PASSWORD } from './roles';

const authDir = path.join(__dirname, '..', '.auth');

for (const persona of Object.values(PERSONAS)) {
  setup(`authenticate as ${persona.key}`, async ({ page }) => {
    const authFile = path.join(authDir, `${persona.key}.json`);

    await page.goto('/login');
    const signInButton = page.getByRole('button', { name: /sign in/i });
    await signInButton.waitFor({ state: 'visible', timeout: 30_000 });

    await page.getByRole('textbox', { name: /email address/i }).fill(persona.email);
    await page.getByRole('textbox', { name: /password/i }).fill(DEMO_PASSWORD);
    await signInButton.click();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
    await page.waitForLoadState('domcontentloaded');

    await page.context().storageState({ path: authFile });
  });
}