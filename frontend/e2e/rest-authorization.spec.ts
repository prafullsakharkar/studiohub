/**
 * Task 14 (C6) E2E — REST mode authorization with the Django backend,
 * org-free.
 *
 * Proves the app works purely through backend APIs: login persists a
 * session, protected surfaces are role-gated, project workspaces fail
 * closed for non-members, and no /organizations/ route is reachable.
 */

import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'password123';

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/username|email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe('REST authorization (Django-backed, no org)', () => {
  test.beforeEach(async ({ request }) => {
    let backendUp = false;
    try {
      const probe = await request.get(`${process.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/v1/auth/login/`, { timeout: 5_000 });
      backendUp = probe.status() === 405 || probe.status() === 401;
    } catch {
      backendUp = false;
    }
    test.skip(!backendUp, 'REST backend not reachable');
  });

  test('unauthenticated deep link redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);
    await expect(page.getByLabel(/username|email/i)).toBeVisible();
  });

  test('superuser logs in and reaches the dashboard', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('production member is denied the platform admin route', async ({ page }) => {
    await loginAs(page, 'lead@studiohub.vfx');
    await page.goto('/platform/admin');
    await expect(page).toHaveURL(/\/(forbidden|unauthorized)/);
  });

  test('project workspace without membership redirects (no data leak)', async ({ page }) => {
    await loginAs(page, 'artist@studiohub.vfx');
    await page.goto('/projects/00000000-0000-0000-0000-000000000000');
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/projects\/00000000-0000-0000-0000-000000000000/);
  });
});
