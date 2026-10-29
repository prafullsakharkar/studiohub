import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSample, type CapturedResponse } from '@/test/samples';
import { mockFetch } from '@/test/fetchMock';

const auth = loadSample('identity/_auth_flow.json');
const refreshOk = (access: string, refresh: string) => ({ status: 200, body: { ...(auth.refresh_ok.body as object), access, refresh } });
const refreshRevoked = { status: auth.refresh_reused_rotated.status, body: auth.refresh_reused_rotated.body };

async function freshModules() {
  vi.resetModules();
  const tokenStorage = (await import('../tokenStorage')).tokenStorage;
  const sessionRefresh = await import('../sessionRefresh');
  return { tokenStorage, ...sessionRefresh };
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('BroadcastChannel', undefined); // worst case: tabs cannot tell each other about rotations
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshAccessToken', () => {
  it('rotates both tokens and keeps the access token out of storage', async () => {
    const { tokenStorage, refreshAccessToken } = await freshModules();
    tokenStorage.setRefreshToken('r1');
    const { calls } = mockFetch(() => refreshOk('a2', 'r2'));

    await expect(refreshAccessToken(null)).resolves.toBe('a2');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/v1/auth/refresh/');
    expect(calls[0].body).toEqual({ refresh: 'r1' });
    expect(tokenStorage.getAccessToken()).toBe('a2');
    expect(localStorage.getItem('studiohub_refresh_token')).toBe('r2');
    expect(Object.values({ ...localStorage })).not.toContain('a2');
  });

  it('is single flight: concurrent callers share one request', async () => {
    const { tokenStorage, refreshAccessToken } = await freshModules();
    tokenStorage.setRefreshToken('r1');
    const { calls } = mockFetch(() => ({ ...refreshOk('a2', 'r2'), delayMs: 20 }));

    const results = await Promise.all([1, 2, 3, 4, 5].map(() => refreshAccessToken(null)));

    expect(results).toEqual(['a2', 'a2', 'a2', 'a2', 'a2']);
    expect(calls).toHaveLength(1);
  });

  it('rejects every waiter and ends the session when the refresh token is revoked', async () => {
    const { tokenStorage, refreshAccessToken } = await freshModules();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch(() => ({ ...refreshRevoked, delayMs: 10 }));

    const settled = await Promise.allSettled([refreshAccessToken('a1'), refreshAccessToken('a1'), refreshAccessToken('a1')]);

    expect(settled.map((s) => s.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect((settled[0] as PromiseRejectedResult).reason.status).toBe(401);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it.each([
    ['network failure', new TypeError('Failed to fetch')],
    ['500', { status: 500, body: { detail: 'boom' } }],
    ['429', { status: 429, body: { detail: 'Request was throttled.' }, headers: { 'Retry-After': '3' } }],
  ])('keeps the session on a transient failure (%s)', async (_label, reply) => {
    const { tokenStorage, refreshAccessToken } = await freshModules();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch(() => reply as never);

    await expect(refreshAccessToken('a1')).rejects.toBeDefined();

    expect(tokenStorage.getRefreshToken()).toBe('r1');
  });

  it('skips the network when a newer access token already arrived', async () => {
    const { tokenStorage, refreshAccessToken } = await freshModules();
    tokenStorage.setTokens({ access: 'a-new', refresh: 'r1' });
    const { calls } = mockFetch(() => refreshOk('x', 'y'));

    await expect(refreshAccessToken('a-old')).resolves.toBe('a-new');
    expect(calls).toHaveLength(0);
  });

  it('rejects as session-expired without a request when no refresh token exists', async () => {
    const { refreshAccessToken } = await freshModules();
    const { calls } = mockFetch(() => refreshOk('x', 'y'));

    await expect(refreshAccessToken(null)).rejects.toMatchObject({ status: 401, type: 'SESSION_EXPIRED' });
    expect(calls).toHaveLength(0);
  });
});

describe('two tabs racing (separate module instances, shared localStorage)', () => {
  it('never presents the same refresh token twice', async () => {
    localStorage.setItem('studiohub_refresh_token', 'r1');
    const tabA = await freshModules();
    const tabB = await freshModules();

    // Mimic the backend: a refresh token is valid once; presenting a rotated one revokes the session.
    const used = new Set<string>();
    let counter = 1;
    const { calls } = mockFetch(({ body }) => {
      const presented = (body as { refresh: string }).refresh;
      if (used.has(presented) || !/^r\d+$/.test(presented)) return refreshRevoked;
      used.add(presented);
      counter += 1;
      return { ...refreshOk(`a${counter}`, `r${counter}`), delayMs: 30 };
    });

    const results = await Promise.allSettled([tabA.refreshAccessToken(null), tabB.refreshAccessToken(null)]);

    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(calls.map((c) => (c.body as { refresh: string }).refresh)).toEqual(['r1', 'r2']);
    expect(localStorage.getItem('studiohub_refresh_token')).toBe('r3');
  });
});
