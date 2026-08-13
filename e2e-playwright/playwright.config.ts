import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    baseURL: 'https://www.fisiai.online',
    actionTimeout: 20_000,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
    video: 'retain-on-failure',
  },
});
