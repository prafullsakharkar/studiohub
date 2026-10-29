/**
 * Client & vendor contact flow E2E — org-free (Task 14 / C6).
 *
 * The organization contact flow (org settings contact email, HQ location,
 * supervisor sync) is gone with the org module. Its flat successors are the
 * client / vendor directory entities: create with contact fields, verify the
 * contact persists across reopen and refresh, and confirm cross-entity
 * isolation (another client's workspace shows none of this client's data).
 *
 * Run (backend up, seeded for e2e):
 *   pnpm exec playwright test e2e/client-vendor-contact.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:8000';
const PASSWORD = 'password123';

async function loginAs(page: Page, email: string = 'admin@studiohub.vfx') {
  await page.goto('/login');
  await page.getByLabel(/username|email/i).fill(email);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test.describe('Client & vendor contact flow (REST)', () => {
  test.beforeEach(async ({ page, request }) => {
    let backendUp = false;
    try {
      const probe = await request.get(`${API_URL}/api/v1/auth/login/`, { timeout: 5_000 });
      backendUp = probe.status() === 405 || probe.status() === 401;
    } catch {
      backendUp = false;
    }
    test.skip(!backendUp, 'REST backend not reachable at ' + API_URL);
    await loginAs(page);
  });

  test('client create with contact fields persists across reopen and refresh', async ({ page }) => {
    const stamp = Date.now().toString(36).toUpperCase();
    const name = `E2E Contact Client ${stamp}`;
    const code = `ECC${stamp.slice(-5)}`;
    const contactName = `E2E Producer ${stamp}`;
    const contactEmail = `e2e.${stamp.toLowerCase()}@client.vfx`;

    await page.goto('/clients/new');
    await expect(page.locator('body')).toBeVisible({ timeout: 20_000 });
    await page.getByLabel(/Studio Name/i).fill(name);
    await page.getByLabel(/Studio Identifier Code/i).fill(code);
    await page.getByLabel(/Primary Contact/i).fill(contactName);
    await page.getByLabel(/Contact Email/i).fill(contactEmail);
    await page.getByRole('button', { name: /Create Client Entity/i }).click();

    // Create lands on the client workspace; the primary email is visible.
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.locator('main')).toContainText(name, { timeout: 20_000 });
    await expect(page.locator('main')).toContainText(contactEmail, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/organizations/);

    // Reopen (fresh navigation) and refresh: contact fields persist.
    const url = page.url();
    await page.goto(url);
    await expect(page.locator('main')).toContainText(contactEmail, { timeout: 20_000 });
    await page.reload();
    await expect(page.locator('main')).toContainText(contactEmail, { timeout: 20_000 });
  });

  test('vendor create carries contact email and persists', async ({ page }) => {
    const stamp = Date.now().toString(36).toUpperCase();
    const name = `E2E Contact Vendor ${stamp}`;
    const code = `ECV${stamp.slice(-5)}`;
    const contactEmail = `e2e.${stamp.toLowerCase()}@vendor.vfx`;

    await page.goto('/vendors/new');
    await expect(page.getByRole('heading', { name: /Register New Vendor Partner/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel(/Vendor Name/i).fill(name);
    await page.getByLabel(/Vendor Code/i).fill(code);
    await page.getByLabel(/Contact Email/i).fill(contactEmail);
    await page.getByRole('button', { name: /Create Vendor Partner/i }).click();

    await page.waitForURL(/\/vendors\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.locator('main')).toContainText(name, { timeout: 20_000 });
    await expect(page.locator('main')).toContainText(contactEmail, { timeout: 20_000 });
  });

  test('another client workspace shows none of this client data', async ({ page }) => {
    const stamp = Date.now().toString(36).toUpperCase();
    const name = `E2E Isolated Client ${stamp}`;
    const code = `EIC${stamp.slice(-5)}`;
    const contactEmail = `e2e.isolated.${stamp.toLowerCase()}@client.vfx`;

    // Create client A.
    await page.goto('/clients/new');
    await page.getByLabel(/Studio Name/i).fill(name);
    await page.getByLabel(/Studio Identifier Code/i).fill(code);
    await page.getByLabel(/Contact Email/i).fill(contactEmail);
    await page.getByRole('button', { name: /Create Client Entity/i }).click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.locator('main')).toContainText(contactEmail, { timeout: 20_000 });

    // Open the seeded APEX client — none of client A's data appears.
    // The directory renders each client as a card (name in a div) with a
    // separate "Open" link; walk up to the nearest card holding the name and
    // click its "Open" link (filter({hasText}) would also match ancestors).
    await page.goto('/clients');
    const apexOpen = page
      .locator('main')
      .getByText('Apex Digital Studios', { exact: true })
      .first()
      .locator('xpath=ancestor::div[.//a[contains(@href, "/clients/")]][1]')
      .getByRole('link', { name: 'Open' });
    await expect(apexOpen).toBeVisible({ timeout: 20_000 });
    await apexOpen.click();
    await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 20_000 });
    await expect(page.locator('main')).not.toContainText(contactEmail);
    await expect(page.locator('main')).not.toContainText(name);
  });
});
