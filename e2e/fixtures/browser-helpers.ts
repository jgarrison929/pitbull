import { Browser, BrowserContext, Page, expect } from '@playwright/test';
import path from 'path';
import type { PersonaKey } from './roles';

const authDir = path.join(__dirname, '..', '.auth');

export async function openAsPersona(
  browser: Browser,
  persona: PersonaKey,
  options?: { companyId?: string }
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    storageState: path.join(authDir, `${persona}.json`),
  });
  if (options?.companyId) {
    await context.addInitScript((id: string) => {
      localStorage.setItem('pitbull_active_company_id', id);
    }, options.companyId);
  }
  const page = await context.newPage();
  return { context, page };
}

/** Align browser API calls with a subsidiary company (field workflows use home company). */
export async function setActiveCompany(page: Page, companyId: string): Promise<void> {
  const base = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
  if (!page.url().startsWith(base)) {
    await page.goto(base);
    await page.waitForLoadState('domcontentloaded');
  }
  await page.evaluate((id) => {
    localStorage.setItem('pitbull_active_company_id', id);
  }, companyId);
}

export async function closeContext(context: BrowserContext): Promise<void> {
  await context.close();
}

/** Shadcn Select: click trigger then pick option by accessible name. */
export async function pickSelectOption(
  page: Page,
  trigger: ReturnType<Page['getByRole']>,
  optionName: string | RegExp
): Promise<void> {
  await trigger.click();
  await page.getByRole('option', { name: optionName }).click();
}

/** Wait for a status badge or text to appear on the page (UI assertion). */
export async function expectStatusVisible(
  page: Page,
  status: string | RegExp,
  timeout = 15_000
): Promise<void> {
  await expect(page.getByText(status).first()).toBeVisible({ timeout });
}

/** Filter a data table by search input when the page exposes one. */
export async function filterTableBySearch(page: Page, text: string): Promise<void> {
  const search = page.getByPlaceholder(/search/i).first();
  if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
    await search.fill(text);
    await page.waitForTimeout(800);
  }
}