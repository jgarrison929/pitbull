import { expect, test, type Page } from "@playwright/test";
import { THEME_COOKIE } from "@/lib/theme";

/**
 * Spec 5.0.3 acceptance check 10 — dark theme cookie, first paint, all 4 roles.
 * Crawl-in-both-themes (check 11 half) stays with verify-v5 later.
 */

const ROLES = ["executive", "pm", "superintendent", "foreman"] as const;

async function signIn(page: Page, role: string) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

async function htmlTheme(page: Page) {
  return page.locator("html").getAttribute("data-theme");
}

async function htmlHasDarkClass(page: Page) {
  return page.locator("html").evaluate((el) => el.classList.contains("dark"));
}

test.describe("dark theme (5.0.3 Part C / check 10)", () => {
  for (const role of ROLES) {
    test(`as ${role}: Dark persists after reload with no light flash`, async ({
      page,
    }) => {
      await signIn(page, role);
      await expect(await htmlTheme(page)).toBe("light");
      await expect(await htmlHasDarkClass(page)).toBe(false);

      await page.getByTestId("user-menu").click();
      await expect(page.getByTestId("theme-switch")).toBeVisible();
      await page.getByTestId("theme-dark").click();

      await expect.poll(async () => htmlTheme(page)).toBe("dark");
      await expect(await htmlHasDarkClass(page)).toBe(true);

      // Cookie-backed SSR: the document HTML already has .dark before paint.
      const url = page.url();
      const ssr = await page.request.get(url);
      expect(ssr.ok()).toBeTruthy();
      const ssrHtml = await ssr.text();
      expect(ssrHtml).toMatch(/\bclass="[^"]*\bdark\b/);
      expect(ssrHtml).toMatch(/data-theme="dark"/);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(await htmlTheme(page)).toBe("dark");
      await expect(await htmlHasDarkClass(page)).toBe(true);

      const cookies = await page.context().cookies();
      const themeCookie = cookies.find((c) => c.name === THEME_COOKIE);
      expect(themeCookie?.value).toBe("dark");
    });
  }

  test("Light switch clears dark after Dark was set", async ({ page }) => {
    await signIn(page, "pm");
    const menu = page.locator("details").filter({
      has: page.getByTestId("user-menu"),
    });
    await page.getByTestId("user-menu").click();
    await expect(page.getByTestId("theme-switch")).toBeVisible();
    await page.getByTestId("theme-dark").click();
    await expect.poll(async () => htmlTheme(page)).toBe("dark");

    // Soft refresh can leave <details> open or closed — force open for Light.
    await menu.evaluate((el) => {
      (el as HTMLDetailsElement).open = true;
    });
    await expect(page.getByTestId("theme-light")).toBeVisible();
    await page.getByTestId("theme-light").click();
    await expect.poll(async () => htmlTheme(page)).toBe("light");
    await expect(await htmlHasDarkClass(page)).toBe(false);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(await htmlTheme(page)).toBe("light");
  });

  test("must-fail: cookie dark without .dark class is corrected on reload", async ({
    page,
    baseURL,
  }) => {
    await page.context().addCookies([
      {
        name: THEME_COOKIE,
        value: "dark",
        url: baseURL ?? "http://localhost:3100",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto("/login");
    await expect(await htmlHasDarkClass(page)).toBe(true);

    // Simulate a client regression that drops the class.
    await page.locator("html").evaluate((el) => {
      el.classList.remove("dark");
    });
    expect(await htmlHasDarkClass(page)).toBe(false);

    // SSR from the cookie must restore .dark — goes red if layout ignores the cookie.
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(await htmlHasDarkClass(page)).toBe(true);
    await expect(await htmlTheme(page)).toBe("dark");
  });
});
