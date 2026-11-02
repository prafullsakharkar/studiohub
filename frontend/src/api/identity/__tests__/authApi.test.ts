import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { authApi } from '../auth';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_auth_flow.json');
const reset = loadSample<Record<string, Captured>>('identity/_auth_password_reset_flow.json');
// The password and logout routes answer 200 with a `detail` sentence (forgot_ok is the captured one).
const ok = { body: reset.forgot_ok.body };

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const path = (url: string) => new URL(url).pathname;

describe('authApi: every call is the route and body the backend expects', () => {
  it('login sends only the email and the password', async () => {
    const { calls } = mockFetch(() => ({ body: flow.me_admin.body }));
    await authApi.login({ email: 'a@b.c', password: 'pw', extra: 'ignored' } as never);
    expect(path(calls[0].url)).toBe('/api/v1/auth/login/');
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ email: 'a@b.c', password: 'pw' });
  });

  it('completes MFA with the challenge and the code', async () => {
    const { calls } = mockFetch(() => ({ body: {} }));
    await authApi.completeMfaLogin({ challenge: 'c', code: '123456' });
    expect(path(calls[0].url)).toBe('/api/v1/auth/mfa/challenge/');
    expect(calls[0].body).toEqual({ challenge: 'c', code: '123456' });
  });

  it('logout sends the refresh token to revoke, or an empty body without one', async () => {
    const { calls } = mockFetch(() => ok);
    await authApi.logout('r');
    await authApi.logout(null);
    expect(path(calls[0].url)).toBe('/api/v1/auth/logout/');
    expect(calls[0].body).toEqual({ refresh: 'r' });
    expect(calls[1].body).toEqual({});
  });

  it('reads and updates the profile on /me/', async () => {
    const { calls } = mockFetch(() => ({ body: flow.me_admin.body }));
    await authApi.me();
    await authApi.updateProfile({ first_name: 'Ada' } as never);
    expect(calls.map((c) => [c.method, path(c.url)])).toEqual([['GET', '/api/v1/auth/me/'], ['PATCH', '/api/v1/auth/me/']]);
    expect(calls[1].body).toEqual({ first_name: 'Ada' });
  });

  it('changes, forgets and resets the password on their own routes', async () => {
    const { calls } = mockFetch(() => ok);
    await authApi.changePassword({ old_password: 'o', new_password: 'n', confirm_password: 'n' });
    await authApi.forgotPassword('a@b.c');
    await authApi.resetPassword({ token: 't', new_password: 'n', confirm_password: 'n' });
    expect(calls.map((c) => path(c.url))).toEqual(['/api/v1/auth/change-password/', '/api/v1/auth/forgot-password/', '/api/v1/auth/reset-password/']);
    expect(calls[1].body).toEqual({ email: 'a@b.c' });
    expect(calls[2].body).toEqual({ token: 't', new_password: 'n', confirm_password: 'n' });
  });
});
