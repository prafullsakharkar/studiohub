import { expect, signIn, test, watch, type RoleKey } from './fixtures';

/**
 * Every static route, opened by deep link as each seeded role. A route a role may open must render without a
 * server error or an uncaught exception; one it may not open must end on the forbidden page. Neither case may
 * send a request that comes back 401 (the session must hold) or 5xx.
 */
export const ROUTES = [
  '/dashboard', '/workspace', '/clients', '/vendors', '/people', '/departments', '/teams', '/platform/catalog', '/positions',
  '/offices', '/settings/account/profile', '/settings/account/security', '/settings/account/sessions',
  '/settings/account/tokens', '/access/roles', '/projects', '/shots', '/assets', '/tasks', '/task-templates', '/timelogs',
  '/automations', '/media', '/playlists', '/versions', '/publishing', '/publishing/files', '/publishing/files/bulk',
  '/publishing/storage-roots', '/publishing/destinations', '/deliveries', '/deliveries/destinations', '/reviews',
  '/workflows', '/scheduling', '/scheduling/capacity', '/scheduling/resources', '/scheduling/bookings',
  '/scheduling/leaves', '/scheduling/events', '/scheduling/milestones', '/scheduling/holidays', '/scheduling/calendars',
  '/calendar', '/settings/system/values', '/settings/system/flags', '/settings/system/themes',
  '/settings/system/localizations', '/settings/system/categories', '/settings/system/definitions',
  '/settings/system/tags', '/platform/health', '/system-logs', '/platform/admin', '/audit', '/jobs', '/change-logs',
  '/error-logs', '/login-history', '/tracks', '/activity',
];

const SETTINGS_SYSTEM = ['/settings/system/values', '/settings/system/flags', '/settings/system/themes', '/settings/system/localizations', '/settings/system/categories', '/settings/system/definitions', '/settings/system/tags'];

/**
 * What each seeded role must and must not reach (the permission codes the seed gives them, checked against the
 * live backend). A route outside both lists is only required to render or be refused without a server error.
 */
const ROLES: Array<{ role: RoleKey; label: string; shown: string[]; refused: string[] }> = [
  { role: 'manager', label: 'platform administrator (superuser, MFA)', shown: ['/dashboard', '/projects', '/shots', '/deliveries', '/scheduling', '/access/roles', '/platform/health', '/system-logs', ...SETTINGS_SYSTEM], refused: [] },
  { role: 'producer', label: 'production admin', shown: ['/dashboard', '/projects', '/shots', '/deliveries', '/scheduling', '/publishing/storage-roots', '/audit', ...SETTINGS_SYSTEM], refused: ['/access/roles', '/platform/health', '/system-logs'] },
  { role: 'supervisor', label: 'vfx supervisor', shown: ['/dashboard', '/projects', '/shots', '/deliveries', '/scheduling', '/automations', '/audit'], refused: ['/access/roles', '/platform/health', ...SETTINGS_SYSTEM] },
  { role: 'lead', label: 'lead artist', shown: ['/dashboard', '/projects', '/shots', '/deliveries', '/scheduling', '/audit'], refused: ['/access/roles', '/platform/health', '/automations', ...SETTINGS_SYSTEM] },
  { role: 'artist', label: 'seeded artist', shown: ['/dashboard', '/projects', '/shots', '/deliveries', '/scheduling'], refused: ['/access/roles', '/platform/health', '/automations', '/audit', '/jobs', '/publishing/files/bulk', ...SETTINGS_SYSTEM] },
  { role: 'selfmfa', label: 'user with no role', shown: ['/dashboard', '/settings/account/profile'], refused: ['/shots', '/assets', '/tasks', '/publishing', '/deliveries', '/scheduling', '/scheduling/capacity', '/audit', '/access/roles', ...SETTINGS_SYSTEM] },
];

