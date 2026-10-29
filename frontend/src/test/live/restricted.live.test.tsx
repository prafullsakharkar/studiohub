import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { centralErrorHandler } from '@/core/api/error-handler';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { authService } from '@/modules/auth/services/AuthService';
import { ChangePasswordPage } from '@/modules/auth/pages/ChangePasswordPage';
import { MfaSetupPage } from '@/modules/auth/pages/MfaSetupPage';
import { AuthenticatedRoute } from '@/routes/AuthenticatedRoute';
import { freshTotp, live, rawPost, totp } from './liveBackend';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.restoreAllMocks();
});

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

describe('a privileged user who has not enrolled in MFA (real backend rule)', () => {
  it('can sign in and read /auth/me, but every other endpoint is 403 mfa_enrollment_required', async () => {
    const owed = vi.fn();
    const off = centralErrorHandler.onSessionRestricted(owed);
    const outcome = await authService.login({ email: live.users.admin.email, password: live.users.admin.password });

    expect(outcome).toMatchObject({ status: 'authenticated', mfaEnrollmentRequired: true });
    await expect(apiClient.get('/api/v1/auth/me/')).resolves.toBeTruthy();
    await expect(apiClient.get('/api/v1/identity/mfa/config/')).resolves.toMatchObject({ enabled: false });
    await expect(apiClient.get('/api/v1/departments/')).rejects.toMatchObject({
      status: 403,
      type: 'RESTRICTED_SESSION',
      code: 'mfa_enrollment_required',
      requiredAction: 'mfa_enrollment',
    });
    off();
    expect(owed).toHaveBeenCalled();
    expect(tokenStorage.getRefreshToken()).toBeTruthy(); // restricted is not signed out
  });
});

describe('MFA enrollment, end to end through the real pages and the real server', () => {
  it('reload-proof redirect → QR + key → code from the key → recovery codes → the app works', async () => {
    // Step 0: the user signed in earlier; the page now loads with only a refresh token (no login flag).
    const first = await rawPost('/api/v1/auth/login/', { email: live.users.enroll.email, password: live.users.enroll.password });
    expect(first.body.mfa_enrollment_required).toBe(true);
    localStorage.setItem('studiohub_refresh_token', first.body.tokens.refresh);

    const Departments = () => {
      const [state, setState] = React.useState('loading');
      React.useEffect(() => {
        apiClient.get<{ count: number }>('/api/v1/departments/').then((r) => setState(`ok:${r.count}`), (e) => setState(`failed:${e.code}`));
      }, []);
      return <div>departments {state}</div>;
    };
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/departments']}>
          <AuthProvider>
            <Routes>
              <Route element={<AuthenticatedRoute />}>
                <Route path="/departments" element={<Departments />} />
                <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />
                <Route path="/dashboard" element={<Where />} />
              </Route>
              <Route path="/login" element={<div>login page</div>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // The first real 403 sends the user to enrollment; they are NOT logged out.
    expect(await screen.findByText(/Set up two-factor authentication/i, {}, { timeout: 10000 })).toBeTruthy();
    expect(screen.queryByText('login page')).toBeNull();

    // The real QR code and key from the server.
    const qr = (await screen.findByAltText(/QR code/i)) as HTMLImageElement;
    expect(qr.src).toMatch(/^data:image\/png;base64,/);
    const secret = (await screen.findByText(/^[A-Z2-7]{32}$/)).textContent!;

    // A wrong code is rejected with the server's message.
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /turn on two-factor/i }));
    expect(await screen.findByText('Invalid verification code.')).toBeTruthy();

    // The real code computed from the displayed key activates MFA.
    fireEvent.change(screen.getByLabelText(/authentication code/i), { target: { value: totp(secret) } });
    fireEvent.click(screen.getByRole('button', { name: /turn on two-factor/i }));
    const codes = await screen.findByLabelText('Recovery codes');
    expect(codes.querySelectorAll('li').length).toBe(10);
    expect(codes.textContent).toMatch(/[a-z0-9]{4,}/i);

    // Continue is gated on acknowledging the codes, then the restriction is lifted for real.
    fireEvent.click(screen.getByLabelText(/i have saved/i));
    fireEvent.click(screen.getByRole('button', { name: /continue to studiohub/i }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/dashboard'));
    await expect(apiClient.get('/api/v1/departments/')).resolves.toMatchObject({ count: expect.any(Number) });
    await expect(apiClient.get('/api/v1/identity/mfa/config/')).resolves.toMatchObject({ enabled: true });
  }, 40000);
});

