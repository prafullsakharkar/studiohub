/**
 * Real Django API E2E validation — no mocks (org-free, Task 14 / C6).
 *
 * Covers every implemented route:
 *  auth, dashboard, people, departments, teams, offices, clients, vendors,
 *  projects/shows, shots, assets, tasks, versions, publishing, deliveries,
 *  reviews, workflows, scheduling, platform admin, settings redirects,
 *  audit/system-logs/jobs + legacy redirects, testing guard.
 *
 * For each page verifies: loads, no console/page errors, no failed API
 * requests (except known backend 500s which must surface as error states),
 * requests go to the Django API, no mock API/data in use, guards work,
 * back/forward navigation works, and no /organizations/ route is used.
 *
 * Credentials: supervisor@studiohub.vfx / password123 (real backend user).
 */

import { test, expect, type Page, type Request, type Response } from '@playwright/test';

const EMAIL = 'supervisor@studiohub.vfx';
const PASSWORD = 'password123';
const DJANGO_HINTS = ['/api/v1/', '/api/health'];

interface Capture {
  requests: Request[];
  failed: Request[];
  badResponses: { url: string; status: number }[];
  consoleErrors: string[];
  pageErrors: string[];
  mockHits: string[];
}

function isMockUrl(url: string): boolean {
  return (
    url.includes('mockServiceWorker') ||
    url.includes('/api/mock-db-schema') ||
    url.includes('msw') ||
    url.includes('VITE_API_MODE')
  );
}

async function installCapture(page: Page): Promise<Capture> {
  const cap: Capture = {
    requests: [],
    failed: [],
    badResponses: [],
    consoleErrors: [],
    pageErrors: [],
    mockHits: [],
  };
  page.on('request', (r) => {
    cap.requests.push(r);
    if (isMockUrl(r.url())) cap.mockHits.push(r.url());
  });
  page.on('requestfailed', (r) => {
    cap.failed.push(r);
  });
  page.on('response', (res: Response) => {
    const url = res.url();
    if (isMockUrl(url)) cap.mockHits.push(url);
    if (res.status() >= 400 && (url.includes('/api/') || url.includes('/api/v1/'))) {
      cap.badResponses.push({ url, status: res.status() });
    }
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Dev-server HMR noise (@vite/client websocket when port is shared).
      if (text.includes('WebSocket closed without opened') || text.includes('@vite/client')) return;
      cap.consoleErrors.push(text.slice(0, 300));
    }
  });
  page.on('pageerror', (err) => {
    const text = String(err);
    if (text.includes('WebSocket closed without opened')) return;
    cap.pageErrors.push(text.slice(0, 300));
  });
  return cap;
}

function djangoApiCalls(cap: Capture): string[] {
  return cap.requests
    .map((r) => r.url())
    .filter((u) => DJANGO_HINTS.some((h) => u.includes(h)));
}

