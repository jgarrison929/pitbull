import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);

/**
 * PLAYWRIGHT_BASE_URL, or BASE_URL when that is unset, points the suite at an
 * already-running app (staging, or a local `npm start`) and does not boot
 * webServer. Unset, e2e starts `npm run start` on PORT as before.
 */
function externalBaseURL(): string | undefined {
  const raw = process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL;
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

const externalBase = externalBaseURL();

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI
    ? [["list"], ["github"], ["./tests/e2e/areas/plan-edit/reporter.ts"]]
    : [["list"], ["./tests/e2e/areas/plan-edit/reporter.ts"]],
  expect: {
    toHaveScreenshot: {
      // Same Linux Chromium as CI. Zero tolerance — measured run-to-run noise
      // is 0px; a one-digit KPI change must fail (see visual.spec acceptance).
      maxDiffPixels: 0,
      animations: "disabled",
    },
  },
  use: {
    baseURL: externalBase ?? `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Same locale/timezone as seed calendar + LocalTime chips in visual.spec.
    locale: "en-US",
    timezoneId: "UTC",
  },
  // Desktop Chrome only — Linux Chromium + Geist (next/font/local).
  // area-plan-edit owns tests/e2e/areas/plan-edit. chromium ignores that
  // folder so `npm run e2e` runs those tests once, via the area project.
  projects: [
    {
      name: "chromium",
      testIgnore: "**/areas/plan-edit/**",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "area-plan-edit",
      testDir: "tests/e2e/areas/plan-edit",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        colorScheme: "light",
      },
    },
  ],
  ...(externalBase
    ? {}
    : {
        webServer: {
          command: `npm run start -- -p ${port}`,
          url: `http://localhost:${port}/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          // Do NOT set V5_SEED_STRESS here — that injects 10k codes into every
          // sandbox and makes login "Reset demo" exceed the default expect timeout.
          // stress-typeahead.spec.ts seeds via POST /api/demo/ensure-stress
          // (gated; 404 unless this flag is set).
          env: {
            ...process.env,
            V5_ALLOW_ENSURE_STRESS: "1",
            // Enables /app/error-probe throw for AppShell boundary e2e (unlinked; not crawled).
            V5_ERROR_PROBE: process.env.V5_ERROR_PROBE ?? "1",
            // Deterministic ci-gate label in e2e (avoids live GitHub rate limits in CI).
            CI_GATE_RESULT: process.env.CI_GATE_RESULT ?? "pass",
            // Shape-only stamp so /status last-verify is never blank in smoke.
            LAST_VERIFY_AT:
              process.env.LAST_VERIFY_AT ?? "2026-10-20T17:00:00.000Z",
            // Shape-only last-verify commit (full 40-char SHA, same as /status deploy commit).
            LAST_VERIFY_COMMIT:
              process.env.LAST_VERIFY_COMMIT ??
              "0057a2c9b0e7ffff0057a2c9b0e7ffff0057a2c9",
            // Freeze the seed calendar (plan + finish dates) for deterministic
            // visuals. sandbox.ts keeps company.seededAt + TTL on wall clock so
            // login reset and expiry stay correct.
            V5_SEED_NOW:
              process.env.V5_SEED_NOW ?? "2026-10-20T17:00:00.000Z",
          },
        },
      }),
});
