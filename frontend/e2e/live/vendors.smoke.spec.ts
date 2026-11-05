import { freshTotp } from '../../src/test/live/liveBackend';
import { expect, live, signIn, test, watch } from './fixtures';

/**
 * A project's vendors (CR-42), through the browser against the real backend, as the production administrator:
 * pick vendors in the multi-select, a vendor deleted behind the project's back shows as unknown, an edit that leaves the
 * vendors alone does not send them (the API refuses a deleted id), removing the unknown chip sends live ids only, and
 * Clear all sends an empty list. The setup and the checks of what was stored use the API as the MFA superuser (the
 * production administrator may not create vendors).
 */
const api = async (token: string | null, method: string, path: string, body?: unknown) => {
  const res = await fetch(`${live.url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
};

test('a project’s vendors: pick, see one deleted as unknown, save without it, clear', async ({ page }) => {
  const seen = watch(page);
  const first = await api(null, 'POST', '/api/v1/auth/login/', { email: live.users.manager.email, password: live.users.manager.password });
  expect(first.body.mfa_required, JSON.stringify(first.body)).toBe(true);
  const login = await api(null, 'POST', '/api/v1/auth/mfa/challenge/', { challenge: first.body.challenge, code: await freshTotp(live.manager.secret) });
  expect(login.status, JSON.stringify(login.body)).toBe(200);
  const admin: string = login.body.tokens.access;

  const made: Record<'alpha' | 'beta', { id: string; name: string }> = {} as never;
  for (const [key, name] of [['alpha', 'Smoke Alpha Vendors'], ['beta', 'Smoke Beta Vendors']] as const) {
    const r = await api(admin, 'POST', '/api/v1/vendors/', { name, code: `${key.slice(0, 3).toUpperCase()}SMK` });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    made[key] = r.body;
  }

  let projectId: string | undefined;
  try {
    await signIn(page, 'producer');
    await page.goto('/projects/new');
    await page.getByLabel(/^Name/).fill('Smoke Vendors');
    await page.getByLabel(/^Code/).fill('SMKVND');

    // Pick two vendors, beta first, through the search box; the menu stays open between picks.
    await page.getByRole('button', { name: 'Vendors', exact: true }).click();
    await page.getByRole('combobox', { name: 'Search vendors' }).fill('Smoke');
    await page.getByRole('option', { name: made.beta.name }).click();
    await page.getByRole('option', { name: made.alpha.name }).click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('combobox', { name: 'Search vendors' }).press('Escape');
    const chips = page.getByRole('list', { name: 'Chosen vendors' }).getByRole('listitem');
    await expect(chips).toHaveText([made.beta.name, made.alpha.name]);

    const created = page.waitForRequest((r) => r.method() === 'POST' && new URL(r.url()).pathname === '/api/v1/projects/');
    await page.getByRole('button', { name: /create project/i }).click();
    expect((await created).postDataJSON().vendor_ids).toEqual([made.beta.id, made.alpha.id]);
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 20_000 });
    projectId = page.url().match(/projects\/([0-9a-f-]{36})/)?.[1];
    expect(projectId).toBeTruthy();
    const pid = projectId as string;

    const stored = await api(admin, 'GET', `/api/v1/projects/${pid}/`);
    expect(stored.body.vendor_ids).toEqual([made.beta.id, made.alpha.id]);
    expect(stored.body.vendor_names).toEqual([made.beta.name, made.alpha.name]);

    // A vendor is deleted behind the project's back: its id stays on the project, its name drops out.
    expect((await api(admin, 'DELETE', `/api/v1/vendors/${made.beta.id}/`)).status).toBe(204);
    const after = await api(admin, 'GET', `/api/v1/projects/${pid}/`);
    expect(after.body.vendor_ids).toContain(made.beta.id);
    expect(after.body.vendor_names).toEqual([made.alpha.name]);

    // A rename alone sends no vendors (re-sending the deleted id would be a 400), and returns to the project.
    await page.goto(`/projects/${pid}/edit`);
    await expect(chips).toHaveText(['Unknown vendor', made.alpha.name]);
    await expect(chips.first()).toHaveAttribute('data-unknown', 'true');
    await page.getByLabel(/^Name/).fill('Smoke Vendors 2');
    const renamed = page.waitForRequest((r) => r.method() === 'PATCH' && new URL(r.url()).pathname === `/api/v1/projects/${pid}/`);
    await page.getByRole('button', { name: /save changes/i }).click();
    expect((await renamed).postDataJSON()).toEqual({ name: 'Smoke Vendors 2' });
    await page.waitForURL(new RegExp(`/projects/${pid}$`), { timeout: 20_000 });

    // Removing the unknown chip sends live ids only, and the backend accepts them.
    await page.goto(`/projects/${pid}/edit`);
    await expect(chips).toHaveText(['Unknown vendor', made.alpha.name]);
    await page.getByRole('button', { name: 'Remove Unknown vendor' }).click();
    const fixed = page.waitForRequest((r) => r.method() === 'PATCH' && new URL(r.url()).pathname === `/api/v1/projects/${pid}/`);
    await page.getByRole('button', { name: /save changes/i }).click();
    expect((await fixed).postDataJSON()).toEqual({ vendor_ids: [made.alpha.id] });
    await page.waitForURL(new RegExp(`/projects/${pid}$`), { timeout: 20_000 });
    const end = await api(admin, 'GET', `/api/v1/projects/${pid}/`);
    expect(end.body.vendor_ids).toEqual([made.alpha.id]);
    expect(end.body.vendor_names).toEqual([made.alpha.name]);

    // Clear all sends an empty list.
    await page.goto(`/projects/${pid}/edit`);
    await expect(chips).toHaveText([made.alpha.name]);
    await page.getByRole('button', { name: 'Vendors', exact: true }).click();
    await page.getByRole('button', { name: 'Clear all' }).click();
    await page.getByRole('combobox', { name: 'Search vendors' }).press('Escape');
    const cleared = page.waitForRequest((r) => r.method() === 'PATCH' && new URL(r.url()).pathname === `/api/v1/projects/${pid}/`);
    await page.getByRole('button', { name: /save changes/i }).click();
    expect((await cleared).postDataJSON()).toEqual({ vendor_ids: [] });
    await page.waitForURL(new RegExp(`/projects/${pid}$`), { timeout: 20_000 });
    expect((await api(admin, 'GET', `/api/v1/projects/${pid}/`)).body.vendor_ids).toEqual([]);

    expect(seen.serverErrors, 'no server error while doing this').toEqual([]);
    expect(seen.pageErrors, 'no uncaught exception while doing this').toEqual([]);
    expect(seen.unauthorized, 'the session held').toEqual([]);
  } finally {
    // Leave the seeded backend as it was found for the specs that follow: archive the project, delete the vendors.
    if (projectId) await api(admin, 'DELETE', `/api/v1/projects/${projectId}/`);
    for (const vendor of Object.values(made)) await api(admin, 'DELETE', `/api/v1/vendors/${vendor.id}/`);
  }
});
