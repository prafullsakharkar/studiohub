import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { ChangePasswordPage } from '@/modules/auth/pages/ChangePasswordPage';
import { MfaSetupPage } from '@/modules/auth/pages/MfaSetupPage';
import { AuthenticatedRoute } from '@/routes/AuthenticatedRoute';
import { live } from './liveBackend';

/**
 * The first sign-in of the account `manage.py bootstrap` creates, against a REAL backend: a superuser who owes a password change AND
 * MFA enrollment. The login answers `mfa_enrollment_required` while the user also has `must_change_password`; the route guard used to
 * send such an account back and forth between the two screens without end ("Maximum update depth exceeded", an error page). Password
 * first, then MFA. Run on a fresh live_backend.py seed.
 */
const T = { timeout: 20000 };
const NEW_PASSWORD = 'Live-Bootstrap-NewPass!42';
const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.restoreAllMocks();
});

/** The login page of the app, reduced to what matters: signing in through the provider (which keeps the login's restriction flag). */
const SignIn: React.FC<{ password: string }> = ({ password }) => {
  const { login } = useAuth();
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        void login({ email: live.users.bootstrap.email, password }).then(() => navigate('/dashboard', { replace: true }));
      }}
    >
      sign in
    </button>
  );
};

const app = (initial: string, password: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<SignIn password={password} />} />
          <Route element={<AuthenticatedRoute />}>
            <Route path="/dashboard" element={<Where />} />
            <Route path="/auth/change-password" element={<ChangePasswordPage />} />
            <Route path="/auth/mfa-setup" element={<MfaSetupPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

describe('the bootstrap admin’s first sign-in', () => {
  it('lands on the password screen and stays there, changes the password, signs in again and is asked to enrol MFA', async () => {
    // Sign in with the temporary password, the way the login page does.
    const first = render(app('/login', live.users.bootstrap.password));
    fireEvent.click(await screen.findByRole('button', { name: 'sign in' }, T));
    expect(await screen.findByText('Change your password', {}, T)).toBeTruthy();
    // The guard used to send this account to the MFA screen and back for ever (an error page); it stays.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(screen.getByText('Change your password')).toBeTruthy();
    expect(screen.queryByText(/Set up two-factor authentication/i)).toBeNull();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: live.users.bootstrap.password } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: NEW_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: NEW_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    // CR-39: the server used to refuse this (403 mfa_enrollment_required) because the account also owes MFA. Every session ended,
    // so the tokens are forgotten and the app goes back to sign-in.
    await waitFor(() => expect(tokenStorage.getAccessToken()).toBeNull(), T);
    first.unmount();

    // Signing in again with the new password owes MFA enrollment only: straight to the enrollment screen, QR code included.
    render(app('/login', NEW_PASSWORD));
    fireEvent.click(await screen.findByRole('button', { name: 'sign in' }, T));
    expect(await screen.findByText(/Set up two-factor authentication/i, {}, T)).toBeTruthy();
    expect(await screen.findByAltText(/QR code/i, {}, T)).toBeTruthy();
  }, 90000);
});
