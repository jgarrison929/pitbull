import { expect, test, type Page } from "@playwright/test";
import {
  ERROR_PROBE_MESSAGE,
  ERROR_PROBE_OK_COOKIE,
} from "@/lib/error-probe";

/**
 * Proves `/app` segment `error.tsx` keeps AppShell chrome, recovery UI never
 * shows digest/raw throw text, and Try again re-fetches (not a no-op).
 * Probe throws only when V5_ERROR_PROBE=1 (Playwright webServer).
 */
const roles = ["executive", "pm", "superintendent", "foreman"] as const;
const widths = [320, 1280] as const;

async function signIn(page: Page, role: (typeof roles)[number]) {
  await page.goto("/login");
  await page.getByTestId(`role-${role}`).click();
  await expect(page).toHaveURL(/\/app/);
}

async function assertShellKept(page: Page, width: number) {
  await expect(page.getByTestId("route-error")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Page load failed" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo login" })).toBeVisible();
  await expect(page.getByTestId("user-menu")).toBeVisible();
  // 5.0.4-b: the foreman keeps the job strip on the phone (plan-state pill).
  await expect(page.getByTestId("job-strip")).toBeVisible();
  // `signed-in-as` is `hidden sm:block` — open the menu on phone to prove identity chrome.
  if (width < 640) {
    await page.getByTestId("user-menu").click();
    await expect(page.getByTestId("signed-in-as")).toBeAttached();
    await expect(page.getByTestId("phone-tab-bar")).toBeVisible();
  } else {
    await expect(page.getByTestId("signed-in-as")).toBeVisible();
  }
  await expect(page.locator("body")).not.toContainText(/Error id/i);
  await expect(page.locator("body")).not.toContainText(ERROR_PROBE_MESSAGE);
}

for (const role of roles) {
  for (const width of widths) {
    test(`AppShell stays on /app throw (${role} @ ${width})`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width,
        height: width < 768 ? 640 : 900,
      });
      await signIn(page, role);
      await page.goto("/app/error-probe");
      await assertShellKept(page, width);
    });
  }
}

test("Try again re-fetches; raw throw message stays off screen", async ({
  page,
  context,
  baseURL,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, "pm");
  await page.goto("/app/error-probe");
  await expect(page.getByTestId("route-error")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(ERROR_PROBE_MESSAGE);
  await expect(page.locator("body")).not.toContainText(/Error id/i);

  // Arm recovery, then click Try again — a no-op button would never show this.
  await context.addCookies([
    {
      name: ERROR_PROBE_OK_COOKIE,
      value: "1",
      url: baseURL ?? "http://localhost:3100",
    },
  ]);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("error-probe-recovered")).toBeVisible();
  await expect(page.getByTestId("user-menu")).toBeVisible();
  await expect(page.getByTestId("job-strip")).toBeVisible();
  await expect(page.getByTestId("signed-in-as")).toBeVisible();
});