describe('a user who owes a password change (real backend rule)', () => {
  const pw = live.users.pwdue;
  const NEW_PASSWORD = 'Live-Pwdue-NewPass!42';

  const renderChange = () =>
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/auth/change-password']}>
          <AuthProvider>
            <Routes>
              <Route element={<AuthenticatedRoute />}>
                <Route path="/auth/change-password" element={<ChangePasswordPage />} />
              </Route>
              <Route path="/login" element={<Where />} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );

  const fill = (oldP: string, newP: string, confirm: string) => {
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: oldP } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: newP } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
  };

  it('is blocked everywhere else until the password is changed, then signs in with the new one', async () => {
    const first = await rawPost('/api/v1/auth/login/', { email: pw.email, password: pw.password });
    expect(first.body.user.must_change_password).toBe(true);
    const oldRefresh = first.body.tokens.refresh as string;
    localStorage.setItem('studiohub_refresh_token', oldRefresh);

    const blocked = await rawPost('/api/v1/departments/', {}, { Authorization: `Bearer ${first.body.tokens.access}` });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('password_change_required');

    renderChange();
    await screen.findByLabelText('New password', {}, { timeout: 10000 });

    // Wrong current password: a form error, the user stays signed in (this used to log them out).
    fill('definitely-wrong-1', NEW_PASSWORD, NEW_PASSWORD);
    expect(await screen.findByText('Invalid email or password.')).toBeTruthy();
    expect(tokenStorage.getRefreshToken()).toBeTruthy();

    // Weak password: every policy reason from the server, inline.
    fill(pw.password, '123', '123');
    expect(await screen.findByText(/at least 12 characters/)).toBeTruthy();

    // Mismatch is caught client-side (the backend would accept it).
    fill(pw.password, NEW_PASSWORD, 'typo');
    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();

    // Success ends every session: tokens forgotten locally, back to sign-in, old refresh token dead.
    fill(pw.password, NEW_PASSWORD, NEW_PASSWORD);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/login'));
    expect(tokenStorage.getRefreshToken()).toBeNull();
    expect((await rawPost('/api/v1/auth/refresh/', { refresh: oldRefresh })).status).toBe(401);

    // The new password works and the restriction is gone.
    const outcome = await authService.login({ email: pw.email, password: NEW_PASSWORD });
    expect(outcome).toMatchObject({ status: 'authenticated', user: { must_change_password: false } });
    await expect(apiClient.get('/api/v1/departments/')).resolves.toMatchObject({ count: expect.any(Number) });
  }, 40000);
});

describe('credential failures are not lost sessions (real backend)', () => {
  it('a wrong current password on change-password keeps the session alive', async () => {
    const outcome = await authService.login({ email: live.users.artist.email, password: live.users.artist.password });
    expect(outcome.status).toBe('authenticated');
    await expect(authService.changePassword({ old_password: 'nope-nope-12', new_password: 'Another-Pass-99!', confirm_password: 'Another-Pass-99!' })).rejects.toMatchObject({
      status: 401,
      type: 'INVALID_CREDENTIALS',
    });
    await expect(apiClient.get('/api/v1/auth/me/')).resolves.toMatchObject({ email: live.users.artist.email });
    expect(await freshTotp(live.manager.secret)).toMatch(/^\d{6}$/);
  });
});
