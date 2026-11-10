import * as fs from 'fs';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:9000';
const authStateFile = 'integration-tests/.auth/state.json';
const hasGlobalSetup = !process.env.SKIP_OLS_SETUP;
const storageState = hasGlobalSetup || fs.existsSync(authStateFile) ? authStateFile : undefined;

if (!storageState) {
  console.warn(
    `Warning: Auth state file "${authStateFile}" not found.` +
      ' Tests will run without stored authentication.',
  );
}

export default defineConfig({
  testDir: './integration-tests/tests',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: {
    // The console plugin page load (console bundle + plugin fetch + app-server
    // proxy round-trips) can take longer than the Playwright default on a
    // fresh CI cluster; 10s caused flakes right after navigation.
    timeout: 30_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'gui_test_screenshots/playwright-report' }],
    ['junit', { outputFile: 'gui_test_screenshots/junit_playwright.xml' }],
  ],
  outputDir: 'gui_test_screenshots/test-results',
  globalSetup: process.env.SKIP_OLS_SETUP
    ? undefined
    : './integration-tests/support/global-setup.ts',
  globalTeardown: process.env.SKIP_OLS_SETUP
    ? undefined
    : './integration-tests/support/global-teardown.ts',
  use: {
    baseURL,
    storageState,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1080 },
      },
    },
  ],
});