for (const { role, label, shown, refused: mustRefuse } of ROLES) {
  test(`${label}: every route renders or is refused, with no server error and no dropped session`, async ({ page }, testInfo) => {
    const seen = watch(page);
    const guardLines: string[] = [];
    page.on('console', (message) => {
      const text = message.text();
      if (text.includes('route_guard') || text.includes('[permissions]')) guardLines.push(text.replace(/^%c/, '').slice(0, 160));
    });
    const pending = new Map<string, string>();
    const consoleErrors: string[] = [];
    page.on('request', (request) => pending.set(request.url() + request.method(), request.url()));
    page.on('requestfinished', (request) => pending.delete(request.url() + request.method()));
    page.on('requestfailed', (request) => pending.delete(request.url() + request.method()));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 200));
    });
    await signIn(page, role);
    const outcome: Record<string, string> = {};
    const problems: string[] = [];
    const deniedCalls: Record<string, string[]> = {};
    const premount: string[] = [];
    const evidence: Record<string, string> = {};

    const reloads: string[] = [];
    const isBlank = async () => {
      const path = new URL(page.url()).pathname;
      if (path === '/forbidden' || path === '/unauthorized') return false;
      return page.evaluate(() => document.body.innerText.trim().length === 0);
    };
    // The guard shows a spinner until the signed-in user is known, then redirects or renders; a lazy page shows
    // "Loading…" while its chunk downloads. Read the outcome only when neither is on screen, and only once the app has
    // put something in #root: the dev server serves modules one after another, so the page can be quiet (network idle)
    // before React has mounted, and the spinner wait passes on an empty body.
    const settle = async (route: string) => {
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
      await page.waitForFunction(() => !/Checking route permissions|^Loading…$/m.test(document.body.innerText), undefined, { timeout: 20_000 }).catch(() => undefined);
      await page.waitForTimeout(300);
      const mounted = await page.evaluate(() => (document.getElementById('root')?.innerText ?? '').trim().length > 0);
      if (!mounted) {
        premount.push(route);
        await page.waitForFunction(() => (document.getElementById('root')?.innerText ?? '').trim().length > 0 && !/Checking route permissions|^Loading…$/m.test(document.body.innerText), undefined, { timeout: 20_000 }).catch(() => undefined);
        await page.waitForTimeout(300);
      }
    };

    for (const route of ROUTES) {
      const guardBefore = guardLines.length;
      const before = { server: seen.serverErrors.length, unauthorized: seen.unauthorized.length, pageErrors: seen.pageErrors.length, forbidden: seen.forbidden.length };
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await settle(route);
      // Chrome aborts a page's in-flight requests when the host's network changes (ERR_NETWORK_CHANGED), and the app
      // then never mounts. That says nothing about the route, so a blank page is reloaded a few times before it is
      // judged, and every reload is listed in the log so a flapping network stays visible.
      for (let attempt = 1; attempt <= 3 && (await isBlank()); attempt++) {
        reloads.push(`${route} #${attempt}: ${JSON.stringify(consoleErrors.slice(-1))}`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await settle(route);
      }
      const path = new URL(page.url()).pathname;
      const crashed = await page.getByRole('heading', { name: 'Something went wrong' }).count();
      const refused = path === '/forbidden' || path === '/unauthorized';
      const blank = !refused && path === route && (await page.evaluate(() => document.body.innerText.trim().length === 0));
      outcome[route] = refused ? 'refused' : blank ? 'blank' : path === route ? 'shown' : `-> ${path}`;
      if (blank) {
        const waiting = [...pending.values()].map((u) => u.replace(/^https?:\/\/[^/]+/, '')).slice(0, 6);
        problems.push(`${route}: the page stayed blank (the app did not render) | waiting for ${JSON.stringify(waiting)} | console errors ${JSON.stringify(consoleErrors.slice(-3))}`);
      }
      // What the page said when it was read, so a route read as shown can be told apart from one that really rendered.
      if (path === route) {
        const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 140));
        evidence[route] = `url=${page.url()} guard=${JSON.stringify(guardLines.slice(guardBefore))} text="${text}"`;
      }
      if (path === '/login') problems.push(`${route}: the session was lost (back at the login page)`);
      if (crashed) problems.push(`${route}: the error boundary caught a render error`);
      for (const line of seen.serverErrors.slice(before.server)) problems.push(`${route}: ${line}`);
      for (const line of seen.unauthorized.slice(before.unauthorized)) problems.push(`${route}: ${line}`);
      for (const line of seen.pageErrors.slice(before.pageErrors)) problems.push(`${route}: uncaught ${line}`);
      const denied = seen.forbidden.slice(before.forbidden);
      if (denied.length && !refused) {
        outcome[route] += ` (403: ${denied.length})`;
        deniedCalls[route] = denied;
        // A page the app opened for this role must not ask for what the role may not have.
        for (const line of denied) problems.push(`${route}: the page was shown but a request it made was refused: ${line}`);
      }
    }

    for (const route of shown) if (outcome[route] === undefined || !outcome[route].startsWith('shown')) problems.push(`${route}: expected to be shown, was ${outcome[route]}`);
    for (const route of mustRefuse) if (outcome[route] !== 'refused') problems.push(`${route}: expected to be refused, was ${outcome[route]}${evidence[route] ? ` | ${evidence[route]}` : ''}`);

    await testInfo.attach('route outcomes', { body: JSON.stringify(outcome, null, 1), contentType: 'application/json' });
    console.log(`\n[${role}] ${JSON.stringify(outcome)}`);
    console.log(`[${role}:403] ${JSON.stringify(deniedCalls)}`);
    console.log(`[${role}:slow] ${JSON.stringify(seen.slow)}`);
    console.log(`[${role}:premount] ${JSON.stringify(premount)}`);
    console.log(`[${role}:reloads] ${JSON.stringify(reloads)}`);
    expect(problems, problems.join('\n')).toEqual([]);
  });
}

