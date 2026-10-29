// Canonical-route regression harness (org-free).
//
// Task 14 (C6): the route guard is fail-closed — unauthenticated deep
// links redirect to /login first, so these specs authenticate as the
// platform superuser before exercising redirects.
import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'password123';

async function loginAsPlatformAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/username|email/i).fill('admin@studiohub.vfx');
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test('old routes redirect to canonical (authenticated)', async ({ page }) => {
  await loginAsPlatformAdmin(page);
  await page.goto('/api-health');
  await expect(page).toHaveURL(/\/platform\/health/);
  await page.goto('/permissions');
  // /permissions is a legacy alias into the org-free Access & RBAC
  // workspace (AppRoutes.tsx maps it to /access).
  await expect(page).toHaveURL(/\/access/);
  await page.goto('/audit-logs');
  await expect(page).toHaveURL(/\/audit/);
  await page.goto('/calendar');
  await expect(page).toHaveURL(/\/scheduling/);
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/platform\/admin\/pipeline/);
});

test('old routes redirect unauthenticated users to login first', async ({ page }) => {
  await page.goto('/audit');
  await expect(page).toHaveURL(/\/login/);
});

test('canonical workspaces load with tabs', async ({ page }) => {
  await loginAsPlatformAdmin(page);
  for (const url of ['/audit', '/system-logs', '/jobs', '/platform/health', '/platform/admin/roles']) {
    await page.goto(url);
    await expect(page.locator('main')).toBeVisible();
  }
});
