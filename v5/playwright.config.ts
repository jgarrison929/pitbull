import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
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
    },
  },
});

