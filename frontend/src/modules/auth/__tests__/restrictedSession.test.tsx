import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue, Restriction } from '@/core/auth/AuthContext';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { centralErrorHandler } from '@/core/api/error-handler';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { AuthenticatedRoute } from '@/routes/AuthenticatedRoute';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';
import { MfaSetupPage } from '../pages/MfaSetupPage';

const flow = loadSample('identity/_restricted_sessions_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const reply = (c: { status: number; body: unknown }): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

beforeEach(() => {
  localStorage.clear();
  useNotificationStore.setState({ notifications: [] } as never);
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('error classification (real responses)', () => {
  it('a wrong current password (401 invalid_credentials) is not a lost session', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(() => reply(flow.change_password_wrong_old));
    const sessionLost = vi.fn();
    const off = centralErrorHandler.onAuthExpired(sessionLost);

    await expect(apiClient.post('/api/v1/auth/change-password/', { old_password: 'x' })).rejects.toMatchObject({
      status: 401,
      type: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.',
    });

    off();
    expect(calls).toHaveLength(1); // no refresh dance
    expect(sessionLost).not.toHaveBeenCalled();
    expect(tokenStorage.getAccessToken()).toBe('a1'); // still signed in
    expect((useNotificationStore.getState() as unknown as { notifications: unknown[] }).notifications).toHaveLength(0);
  });

  it('a wrong password on the login page (401) neither signs out nor toasts "session expired"', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch(() => reply(auth.login_bad_password));
    const sessionLost = vi.fn();
    const off = centralErrorHandler.onAuthExpired(sessionLost);

    await expect(apiClient.post('/api/v1/auth/login/', { email: 'a@b.test', password: 'x' })).rejects.toMatchObject({ status: 401 });

    off();
    expect(sessionLost).not.toHaveBeenCalled();
    expect((useNotificationStore.getState() as unknown as { notifications: unknown[] }).notifications).toHaveLength(0);
  });

  it('a restricted-session 403 carries the stable code and tells listeners what is owed', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch(() => reply(flow.restricted_list_departments));
    const owed = vi.fn();
    const off = centralErrorHandler.onSessionRestricted(owed);

    await expect(apiClient.get('/api/v1/departments/')).rejects.toMatchObject({ status: 403, type: 'RESTRICTED_SESSION', code: 'mfa_enrollment_required', requiredAction: 'mfa_enrollment' });

    off();
    expect(owed).toHaveBeenCalledTimes(1);
    expect((useNotificationStore.getState() as unknown as { notifications: unknown[] }).notifications).toHaveLength(0); // routed, not toasted
  });

  it('password_change_required maps to the password action', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch(() => reply(flow.password_restricted_list_departments));
    await expect(apiClient.get('/api/v1/departments/')).rejects.toMatchObject({ requiredAction: 'password_change' });
  });
});

describe('AuthenticatedRoute', () => {
  const user = { id: 'u', email: 'u@x.test', is_active: true, permissions: [], project_memberships: [] } as unknown as User;
  const renderAt = (restriction: Restriction | null, at = '/dashboard') =>
    render(
      <AuthContext.Provider value={{ user, isAuthenticated: true, isLoading: false, restriction } as AuthContextValue}>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route element={<AuthenticatedRoute />}>
              <Route path="/dashboard" element={<div>dashboard</div>} />
              <Route path="/auth/mfa-setup" element={<Where />} />
              <Route path="/auth/change-password" element={<Where />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

  it('lets an unrestricted session through', () => {
    renderAt(null);
    expect(screen.getByText('dashboard')).toBeTruthy();
  });

  it('sends an MFA-owing session to enrollment, and a password-owing one to the password screen', () => {
    renderAt('mfa_enrollment');
    expect(screen.getByTestId('where').textContent).toBe('/auth/mfa-setup');
    cleanup();
    renderAt('password_change');
    expect(screen.getByTestId('where').textContent).toBe('/auth/change-password');
  });
});

describe('MFA setup page (real enrollment responses)', () => {
  const renderSetup = () => {
    const client = new QueryClient();
    const ctx = { user: null, logout: vi.fn(), clearRestriction: vi.fn(), refreshUser: vi.fn(async () => undefined) } as unknown as AuthContextValue;
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={ctx}>
          <MemoryRouter initialEntries={['/auth/mfa-setup']}>
            <Routes>
              <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />
              <Route path="*" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    return ctx;
  };
  const server = (enable: MockReply) => (call: MockCall): MockReply => (path(call).endsWith('/totp/setup/') ? reply(flow.totp_setup) : enable);

  it('shows the QR code and key, rejects a malformed code locally', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(server(reply(flow.totp_enable_ok)));
    renderSetup();

    expect(await screen.findByAltText(/QR code/i)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /turn on two-factor/i }));
    expect(await screen.findByText(/6-digit code/i)).toBeTruthy();
    expect(calls.some((c) => path(c).endsWith('/totp/enable/'))).toBe(false);
  });

  it('a wrong code shows the server message and stays on the form', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch(server(reply(flow.totp_enable_wrong_code)));
    renderSetup();
    await screen.findByAltText(/QR code/i);
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /turn on two-factor/i }));

    expect(await screen.findByText('Invalid verification code.')).toBeTruthy();
    expect(screen.queryByLabelText('Recovery codes')).toBeNull();
  });

  it('success shows the recovery codes once; Continue needs the "saved" tick, then clears the restriction', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch(server(reply(flow.totp_enable_ok)));
    const ctx = renderSetup();
    await screen.findByAltText(/QR code/i);
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /turn on two-factor/i }));

    const list = await screen.findByLabelText('Recovery codes');
    expect(list.querySelectorAll('li').length).toBe((flow.totp_enable_ok.body as { recovery_codes: unknown[] }).recovery_codes.length);
    expect(calls.find((c) => path(c).endsWith('/totp/enable/'))!.body).toEqual({ code: '123456' }); // only the code; the server uses its own secret

    const cont = screen.getByRole('button', { name: /continue to studiohub/i }) as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(/i have saved/i));
    fireEvent.click(cont);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/dashboard'));
    expect(ctx.clearRestriction).toHaveBeenCalled();
  });
});