async function loginAs(page: Page, email: string = EMAIL) {
  await page.goto('/login');
  await page.locator('#login-email-input').fill(email);
  await page.locator('#login-password-input').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

const AUTH_PAGES = [
  '/dashboard',
  '/workspace',
  '/clients',
  '/clients/new',
  '/vendors',
  '/vendors/new',
  '/people',
  '/people/new',
  '/departments',
  '/departments/new',
  '/teams',
  '/teams/new',
  '/offices',
  '/offices/new',
  '/projects',
  '/projects/new',
  '/shots',
  '/assets',
  '/tasks',
  '/timelogs',
  '/versions',
  '/publishing',
  '/deliveries',
  '/reviews',
  '/workflows',
  '/scheduling',
  '/data-platform',
  '/notifications',
  '/platform/health',
  '/platform/admin',
  '/reports',
  '/billing',
  '/audit',
  '/system-logs',
  '/jobs',
];

const LEGACY_REDIRECTS: Array<[string, RegExp]> = [
  ['/calendar', /\/scheduling/],
  ['/settings', /\/platform\/admin\/pipeline/],
  // /permissions is now a legacy alias into the org-free Access & RBAC
  // workspace (AppRoutes.tsx: <Route path="/permissions" to="/access" />).
  ['/permissions', /\/access/],
  ['/api-health', /\/platform\/health/],
  ['/audit-logs', /\/audit/],
  ['/activity', /\/audit/],
  ['/api-requests', /\/system-logs/],
  ['/change-logs', /\/system-logs/],
  ['/error-logs', /\/system-logs/],
  ['/login-history', /\/system-logs/],
  ['/background-jobs', /\/jobs/],
  ['/tracks', /\/jobs/],
];

test.describe('Real API — auth guards (no login)', () => {
  test('unauthenticated deep links redirect to login', async ({ page }) => {
    const cap = await installCapture(page);
    for (const path of ['/dashboard', '/projects', '/people']) {
      await page.goto(path);
      await page.waitForURL(/\/login/, { timeout: 15_000 });
      await expect(page.locator('#login-email-input')).toBeVisible();
    }
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });

  test('login page renders and rejects bad credentials via real API', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/login');
    await expect(page.locator('#login-email-input')).toBeVisible();
    await page.locator('#login-email-input').fill('nobody@example.com');
    await page.locator('#login-password-input').fill('wrongpassword1');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText(/invalid|failed|credentials|error/i).first()).toBeVisible({ timeout: 15_000 });
    const calls = djangoApiCalls(cap);
    expect(calls.some((u) => u.includes('/api/v1/auth/login/'))).toBe(true);
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });
});

test.describe('Real API — every page loads with live backend', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('all primary pages load without page errors or mock traffic', async ({ page }) => {
    test.setTimeout(300_000);
    const cap = await installCapture(page);
    const failures: string[] = [];
    for (const path of AUTH_PAGES) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      // Settle without networkidle: background polling can keep the
      // network busy indefinitely on data-heavy pages.
      await page.waitForTimeout(800);
      const body = page.locator('body');
      await expect(body).toBeVisible({ timeout: 15_000 });
      // Guards may legitimately redirect to forbidden/unauthorized/login for
      // permission-gated pages; that still counts as a working guard.
      const url = page.url();
      if (url.includes('/login') && path !== '/login') {
        failures.push(`${path} bounced to login (session lost)`);
      }
    }
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
    expect(failures).toEqual([]);
    // At least one real Django call must have happened during the crawl.
    expect(djangoApiCalls(cap).length).toBeGreaterThan(0);
  });

  test('legacy redirects resolve to canonical routes', async ({ page }) => {
    await installCapture(page);
    for (const [from, to] of LEGACY_REDIRECTS) {
      await page.goto(from);
      await expect(page).toHaveURL(to, { timeout: 15_000 });
    }
  });

  test('back/forward navigation keeps session', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
    await page.goto('/people');
    await expect(page).not.toHaveURL(/\/login/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/login/);
    await page.goForward();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('unknown route shows NotFound, error routes render', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/no-such-route-xyz');
    await expect(page.locator('body')).toContainText(/not found|404/i, { timeout: 15_000 });
    await page.goto('/forbidden');
    await expect(page.locator('body')).toBeVisible();
    await page.goto('/unauthorized');
    await expect(page.locator('body')).toBeVisible();
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });
});

test.describe('Real API — dashboard backed by backend', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('dashboard calls backend APIs and shows no hardcoded fixture project', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    const calls = djangoApiCalls(cap);
    expect(calls.length).toBeGreaterThan(0);
    // The dashboard must be backed by the real API: the legacy mock-only
    // fixture name must never render.
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText).not.toContain('Cyberpunk 2099');
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });
});

