/**
 * Platform workflow E2E — org-free (Task 14 / C6).
 *
 * Journey: superuser login → platform initialized (`init_platform` master
 * data present: roles, statuses, departments) → directory users →
 * client/vendor (no org) → production workflow → audit.
 *
 * There is no organization anywhere in the flow: no `/organizations/` URL,
 * no org header, no org switcher.
 *
 * Run (backend up, seeded for e2e):
 *   pnpm exec playwright test e2e/platform-workflow.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8000';

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await expect(page).not.toHaveURL(/organizations/);
  await page.getByLabel(/username|email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe('Platform workflow (no org)', () => {
  test.beforeEach(async ({ request }) => {
    // Guard: this spec needs the live REST backend; skip (don't fail) without it.
    let backendUp = false;
    try {
      const probe = await request.get(`${API_URL}/api/v1/auth/login/`, { timeout: 5_000 });
      // 405 = reachable Django (GET not allowed on the login route).
      backendUp = probe.status() === 405 || probe.status() === 401;
    } catch {
      backendUp = false;
    }
    test.skip(!backendUp, 'REST backend not reachable at ' + API_URL);
  });

  test('platform workflow with no org', async ({ page }) => {
    await page.goto('/login');
    await expect(page).not.toHaveURL(/organizations/);
    await page.getByLabel(/username|email/i).fill('admin@studiohub.vfx');
    // Canonical seed_dev superuser (seeded with password123).
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /productions & shows|projects/i })).toBeVisible();
  });

  test('init_platform master data is visible in platform admin', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx', 'password123');
    // Roles (init_platform identity catalog) render in the platform admin.
    await page.goto('/platform/admin/roles');
    await expect(page.getByRole('button', { name: /platform roles/i })).toBeVisible();
    await expect(page.getByText(/Platform Admin/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^Artist$/i).first()).toBeVisible();
    // Departments (init_platform masterdata directory).
    await page.getByRole('button', { name: /departments/i }).click();
    await expect(page.getByText(/Editorial/i).first()).toBeVisible({ timeout: 20_000 });
    // Statuses (init_platform MasterStatus workflow statuses).
    await page.goto('/platform/admin/statuses');
    await expect(page.locator('main')).toContainText(/Todo/i, { timeout: 20_000 });
    await expect(page.locator('main')).toContainText(/In Progress/i);
  });

  test('directory users render from the backend', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx', 'password123');
    await page.goto('/people');
    await expect(
      page.getByRole('heading', { name: /People Directory/i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('main')).toContainText(/Alex Chen/i, { timeout: 20_000 });
  });

  test('clients and vendors list without any org context', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx', 'password123');
    await page.goto('/clients');
    await expect(
      page.getByRole('heading', { name: /Client Studios/i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Apex Digital Studios/i).first()).toBeVisible();
    await expect(page).not.toHaveURL(/organizations/);

    await page.goto('/vendors');
    await expect(
      page.getByRole('heading', { name: /Vendor Partners/i })
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Scanline Roto & Prep Lab/i).first()).toBeVisible();
  });

  test('client create round-trip has no org step', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx', 'password123');
    const stamp = Date.now().toString(36).toUpperCase();
    const name = `E2E Workflow Client ${stamp}`;
    await page.goto('/clients/new');
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Client Name|Studio Name|Name/i).first().fill(name);
    await page.getByLabel(/Code/i).first().fill(`WF${stamp.slice(-5)}`);
    await page.getByRole('button', { name: /create|register|add/i }).first().click();
    // Lands back on the clients list with the new row, never an org URL.
    await page.waitForURL(/\/clients(\/|$)/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/organizations/);
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 20_000 });
  });

  test('production workflow: project workspace loads production tabs', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx', 'password123');
    await page.goto('/projects');
    await expect(page.getByRole('heading', { name: /productions & shows|projects/i })).toBeVisible();
    const projectLink = page.locator('a[href^="/projects/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 20_000 });
    await projectLink.click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.locator('body')).toBeVisible();
    // Workspace renders the production section (sequences/shots surface).
    await expect(page.getByRole('tab', { name: /Production/i })).toBeVisible({ timeout: 20_000 });
  });

  test('audit trail renders backend rows', async ({ page }) => {
    await loginAs(page, 'admin@studiohub.vfx', 'password123');
    await page.goto('/audit');
    await expect(
      page.getByRole('heading', { name: /Enterprise Activity & Audit Trail/i })
    ).toBeVisible({ timeout: 20_000 });
    // Compliance table: assert concrete backend rows — each row carries an
    // Action badge plus a mono entity-code cell (not a weak body-text match).
    await page.getByRole('button', { name: /Compliance Table/i }).click();
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 20_000 });
    await expect(firstRow.locator('td').nth(2)).not.toBeEmpty();
    await expect(firstRow.locator('td').nth(3)).not.toBeEmpty();
  });
});