describe('end to end with the real provider: a normal page hits the real 403', () => {
  it('redirects to enrollment on the first restricted response, even after a reload (no flag in /auth/me)', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch((call) => {
      const p = path(call);
      if (p.endsWith('/auth/me/')) return reply(flow.restricted_me);
      if (p.endsWith('/departments/')) return reply(flow.restricted_list_departments);
      if (p.endsWith('/totp/setup/')) return reply(flow.totp_setup);
      return { body: {} };
    });
    const Departments = () => {
      const [state, setState] = React.useState('loading');
      React.useEffect(() => {
        apiClient.get('/api/v1/departments/').then(() => setState('ok'), () => setState('failed'));
      }, []);
      return <div>departments: {state}</div>;
    };
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/departments']}>
          <AuthProvider>
            <Routes>
              <Route element={<AuthenticatedRoute />}>
                <Route path="/departments" element={<Departments />} />
                <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />
              </Route>
              <Route path="/login" element={<div>login page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/Set up two-factor authentication/i)).toBeTruthy();
    expect(screen.queryByText(/login page/)).toBeNull(); // not logged out
    expect(await screen.findByAltText(/QR code/i)).toBeTruthy();
  });
});

describe('change password (real responses)', () => {
  const renderChange = () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={['/auth/change-password']}>
            <Routes>
              <Route path="/auth/change-password" element={<ChangePasswordPage />} />
              <Route path="*" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );
  };
  const fillAll = (oldP: string, newP: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: oldP } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: newP } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
  };
  const me = (call: MockCall) => (path(call).endsWith('/auth/me/') ? reply(flow.restricted_me) : null);

  it('checks the confirmation itself (the backend does not) before any request', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch((c) => me(c) ?? { body: {} });
    renderChange();
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/auth/me/'))).toBe(true));
    fillAll('Temp-Pass-123!', 'Brand-New-Pass-9!', 'something-else');

    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();
    expect(calls.some((c) => path(c).endsWith('/change-password/'))).toBe(false);
  });

  it('shows every backend policy reason inline for a weak password, and stays signed in', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    mockFetch((c) => me(c) ?? reply(flow.change_password_weak));
    renderChange();
    await screen.findByLabelText('New password');
    fillAll('Temp-Pass-123!', '123', '123');

    expect(await screen.findByText(/at least 12 characters.*too common.*entirely numeric/s)).toBeTruthy();
    expect(tokenStorage.getRefreshToken()).toBe('r1');
  });

  it('a wrong current password is a form error, NOT a sign-out', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch((c) => me(c) ?? reply(flow.change_password_wrong_old));
    renderChange();
    await screen.findByLabelText('New password');
    fillAll('wrong-old-pass', 'Brand-New-Pass-9!', 'Brand-New-Pass-9!');

    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
    expect(tokenStorage.getRefreshToken()).toBe('r1');
    expect(screen.queryByTestId('where')).toBeNull(); // still on the form
    expect(calls.filter((c) => path(c).endsWith('/auth/refresh/'))).toHaveLength(0);
  });

  it('success: forgets the (already revoked) tokens locally, no logout call, back to sign-in', async () => {
    tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
    const { calls } = mockFetch((c) => me(c) ?? reply(flow.change_password_ok));
    renderChange();
    await screen.findByLabelText('New password');
    fillAll('Temp-Pass-123!', 'Brand-New-Pass-9!', 'Brand-New-Pass-9!');

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/login'));
    expect(tokenStorage.getAccessToken()).toBeNull();
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect(calls.some((c) => path(c).endsWith('/auth/logout/'))).toBe(false); // would 401 on a dead session
  });
});
