// @ts-nocheck
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { maxDiffPixels: 250 }
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
    storageState: process.env.E2E_AUTH_STATE || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run codespace:dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    timeout: 120_000
  },
  reporter: [['list'], ['html', { open: 'never' }]]
});
