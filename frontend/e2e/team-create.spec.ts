/**
 * E2E: create a Team ("Modeling Beta") through the actual StudioHub UI —
 * strictly human-like, no seed/API shortcuts. Org-free: no org switcher,
 * no org workspace; the flat /teams/new form picks a Parent Department from
 * the platform directory and lands on the team workspace.
 *
 * Pre-req: Django backend up on :8000 (seeded for e2e) and the frontend dev
 * server running (Vite on :3100 serves the app, /api proxies to Django).
 */

import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'admin@studiohub.vfx';
const PASSWORD = 'password123';
const RUN = `${Date.now().toString(36).toUpperCase().slice(-5)}`;

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/username|email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test('human-like create Team "Modeling Beta" with a directory parent department', async ({
  page,
  request,
}) => {
  let backendUp = false;
  try {
    const probe = await request.get(`${process.env.VITE_API_URL || 'http://127.0.0.1:8000'}/api/v1/auth/login/`, { timeout: 5_000 });
    backendUp = probe.status() === 405 || probe.status() === 401;
  } catch {
    backendUp = false;
  }
  test.skip(!backendUp, 'REST backend not reachable');

  page.on('pageerror', (e) => console.error('[pageerror]', e.message));

  const squadName = `Modeling Beta ${RUN}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const squadCode = `MODL-${RUN}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  await login(page);

  await page.goto('/teams/new');
  await expect(
    page.getByRole('heading', { name: /Assemble Team Strike Squad/i })
  ).toBeVisible({ timeout: 20_000 });

  // Required fields: name + code are plain text inputs.
  await page.getByPlaceholder(/Hero Creature Pod/i).fill(squadName);
  await page.getByPlaceholder(/CR-POD/i).fill(squadCode);

  // Parent Department: the seeded platform directory (init_platform) feeds
  // the first combobox — pick the Editorial option by its rendered label.
  // Note: native <option> elements are never "visible" to Playwright until the
  // select is open, so assert presence + select by value instead.
  const deptSelect = page.getByRole('combobox').first();
  const editorialOption = deptSelect.locator('option', { hasText: 'Editorial' }).first();
  await expect(editorialOption).toHaveCount(1, { timeout: 15_000 });
  const editorialValue = await editorialOption.getAttribute('value');
  expect(editorialValue, 'Editorial option has a value').toBeTruthy();
  await deptSelect.selectOption(editorialValue as string);

  // Submit — lands on the new team's workspace with the name in the header.
  // The first-run "Getting Started" banner sits fixed bottom-right and
  // intercepts the submit button; dismiss it first like a user would.
  const dismissBanner = page.locator('#dismiss-getting-started-banner-btn');
  if ((await dismissBanner.count()) > 0) {
    await dismissBanner.click();
  }
  const submitBtn = page.getByRole('button', { name: /^Assemble Squad$/i });
  await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
  await submitBtn.click();
  await page.waitForURL(/\/teams\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await expect(page.locator('main')).toContainText(squadName, { timeout: 20_000 });
  await expect(page).not.toHaveURL(/organizations/);

  // The team list shows the new squad.
  await page.goto('/teams');
  await expect(page.locator('main')).toContainText(squadName, { timeout: 20_000 });
});
