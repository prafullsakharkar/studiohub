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
  it('lands on the password screen and STAYS there (no bounce between the two screens), and shows what the server says', async () => {
    render(app('/login', live.users.bootstrap.password));
    fireEvent.click(await screen.findByRole('button', { name: 'sign in' }, T));
    expect(await screen.findByText('Change your password', {}, T)).toBeTruthy();
    // The guard used to send this account to the MFA screen and back for ever (an error page); it now stays.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(screen.getByText('Change your password')).toBeTruthy();
    expect(screen.queryByText(/Set up two-factor authentication/i)).toBeNull();

    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: live.users.bootstrap.password } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: NEW_PASSWORD } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: NEW_PASSWORD } });
    fireEvent.click(screen.getByRole('button', { name: /change password/i }));
    // CR-39 (docs/sync/backend-change-requests.md): today the SERVER refuses the password change of an account that also owes MFA
    // enrollment, and refuses the MFA endpoints while a password change is owed, so this account cannot leave either screen. The
    // test pins what is true now (the page stays and says why); when CR-39 is applied it becomes the full flow: change the password,
    // sign in again, enrol MFA.
    await waitFor(() => expect(screen.getAllByRole('alert').map((a) => a.textContent).join(' ')).toContain('Set up two-factor authentication before continuing.'), T);
    expect(tokenStorage.getAccessToken()).toBeTruthy(); // still signed in (restricted); nothing was changed
    expect(screen.getByText('Change your password')).toBeTruthy();
  }, 60000);
});
