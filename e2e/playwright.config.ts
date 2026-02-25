import { defineConfig } from '@playwright/test';
import path from 'path';

const recordingsDir = path.join(__dirname, 'recordings');

export default defineConfig({
  testDir: './tests',
  outputDir: recordingsDir,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,

  use: {
    baseURL: process.env.DEMO_BASE_URL || 'https://demo.example.com',
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
    screenshot: 'on',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      testDir: './fixtures',
    },
    {
      name: 'demo-recording',
      dependencies: ['setup'],
      use: {
        storageState: path.join(__dirname, '.auth/user.json'),
      },
    },
  ],
});
