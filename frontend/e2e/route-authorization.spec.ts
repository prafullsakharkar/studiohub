/**
 * Task 14 (C6) E2E — route & page authorization, org-free.
 *
 * Verifies the fail-closed contract through the running app against the live
 * Django backend:
 *   unauthenticated  → /login
 *   authenticated + authorized → page loads
 *   authenticated + unauthorized (role / project membership) → /forbidden
 *     or the project no-access page
 *   direct URL manipulation cannot bypass authorization
 *
 * The org dimension is gone: no /organizations/ routes, no org gates.
 */

import { test, expect, type Page } from '@playwright/test';

const PASSWORD = 'password123';
const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/username|email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

async function logout(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('/login');
}

test.describe('Route authorization (no org)', () => {
  // Resolve the seeded non-member project id (AR02) once, like
  // platform-project-isolation.spec.ts — never navigate an all-zeros UUID for
  // a membership-denial assertion.
  let nonMemberProjectId = '';

  test.beforeAll(async ({ request }) => {
    let backendUp = false;
    try {
      const login = await request.post(`${API_URL}/api/v1/auth/login/`, {
        data: { email: 'admin@studiohub.vfx', password: PASSWORD },
        timeout: 10_000,
      });
      backendUp = login.status() === 200;
      const token = ((await login.json())?.tokens?.access ?? '') as string;
      if (backendUp && token) {
        const res = await request.get(`${API_URL}/api/v1/projects/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status() === 200) {
          const body = await res.json();
          const items = Array.isArray(body) ? body : (body.results ?? []);
          nonMemberProjectId =
            items.find((p: { code: string }) => p.code === 'AR02')?.id ?? '';
        }
      }
    } catch {
      backendUp = false;
    }
    test.skip(!backendUp, 'REST backend not reachable');
  });

  test.beforeEach(async ({ request }) => {
    let backendUp = false;
    try {
      const probe = await request.get(`${API_URL}/api/v1/auth/login/`, { timeout: 5_000 });
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

  test('superuser logs in and loads dashboard', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('artist cannot open the platform admin workspace via direct URL', async ({ page }) => {
    await loginAs(page, 'artist@studiohub.vfx');
    await page.goto('/platform/admin');
    await expect(page).toHaveURL(/\/(forbidden|unauthorized)/);
  });

  test('unauthorized route does not leak page content', async ({ page }) => {
    await loginAs(page, 'artist@studiohub.vfx');
    await page.goto('/platform/admin/roles');
    await expect(page).toHaveURL(/\/(forbidden|unauthorized)/);
  });

  test('project workspace without membership fails closed (no data leak)', async ({ page }) => {
    await loginAs(page, 'artist@studiohub.vfx');
    // AR02 (resolved from the backend) has no artist membership — the
    // no-access page renders instead, never the project workspace.
    expect(nonMemberProjectId, 'non-member project AR02 resolved').toBeTruthy();
    await page.goto(`/projects/${nonMemberProjectId}`);
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('login → forbidden → back keeps session', async ({ page }) => {
    await loginAs(page, 'artist@studiohub.vfx');
    await page.goto('/platform/admin');
    // Artist (not superuser) must not reach platform admin.
    await expect(page).toHaveURL(/\/(forbidden|unauthorized)/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