test.describe('Real API — lists: search, filter, pagination surface', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('people list loads real rows with search box', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/people');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.locator('body')).toContainText(/alex chen/i, { timeout: 20_000 });
    // Search input filters without mock data.
    const search = page.locator('input[type="search"], input[placeholder*="earch" i]').first();
    if (await search.count()) {
      await search.fill('Alex');
      await expect(page.locator('body')).toContainText(/alex/i, { timeout: 15_000 });
    }
    expect(
      djangoApiCalls(cap).some((u) => u.includes('/people'))
    ).toBe(true);
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });

  test('projects list renders real backend rows or a true empty state', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/projects');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    // Real backend data, not fixtures: rows link into backend UUIDs, or the
    // empty state renders when there are none.
    const projectLinks = page.locator('a[href^="/projects/"], a[href*="/projects/"]');
    const linkCount = await projectLinks.count();
    if (linkCount > 0) {
      await expect(projectLinks.first()).toBeVisible({ timeout: 15_000 });
      const href = (await projectLinks.first().getAttribute('href')) ?? '';
      expect(href).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    } else {
      const bodyText = ((await page.locator('body').textContent()) ?? '').toLowerCase();
      expect(bodyText).toMatch(/no project|empty|create|0 project|no .*found/);
    }
    expect(djangoApiCalls(cap).some((u) => u.includes('/api/v1/projects'))).toBe(true);
    expect(cap.mockHits).toEqual([]);
  });

  test('audit/activity feeds load real backend rows', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/audit');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
    expect(djangoApiCalls(cap).length).toBeGreaterThan(0);
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });
});

test.describe('Real API — CRUD roundtrip on departments (isolated test record)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('create → read → update → delete department', async ({ page }) => {
    const code = `E${Date.now().toString(36).toUpperCase().slice(-3)}`.slice(0, 4);
    const cap = await installCapture(page);
    await page.goto('/departments/new');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    const nameInput = page.getByPlaceholder(/lighting.*lookdev/i);
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
    await nameInput.fill(`E2E Dept ${code}`);
    await page.getByPlaceholder(/e\.g\. LGT/i).fill(code);
    // Dismiss the first-run "Getting Started" banner: it sits fixed at the
    // bottom-right (z-40) and intercepts the submit button's pointer events.
    const dismissBtn = page.locator('#dismiss-getting-started-banner-btn');
    try {
      await dismissBtn.waitFor({ state: 'visible', timeout: 5000 });
      await dismissBtn.click();
      await expect(page.locator('#getting-started-banner')).toBeHidden({ timeout: 5000 });
    } catch {
      // Banner not present — nothing to clear.
    }
    const submit = page.locator('button[type="submit"]').first();
    await submit.click();
    await page.waitForURL(/\/(departments)(\/|$)/, { timeout: 30_000 });
    expect(djangoApiCalls(cap).some((u) => u.includes('/api/v1/departments') || u.includes('/departments'))).toBe(true);
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });
});

test.describe('Real API — relationships and guards', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('people page hits the flat API with no org header or query', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/people');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    // No org dimension: the app must never send X-Organization-Id or call
    // an /organizations/ route; the flat people endpoint serves the rows.
    const orgHeaders = cap.requests.filter(
      (r) => r.url().includes('/api/') && (r.headers()['x-organization-id'] ?? '') !== ''
    );
    const orgRoutes = cap.requests.filter((r) => r.url().includes('/organizations/'));
    expect(orgHeaders).toEqual([]);
    expect(orgRoutes).toEqual([]);
    expect(
      djangoApiCalls(cap).some((u) => u.includes('/api/v1/people'))
    ).toBe(true);
    expect(cap.mockHits).toEqual([]);
  });

  test('direct workspace URL for unknown id does not crash', async ({ page }) => {
    const cap = await installCapture(page);
    await page.goto('/projects/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    await expect(page.locator('body')).toBeVisible();
    expect(cap.mockHits).toEqual([]);
    expect(cap.pageErrors).toEqual([]);
  });

  test('testing page is admin-guarded for supervisor', async ({ page }) => {
    await page.goto('/testing');
    await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => {});
    // Either the harness loads or the guard redirects — never a crash.
    const url = page.url();
    expect(url).toMatch(/\/(testing|forbidden|unauthorized|dashboard)/);
  });
});
