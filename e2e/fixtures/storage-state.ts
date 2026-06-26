import type { BrowserContextOptions } from '@playwright/test';

const TOKEN_KEY = 'pitbull_token';
const REFRESH_TOKEN_KEY = 'pitbull_refresh_token';

const ACTIVE_COMPANY_KEY = 'pitbull_active_company_id';

export function buildStorageState(
  token: string,
  refreshToken?: string,
  activeCompanyId?: string | null
): NonNullable<BrowserContextOptions['storageState']> {
  const baseURL = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';
  const { hostname, origin } = new URL(baseURL);
  const secure = baseURL.startsWith('https');

  const localStorage: { name: string; value: string }[] = [
    { name: TOKEN_KEY, value: token },
  ];
  if (activeCompanyId) {
    localStorage.push({ name: ACTIVE_COMPANY_KEY, value: activeCompanyId });
  }
  if (refreshToken) {
    localStorage.push({ name: REFRESH_TOKEN_KEY, value: refreshToken });
  }

  return {
    cookies: [
      {
        name: TOKEN_KEY,
        value: token,
        domain: hostname,
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
        httpOnly: false,
        secure,
        sameSite: 'Lax',
      },
    ],
    origins: [{ origin, localStorage }],
  };
}