/**
 * A phone-sized window: no page may scroll sideways, every field and button a person can reach must have a name a
 * screen reader can say, and every page has a heading. Run as the platform administrator so every route renders.
 */
test('mobile width: no sideways scroll, every field and button is named, every page has a heading', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const seen = watch(page);

  const audit = () =>
    page.evaluate(() => {
      const visible = (el: Element) => {
        const box = (el as HTMLElement).getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden';
      };
      const named = (el: Element) => {
        const input = el as HTMLInputElement;
        return Boolean(input.labels?.length || el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || el.getAttribute('placeholder'));
      };
      return {
        overflow: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
        unnamedFields: [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter((el) => visible(el) && !named(el)).map((el) => `${el.tagName.toLowerCase()}[${(el as HTMLInputElement).type}]`),
        unnamedButtons: [...document.querySelectorAll('button, [role=button]')].filter((el) => visible(el) && !(el.textContent ?? '').trim() && !named(el)).length,
        noHeading: !document.querySelector('h1, h2, [role=heading]'),
      };
    });

  // The probe itself: a page built to break every rule must be reported, or a clean result means nothing.
  await page.setContent('<input><button></button><div style="width:900px">wide</div>');
  const control = await audit();
  expect(control.overflow).toBeGreaterThan(0);
  expect(control.unnamedFields).toEqual(['input[text]']);
  expect(control.unnamedButtons).toBe(1);
  expect(control.noHeading).toBe(true);

  await signIn(page, 'manager');
  const findings: Record<string, Awaited<ReturnType<typeof audit>>> = {};
  const problems: string[] = [];
  for (const route of ROUTES) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    await page.waitForFunction(() => !/Checking route permissions|^Loading…$/m.test(document.body.innerText), undefined, { timeout: 20_000 }).catch(() => undefined);
    await page.waitForSelector('h1, h2, [role=heading]', { timeout: 10_000 }).catch(() => undefined);
    let found = await audit();
    if (found.noHeading) {
      // A list that timed out shows an error and no title; look once more before calling it a missing heading.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('h1, h2, [role=heading]', { timeout: 15_000 }).catch(() => undefined);
      found = await audit();
    }
    findings[route] = found;
    if (found.overflow > 0) problems.push(`${route}: scrolls sideways by ${found.overflow}px`);
    if (found.unnamedFields.length) problems.push(`${route}: fields without a name: ${found.unnamedFields.join(', ')}`);
    if (found.unnamedButtons) problems.push(`${route}: ${found.unnamedButtons} button(s) without a name`);
    if (found.noHeading) problems.push(`${route}: no heading`);
  }

  console.log(`[mobile:slow] ${JSON.stringify(seen.slow)}`);
  await testInfo.attach('mobile findings', { body: JSON.stringify(findings, null, 1), contentType: 'application/json' });
  expect(problems, problems.join('\n')).toEqual([]);
});
