import { defineConfig } from '@playwright/test';
import path from 'path';

const recordingsDir = process.env.E2E_OUTPUT_DIR
  ? path.join(process.env.E2E_OUTPUT_DIR, 'recordings')
  : path.join(__dirname, 'recordings');

export default defineConfig({
  testDir: './tests',
  outputDir: recordingsDir,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,

  use: {
    baseURL: process.env.DEMO_BASE_URL || 'http://localhost:3000',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      testDir: './fixtures',
    },
    {
      name: 'setup-roles',
      testMatch: /auth-multi\.setup\.ts/,
      testDir: './fixtures',
    },
    {
      name: 'demo-recording',
      dependencies: ['setup'],
      use: {
        storageState: path.join(__dirname, '.auth/user.json'),
      },
    },
    {
      name: 'role-workflows',
      dependencies: ['setup-roles'],
      testMatch: /role-workflows\.spec\.ts/,
      retries: 0,
    },
    {
      name: 'owner-signup',
      testMatch: /owner-signup\.spec\.ts/,
      retries: 0,
    },
    {
      // 2.12.5+ mobile field report scaffold (full submit in 2.12.6)
      name: 'mobile-field-report',
      dependencies: ['setup-roles'],
      testMatch: /mobile-field-report\.spec\.ts/,
      retries: 0,
      use: {
        viewport: { width: 390, height: 844 },
        video: {
          mode: 'on',
          size: { width: 390, height: 844 },
        },
      },
    },
  ],
});
