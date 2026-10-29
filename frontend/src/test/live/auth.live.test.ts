import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { live, openTab, rawPost, totp } from './liveBackend';

const admin = live.users.admin;
const REFRESH_KEY = 'studiohub_refresh_token';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

/** Counts calls to the refresh endpoint made through global fetch. */
function countRefreshCalls() {
  const real = globalThis.fetch;
  let refreshes = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.includes('/api/v1/auth/refresh/')) refreshes += 1;
    return real(input, init);
  });
  return () => refreshes;
}

describe('login (no MFA)', () => {
  it('signs in, keeps the access token out of storage, and /auth/me works with the real JWT', async () => {
    const tab = await openTab();
    const outcome = await tab.authService.login({ email: admin.email, password: admin.password });

    expect(outcome.status).toBe('authenticated');
    if (outcome.status !== 'authenticated') return;
    expect(outcome.user.email).toBe(admin.email);
    expect(outcome.user.is_superuser).toBe(true);
    expect(tab.tokenStorage.getAccessToken()).toBeTruthy();
    expect(localStorage.getItem(REFRESH_KEY)).toBeTruthy();
    expect(Object.values({ ...localStorage })).not.toContain(tab.tokenStorage.getAccessToken());

    const me = await tab.client.get<{ email: string }>('/api/v1/auth/me/');
    expect(me.email).toBe(admin.email);
  });

  it('wrong password: the server’s message, no tokens', async () => {
    const tab = await openTab();
    await expect(tab.authService.login({ email: admin.email, password: 'wrong-password' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password.',
    });
    expect(tab.tokenStorage.getAccessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('missing fields: field errors by name', async () => {
    const result = await rawPost('/api/v1/auth/login/', {});
    expect(result.status).toBe(400);
    expect(Object.keys(result.body).filter((k) => k !== 'error').sort()).toEqual(['email', 'password']);
  });
});

describe('refresh', () => {
  it('a reload/new tab (refresh token only) gets an access token first and rotates the refresh token', async () => {
    const first = await openTab();
    await first.authService.login({ email: admin.email, password: admin.password });
    const before = localStorage.getItem(REFRESH_KEY);

    const reloaded = await openTab(); // new module graph: no access token in memory
    expect(reloaded.tokenStorage.getAccessToken()).toBeNull();
    const refreshes = countRefreshCalls();
    const me = await reloaded.client.get<{ email: string }>('/api/v1/auth/me/');

    expect(me.email).toBe(admin.email);
    expect(refreshes()).toBe(1);
    expect(localStorage.getItem(REFRESH_KEY)).not.toBe(before); // rotated
  });

  it('a rejected access token (401) is refreshed once and the request retried', async () => {
    const tab = await openTab();
    await tab.authService.login({ email: admin.email, password: admin.password });
    tab.tokenStorage.setAccessToken('not-a-valid-jwt');
    const refreshes = countRefreshCalls();

    const me = await tab.client.get<{ email: string }>('/api/v1/auth/me/');

    expect(me.email).toBe(admin.email);
    expect(refreshes()).toBe(1);
  });

  it('control: the backend revokes the whole session when a rotated refresh token is presented again', async () => {
    const tab = await openTab();
    await tab.authService.login({ email: admin.email, password: admin.password });
    const old = localStorage.getItem(REFRESH_KEY)!;

    const first = await rawPost('/api/v1/auth/refresh/', { refresh: old });
    const reuse = await rawPost('/api/v1/auth/refresh/', { refresh: old });
    const newest = await rawPost('/api/v1/auth/refresh/', { refresh: first.body.refresh });

    expect(first.status).toBe(200);
    expect(reuse.status).toBe(401);
    expect(reuse.body.detail).toBe('Session has been revoked.');
    expect(newest.status).toBe(401); // even the legitimately rotated token died with the session
  });

  it('TWO TABS RACING: two tabs restoring at the same instant share one rotation and never revoke the session', async () => {
    const signIn = await openTab();
    await signIn.authService.login({ email: admin.email, password: admin.password });
    // Two tabs open/reload together: both have only the refresh token, both must refresh right now,
    // both would read the SAME token from localStorage.
    const tabA = await openTab();
    const tabB = await openTab();
    expect(tabA.tokenStorage.getAccessToken()).toBeNull();
    expect(tabB.tokenStorage.getAccessToken()).toBeNull();
    const refreshes = countRefreshCalls();

    const results = await Promise.allSettled([
      ...[1, 2, 3].map(() => tabA.client.get<{ email: string }>('/api/v1/auth/me/')),
      ...[1, 2, 3].map(() => tabB.client.get<{ email: string }>('/api/v1/auth/me/')),
    ]);

    expect(results.map((r) => (r.status === 'rejected' ? String((r.reason as Error).message) : 'ok'))).toEqual(Array(6).fill('ok'));
    expect(refreshes()).toBeLessThanOrEqual(2); // at most one per tab; the lock serializes them
    // The session is still alive afterwards: both tabs can keep working and refresh again.
    tabA.tokenStorage.setAccessToken('expired-again');
    tabB.tokenStorage.setAccessToken('expired-again');
    await expect(Promise.all([tabA.client.get('/api/v1/auth/me/'), tabB.client.get('/api/v1/auth/me/')])).resolves.toHaveLength(2);
  });

  it('many concurrent expired requests in one tab produce a single refresh', async () => {
    const tab = await openTab();
    await tab.authService.login({ email: admin.email, password: admin.password });
    tab.tokenStorage.setAccessToken('expired');
    const refreshes = countRefreshCalls();

    const results = await Promise.all(Array.from({ length: 8 }, () => tab.client.get('/api/v1/auth/me/')));

    expect(results).toHaveLength(8);
    expect(refreshes()).toBe(1);
  });
});

describe('logout and session expiry', () => {
  it('logout revokes the session: the old refresh token no longer works', async () => {
    const tab = await openTab();
    await tab.authService.login({ email: admin.email, password: admin.password });
    const refresh = localStorage.getItem(REFRESH_KEY)!;

    await tab.authService.logout();

    expect(tab.tokenStorage.getAccessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    const after = await rawPost('/api/v1/auth/refresh/', { refresh });
    expect(after.status).toBe(401);
    expect(after.body.detail).toBe('Session has been revoked.');
  });

  it('session ended elsewhere: the next call fails cleanly, tokens are cleared and listeners hear about it', async () => {
    const tab = await openTab();
    await tab.authService.login({ email: admin.email, password: admin.password });
    const events: string[] = [];
    tab.tokenStorage.subscribe((e) => events.push(e.type));

    // "Another device" signs this session out on the server.
    await rawPost('/api/v1/auth/logout/', { refresh: localStorage.getItem(REFRESH_KEY) }, { Authorization: `Bearer ${tab.tokenStorage.getAccessToken()}` });

    await expect(tab.client.get('/api/v1/auth/me/')).rejects.toMatchObject({ status: 401 });
    expect(tab.tokenStorage.getAccessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
    expect(events).toContain('cleared');
  });

  it('getCurrentUser returns null (no throw) when there is no session', async () => {
    const tab = await openTab();
    await expect(tab.authService.getCurrentUser()).resolves.toBeNull();
  });
});

describe('MFA login', () => {
  const mfa = live.users.mfa;

  it('password step returns a challenge and NO tokens', async () => {
    const tab = await openTab();
    const outcome = await tab.authService.login({ email: mfa.email, password: mfa.password });
    expect(outcome.status).toBe('mfa_required');
    expect(tab.tokenStorage.getAccessToken()).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it('a wrong code is 401 mfa_code_invalid and stays signed out', async () => {
    const tab = await openTab();
    const outcome = await tab.authService.login({ email: mfa.email, password: mfa.password });
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge');
    await expect(tab.authService.completeMfaLogin({ challenge: outcome.challenge, code: '000000' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid verification code.',
      code: 'mfa_code_invalid',
    });
    expect(tab.tokenStorage.getAccessToken()).toBeNull();
  });

  it('a garbage challenge is 401 mfa_challenge_invalid', async () => {
    const tab = await openTab();
    await expect(tab.authService.completeMfaLogin({ challenge: 'not-a-challenge', code: '123456' })).rejects.toMatchObject({
      status: 401,
      code: 'mfa_challenge_invalid',
    });
  });

  it('a valid authenticator code completes the sign-in', async () => {
    const tab = await openTab();
    const outcome = await tab.authService.login({ email: mfa.email, password: mfa.password });
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge');
    const done = await tab.authService.completeMfaLogin({ challenge: outcome.challenge, code: totp(live.mfa.secret) });

    expect(done.status).toBe('authenticated');
    expect(tab.tokenStorage.getAccessToken()).toBeTruthy();
    const me = await tab.client.get<{ email: string }>('/api/v1/auth/me/');
    expect(me.email).toBe(mfa.email);
  });

  it('a recovery code signs in once and only once', async () => {
    const code = live.mfa.recovery_codes[0];
    const first = await openTab();
    const c1 = await first.authService.login({ email: mfa.email, password: mfa.password });
    if (c1.status !== 'mfa_required') throw new Error('expected an MFA challenge');
    const done = await first.authService.completeMfaLogin({ challenge: c1.challenge, recovery_code: code });
    expect(done.status).toBe('authenticated');

    const second = await openTab();
    const c2 = await second.authService.login({ email: mfa.email, password: mfa.password });
    if (c2.status !== 'mfa_required') throw new Error('expected an MFA challenge');
    await expect(second.authService.completeMfaLogin({ challenge: c2.challenge, recovery_code: code })).rejects.toMatchObject({ status: 401 });
  });
});

describe('password recovery', () => {
  it('forgot-password answers the same for any address (no account enumeration)', async () => {
    const tab = await openTab();
    await expect(tab.authService.forgotPassword('nobody-here@example.test')).resolves.toBeUndefined();
    await expect(tab.authService.forgotPassword(admin.email)).resolves.toBeUndefined();
  });

  it('reset-password with a bad token: the server’s message', async () => {
    const tab = await openTab();
    await expect(
      tab.authService.resetPassword({ token: 'bogus', new_password: 'Brand-New-Pass-9!', confirm_password: 'Brand-New-Pass-9!' })
    ).rejects.toMatchObject({ status: 400, message: 'Invalid or expired password reset token.' });
  });
});
