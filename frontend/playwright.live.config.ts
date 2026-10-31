import { defineConfig, devices } from '@playwright/test';

/**
 * Role smoke tests against the factory-seeded backend (docs/sync/tools/live_backend.py).
 *
 * The harness writes the backend's URL and the seeded users to $SYNC_LIVE_INFO. The dev server runs with
 * `VITE_API_URL` empty so the app calls relative `/api/...` URLs; `e2e/live/fixtures.ts` forwards those to the
 * live backend, so the browser never makes a cross-origin call and the backend needs no CORS setting.
 *
 *   SYNC_LIVE_INFO=/path/live.json pnpm exec playwright test -c playwright.live.config.ts
 */
export default defineConfig({
  testDir: './e2e/live',
  // Playwright empties its output folder at the start of a run; docs/sync/tools/run_role_smoke.sh keeps its own
  // state in test-results/live, so the two must not share a folder.
  outputDir: './test-results/playwright',
  timeout: 600_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3101',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'PORT=3101 VITE_API_URL= pnpm dev',
    url: 'http://localhost:3101',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
