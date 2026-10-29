/**
 * Platform project isolation E2E — org-free (Task 14 / C6).
 *
 * The org dimension is gone; project access is scoped by project
 * membership only. Verifies:
 *   - a project member opens their project workspace
 *   - a non-member is denied (fail-closed NoProjectAccessPage)
 *   - unknown project ids never crash the app
 *   - a superuser can open any project
 *
 * Project ids are resolved from the live backend (never hard-coded), so the
 * spec stays valid across reseeds.
 */

import { test, expect, type Page } from '@playwright/test';

const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8000';
const PASSWORD = 'password123';

async function loginAs(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/username|email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe('Platform project isolation (no org)', () => {
  let memberProjectId = '';
  let nonMemberProjectId = '';

  test.beforeAll(async ({ request }) => {
    // Resolve seeded project ids by code from the live backend.
    let backendUp = false;
    let token = '';
    try {
      const login = await request.post(`${API_URL}/api/v1/auth/login/`, {
        data: { email: 'admin@studiohub.vfx', password: PASSWORD },
        timeout: 10_000,
      });
      backendUp = login.status() === 200;
      token = ((await login.json())?.tokens?.access ?? '') as string;
    } catch {
      backendUp = false;
    }
    test.skip(!backendUp, 'REST backend not reachable at ' + API_URL);

    const res = await request.get(`${API_URL}/api/v1/projects/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    const items = Array.isArray(body) ? body : (body.results ?? []);
    const byCode = (code: string) => items.find((p: { code: string }) => p.code === code)?.id;
    memberProjectId = byCode('NK99') ?? '';
    nonMemberProjectId = byCode('AR02') ?? '';
    expect(memberProjectId, 'member project NK99 resolved').toBeTruthy();
    expect(nonMemberProjectId, 'non-member project AR02 resolved').toBeTruthy();
  });

  test('project member opens their project workspace', async ({ page }) => {
    // artist@studiohub.vfx is a member of NK99.
    await loginAs(page, 'artist@studiohub.vfx');
    await page.goto(`/projects/${memberProjectId}`);
    await expect(page).not.toHaveURL(/\/(login|unauthorized)/);
    await expect(page.locator('main')).toContainText(/Neon Knight 2099/i, { timeout: 20_000 });
  });

  test('non-member is denied the project workspace (fail closed)', async ({ page }) => {
    // artist is NOT a member of AR02 — must land on a denial page, never the
    // project workspace. RoutePermissionGuard redirects to /forbidden before
    // ProjectRoute's NoProjectAccessPage can render, so accept either page
    // (both carry an "Access Denied" heading).
    await loginAs(page, 'artist@studiohub.vfx');
    await page.goto(`/projects/${nonMemberProjectId}`);
    await expect(page.getByRole('heading', { name: /Access Denied/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).not.toHaveURL(new RegExp(`/projects/${nonMemberProjectId}`));
  });

  test('unknown project id does not crash the app', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx');
    await page.goto('/projects/00000000-0000-0000-0000-000000000000');
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('main')).toBeVisible();
  });

  test('superuser opens any project', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx');
    await page.goto(`/projects/${nonMemberProjectId}`);
    await expect(page.locator('main')).toContainText(/Aurora Rising/i, { timeout: 20_000 });
  });

  test('no org URL is ever reachable', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx');
    await page.goto(`/projects/${memberProjectId}`);
    await expect(page).not.toHaveURL(/organizations/);
  });
});
