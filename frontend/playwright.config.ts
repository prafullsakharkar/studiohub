import { defineConfig, devices } from '@playwright/test';

/**
 * StudioHub E2E (Playwright) — real Django backend only.
 *
 * No mock mode. The frontend talks exclusively to the live Django REST API
 * (VITE_API_URL, default http://127.0.0.1:8000). Auth uses real backend
 * users (e.g. supervisor@studiohub.vfx / password123).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_EXTERNAL_SERVER
    ? undefined
    : {
        command: 'PORT=3100 pnpm dev',
        url: 'http://localhost:3100',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
