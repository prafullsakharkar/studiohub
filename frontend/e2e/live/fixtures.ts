import { test as base, expect, type BrowserContext, type Page, type Response } from '@playwright/test';
import { freshTotp, live } from '../../src/test/live/liveBackend';

export type RoleKey = keyof typeof live.users;

/** What a page did while it loaded: failures that no role should ever see. */
export interface Observed {
  /** API calls that took more than 5 s to answer, or never did. */
  slow: string[];
  serverErrors: string[];
  unauthorized: string[];
  forbidden: string[];
  pageErrors: string[];
}

/** Forward the app's relative `/api/...` calls to the live backend (the app is served from another origin). */
async function proxyToBackend(context: BrowserContext) {
  // Only paths that start with /api/ (the dev server also serves /src/api/... modules).
  await context.route((url) => url.pathname.startsWith('/api/') && url.pathname !== '/api/health', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({ response: await route.fetch({ url: `${live.url}${url.pathname}${url.search}` }) });
  });
}

export function watch(page: Page): Observed {
  const seen: Observed = { slow: [], serverErrors: [], unauthorized: [], forbidden: [], pageErrors: [] };
  const started = new Map<string, number>();
  page.on('pageerror', (error) => seen.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/')) started.set(request.url() + request.method(), Date.now());
  });
  page.on('requestfailed', (request) => {
    const begun = started.get(request.url() + request.method());
    if (begun !== undefined && Date.now() - begun > 5_000) seen.slow.push(`${request.method()} ${new URL(request.url()).pathname} failed after ${Math.round((Date.now() - begun) / 1000)}s: ${request.failure()?.errorText}`);
  });
  page.on('response', (response: Response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith('/api/')) return;
    const line = `${response.request().method()} ${url.pathname}${url.search} -> ${response.status()}`;
    const begun = started.get(response.request().url() + response.request().method());
    if (begun !== undefined && Date.now() - begun > 5_000) seen.slow.push(`${line} (${Math.round((Date.now() - begun) / 1000)}s)`);
    if (response.status() >= 500) seen.serverErrors.push(line);
    else if (response.status() === 401 && !url.pathname.includes('/auth/')) seen.unauthorized.push(line);
    else if (response.status() === 403) seen.forbidden.push(line);
  });
  return seen;
}

/** Sign in through the login page (and the MFA step for a user that has one). */
export async function signIn(page: Page, role: RoleKey) {
  const user = live.users[role];
  await page.goto('/login');
  await page.locator('#login-email-input').fill(user.email);
  await page.locator('#login-password-input').fill(user.password);
  await page.getByRole('button', { name: /sign in to workspace/i }).click();
  const secret = role === 'manager' ? live.manager.secret : role === 'mfa' ? live.mfa.secret : null;
  if (secret) {
    const code = await freshTotp(secret);
    await page.locator('#mfa-code').fill(code);
    await page.getByRole('button', { name: /verify|sign in|continue/i }).first().click();
  }
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 60_000 });
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await proxyToBackend(context);
    await use(context);
  },
});
export { expect, live };
