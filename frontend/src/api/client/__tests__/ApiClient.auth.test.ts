import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSample } from '@/test/samples';
import { mockFetch } from '@/test/fetchMock';

const auth = loadSample('identity/_auth_flow.json');
const logoutFlow = loadSample('identity/_auth_logout_flow.json');
const expired = { status: 401, body: logoutFlow.me_after_logout.body };
const revoked = { status: 401, body: auth.refresh_reused_rotated.body };
const refreshed = (access: string, refresh: string) => ({ status: 200, body: { access, refresh } });

async function setup() {
  vi.resetModules();
  const { tokenStorage } = await import('@/core/auth/tokenStorage');
  const { ApiClient } = await import('../ApiClient');
  return { tokenStorage, client: new ApiClient() };
}

const bearer = (c: { headers: Headers }) => c.headers.get('Authorization');

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('BroadcastChannel', undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe('ApiClient auth handling', () => {
  it('sends the bearer token and returns the body', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(() => ({ body: { ok: true } }));

    await expect(client.get('/api/v1/departments/')).resolves.toEqual({ ok: true });
    expect(bearer(calls[0])).toBe('Bearer a1');
  });

  it('on 401 refreshes once, retries with the new token, and keeps the rotated refresh token', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch((call) => {
      if (call.url.includes('/auth/refresh/')) return refreshed('a2', 'r2');
      return bearer(call) === 'Bearer a2' ? { body: { id: 1 } } : expired;
    });

    await expect(client.get('/api/v1/auth/me/')).resolves.toEqual({ id: 1 });

    expect(calls.map((c) => `${c.method} ${new URL(c.url).pathname} ${bearer(c) ?? '-'}`)).toEqual([
      'GET /api/v1/auth/me/ Bearer a1',
      'POST /api/v1/auth/refresh/ -',
      'GET /api/v1/auth/me/ Bearer a2',
    ]);
    expect(tokenStorage.getRefreshToken()).toBe('r2');
  });

  it('refreshes only once for a burst of concurrent 401s', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch((call) => {
      if (call.url.includes('/auth/refresh/')) return { ...refreshed('a2', 'r2'), delayMs: 20 };
      return bearer(call) === 'Bearer a2' ? { body: [] } : expired;
    });

    await Promise.all([client.get('/api/v1/a/'), client.get('/api/v1/b/'), client.get('/api/v1/c/')]);

    expect(calls.filter((c) => c.url.includes('/auth/refresh/'))).toHaveLength(1);
  });

  it('rejects all queued requests (no hang) and clears the session when the refresh is rejected', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch((call) => (call.url.includes('/auth/refresh/') ? { ...revoked, delayMs: 15 } : expired));

    const outcome = await Promise.race([
      Promise.allSettled([client.get('/api/v1/a/'), client.get('/api/v1/b/'), client.get('/api/v1/c/')]),
      new Promise<'hung'>((r) => setTimeout(() => r('hung'), 2000)),
    ]);

    expect(outcome).not.toBe('hung');
    expect((outcome as PromiseSettledResult<unknown>[]).map((s) => s.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
  });

  it('exchanges the refresh token first when a reload left no access token (no wasted 401)', async () => {
    localStorage.setItem('studiohub_refresh_token', 'r1');
    const { client } = await setup();
    const { calls } = mockFetch((call) => (call.url.includes('/auth/refresh/') ? refreshed('a2', 'r2') : { body: { id: 1 } }));

    await client.get('/api/v1/auth/me/');

    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/api/v1/auth/refresh/', '/api/v1/auth/me/']);
    expect(bearer(calls[1])).toBe('Bearer a2');
  });

  it('keeps the session and surfaces a network error when the refresh cannot reach the server', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch((call) => (call.url.includes('/auth/refresh/') ? new TypeError('Failed to fetch') : expired));

    await expect(client.get('/api/v1/auth/me/')).rejects.toMatchObject({ type: 'NETWORK' });
    expect(tokenStorage.getRefreshToken()).toBe('r1');
  });

  it('login: no bearer header and no refresh attempt on a 401 (wrong password)', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'stale', refresh: 'r-stale' });
    const { calls } = mockFetch(() => ({ status: auth.login_bad_password.status, body: auth.login_bad_password.body }));

    await expect(client.post('/api/v1/auth/login/', { email: 'a@b.test', password: 'x' })).rejects.toMatchObject({
      status: 401,
      message: 'Invalid username or password.',
    });
    expect(calls).toHaveLength(1);
    expect(bearer(calls[0])).toBeNull();
  });

  it('does not refresh for non-auth errors', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(() => ({ status: 403, body: { detail: 'You do not have permission to perform this action.' } }));

    await expect(client.get('/api/v1/departments/')).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(1);
  });

  it('requests canonical paths: slash added, slash-less families untouched', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(() => ({ body: {} }));

    await client.get('/api/v1/departments?page=2');
    await client.get('/api/v1/platform/master-data/software');
    await client.post('/api/v1/tasks/abc/bulk-assign', {});

    expect(calls.map((c) => new URL(c.url).pathname + new URL(c.url).search)).toEqual([
      '/api/v1/departments/?page=2',
      '/api/v1/platform/master-data/software',
      '/api/v1/tasks/abc/bulk-assign/',
    ]);
  });

  it('sends a JSON body on DELETE when asked (RBAC revoke endpoints need one)', async () => {
    const { tokenStorage, client } = await setup();
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(() => ({ body: { detail: 'Permission revoked.' } }));

    await client.delete('/api/v1/roles/r1/permissions/', { json: { permission_id: 'p1' } });

    expect(calls[0].method).toBe('DELETE');
    expect(calls[0].body).toEqual({ permission_id: 'p1' });
  });
});
