/**
 * Task 14 (C6) verification — flat entity views on the org-free app.
 *
 * The org workspace tabs are gone; entity surfaces are now flat pages
 * (/clients, /vendors, /projects, /people, /departments, /teams, /offices)
 * plus the platform admin master-data tabs (/platform/admin/roles,
 * /platform/admin/statuses, /platform/admin/software, ...). Verifies:
 *   - flat list pages render real backend rows
 *   - platform admin master-data tabs render (roles/groups/departments/
 *     positions, statuses, software, task-types)
 *   - vendor UI create round-trip (create → workspace → API delete → gone)
 *   - no delete affordance on clients/vendors lists
 *   - roles list selection drives the permissions inspector
 *   - artist is denied the platform admin surface (403 gate)
 *
 * Run (backend up, seeded for e2e):
 *   pnpm exec playwright test e2e/flat-entity-views.spec.ts
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

async function dismissBanner(page: Page) {
  const later = page.getByRole('button', { name: 'Maybe later' });
  try {
    await later.click({ timeout: 2_500 });
  } catch {
    // Banner not present — nothing to clear.
  }
}

test.describe('Flat entity views (REST)', () => {
  test.beforeEach(async ({ page, request }) => {
    let backendUp = false;
    try {
      const probe = await request.get(`${API_URL}/api/v1/auth/login/`, { timeout: 5_000 });
      backendUp = probe.status() === 405 || probe.status() === 401;
    } catch {
      backendUp = false;
    }
    test.skip(!backendUp, 'REST backend not reachable at ' + API_URL);
    await loginAs(page, 'admin@studiohub.vfx');
  });

  test('flat list pages render real backend rows', async ({ page }) => {
    const cases: Array<[string, RegExp, RegExp]> = [
      ['/clients', /Client Studios/i, /Apex Digital Studios/i],
      ['/vendors', /Vendor Partners/i, /Scanline Roto & Prep Lab/i],
      ['/projects', /Productions & Shows/i, /Neon Knight 2099/i],
      ['/people', /People Directory/i, /Alex Chen/i],
      ['/departments', /Departments/i, /Editorial/i],
      ['/teams', /Teams/i, /Editorial Team/i],
      ['/offices', /Offices/i, /Mumbai Studio/i],
    ];
    for (const [path, heading, row] of cases) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('main')).toContainText(row, { timeout: 20_000 });
      await expect(page).not.toHaveURL(/organizations/);
    }
  });

  test('platform admin master-data tabs render (roles, departments, statuses, software)', async ({ page }) => {
    await page.goto('/platform/admin/roles');
    await dismissBanner(page);
    await expect(page.getByRole('button', { name: /platform roles/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('main')).toContainText(/Platform Admin/i, { timeout: 20_000 });

    await page.getByRole('button', { name: /departments/i }).click();
    await expect(page.locator('main')).toContainText(/Editorial/i, { timeout: 20_000 });

    await page.goto('/platform/admin/statuses');
    await expect(page.locator('main')).toContainText(/Todo/i, { timeout: 20_000 });

    await page.goto('/platform/admin/software');
    await expect(page.locator('main')).toContainText(/Software|DCC/i, { timeout: 20_000 });

    await page.goto('/platform/admin/task-types');
    await expect(page.locator('main')).toBeVisible({ timeout: 20_000 });
  });

  test('vendor UI round-trip: create via UI, delete via API, gone on reload', async ({ page, request }) => {
    const stamp = Date.now().toString(36).toUpperCase();
    const name = `E2E Vendor ${stamp}`;
    const code = `E2V${stamp}`.slice(0, 8);

    await page.goto('/vendors/new');
    await expect(page.getByRole('heading', { name: /Register New Vendor Partner/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/Vendor Name/i).fill(name);
    await page.getByLabel(/Vendor Code/i).fill(code);
    await page.getByRole('button', { name: /Create Vendor Partner/i }).click();
    // Create lands on the vendor workspace.
    await page.waitForURL(/\/vendors\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.locator('main')).toContainText(name, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/organizations/);

    // Resolve the id via the list API, delete, and confirm the row is gone.
    const token = await page.evaluate(() => localStorage.getItem('studiohub_access_token'));
    const listRes = await request.get(`${API_URL}/api/v1/vendors/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.status()).toBe(200);
    const body = await listRes.json();
    const items = Array.isArray(body) ? body : (body.results ?? []);
    const created = items.find((v: { name: string }) => v.name === name);
    expect(created, 'created vendor resolvable via API').toBeTruthy();
    const delRes = await request.delete(`${API_URL}/api/v1/vendors/${created.id}/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 202, 204]).toContain(delRes.status());

    await page.goto('/vendors');
    await expect(page.locator('main')).not.toContainText(name, { timeout: 20_000 });
  });

  test('clients and vendors lists expose no delete affordance', async ({ page }) => {
    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: /Client Studios/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('button[title="Delete"], button:has-text("Delete")')).toHaveCount(0);

    await page.goto('/vendors');
    await expect(page.getByRole('heading', { name: /Vendor Partners/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('button[title="Delete"], button:has-text("Delete")')).toHaveCount(0);
  });

  test('roles list selection drives the permissions inspector', async ({ page }) => {
    await page.goto('/platform/admin/roles');
    await dismissBanner(page);
    await expect(page.getByRole('button', { name: /platform roles/i })).toBeVisible({ timeout: 20_000 });
    // Inspector panel shows the authoritative privileges matrix for the
    // initially selected role (first row).
    await expect(page.locator('main')).toContainText(/Authoritative Privileges Matrix/i, {
      timeout: 20_000,
    });
    // Selecting a different role row must drive the inspector header to it.
    await page.getByText('Artist', { exact: true }).first().click();
    await expect(page.locator('h3', { hasText: 'Artist' })).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('Flat entity views — restricted role (REST)', () => {
  test.beforeEach(async ({ page, request }) => {
    let backendUp = false;
    try {
      const probe = await request.get(`${API_URL}/api/v1/auth/login/`, { timeout: 5_000 });
      backendUp = probe.status() === 405 || probe.status() === 401;
    } catch {
      backendUp = false;
    }
    test.skip(!backendUp, 'REST backend not reachable at ' + API_URL);
    await loginAs(page, 'artist@studiohub.vfx');
  });

  test('artist is denied the platform admin surface (no list, no actions)', async ({ page }) => {
    await page.goto('/platform/admin');
    await expect(page).toHaveURL(/\/(forbidden|unauthorized)/, { timeout: 20_000 });
  });
});
