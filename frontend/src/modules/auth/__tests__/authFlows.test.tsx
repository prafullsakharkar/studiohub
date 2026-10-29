import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage';
import { LoginPage } from '../pages/LoginPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';

const mfa = loadSample('identity/_auth_mfa_flow.json');
const flow = loadSample('identity/_auth_flow.json');
const reset = loadSample('identity/_auth_password_reset_flow.json');
const reply = (c: { status: number; body: unknown }) => ({ status: c.status, body: c.body });

const Where = () => <div data-testid="where">{useLocation().pathname + useLocation().search}</div>;

function renderAt(path: string, element: React.ReactElement, routePath: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

// fireEvent (already a dependency) is enough here; no user-event needed.
const type = async (label: RegExp | string, text: string) =>
  fireEvent.change(await screen.findByLabelText(label), { target: { value: text } });
const click = (element: HTMLElement) => fireEvent.click(element);

async function passwordStep() {
  await type(/work email/i, 'mfa@example.test');
  await type(/password/i, 'whatever-123');
  click(screen.getByRole('button', { name: /sign in to workspace/i }));
}

describe('login with MFA', () => {
  it('shows the second step instead of signing in, then completes with a TOTP code', async () => {
    const { calls } = mockFetch((call) =>
      call.url.endsWith('/auth/login/') ? reply(mfa.login_mfa_required) : reply(mfa.challenge_ok)
    );
    renderAt('/login', <LoginPage />, '/login');

    await passwordStep();
    expect(await screen.findByText(/two-step verification/i)).toBeTruthy();
    expect(tokenStorage.getAccessToken()).toBeNull(); // no tokens before the challenge is done

    await type(/authentication code/i, '123456');
    click(screen.getByLabelText(/trust this device/i));
    click(screen.getByRole('button', { name: /verify and sign in/i }));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/dashboard'));
    const challenge = calls.find((c) => c.url.endsWith('/auth/mfa/challenge/'))!;
    expect(challenge.body).toEqual({ challenge: '<redacted>', code: '123456', remember_device: true });
    expect(challenge.headers.get('Authorization')).toBeNull();
    expect(tokenStorage.getAccessToken()).toBe('<redacted>');
  });

  it('shows the server message for a wrong code and stays on the step', async () => {
    mockFetch((call) => (call.url.endsWith('/auth/login/') ? reply(mfa.login_mfa_required) : reply(mfa.challenge_wrong_code)));
    renderAt('/login', <LoginPage />, '/login');
    await passwordStep();
    await type(/authentication code/i, '000000');
    click(screen.getByRole('button', { name: /verify and sign in/i }));

    expect(await screen.findByText('Invalid verification code.')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('validates the code format before calling the server', async () => {
    const { calls } = mockFetch(() => reply(mfa.login_mfa_required));
    renderAt('/login', <LoginPage />, '/login');
    await passwordStep();
    await type(/authentication code/i, '12');
    click(screen.getByRole('button', { name: /verify and sign in/i }));

    expect(await screen.findByText(/6-digit code/i)).toBeTruthy();
    expect(calls.filter((c) => c.url.endsWith('/mfa/challenge/'))).toHaveLength(0);
  });

  it('accepts a recovery code', async () => {
    const { calls } = mockFetch((call) => (call.url.endsWith('/auth/login/') ? reply(mfa.login_mfa_required) : reply(mfa.challenge_recovery_ok)));
    renderAt('/login', <LoginPage />, '/login');
    await passwordStep();
    click(await screen.findByRole('button', { name: /use a recovery code/i }));
    await type(/recovery code/i, 'abcd-efgh');
    click(screen.getByRole('button', { name: /verify and sign in/i }));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/dashboard'));
    expect(calls.at(-1)!.body).toEqual({ challenge: '<redacted>', recovery_code: 'abcd-efgh', remember_device: false });
  });

  it('returns to the password step when the challenge has expired', async () => {
    mockFetch((call) => (call.url.endsWith('/auth/login/') ? reply(mfa.login_mfa_required) : reply(mfa.challenge_garbage_challenge)));
    renderAt('/login', <LoginPage />, '/login');
    await passwordStep();
    await type(/authentication code/i, '123456');
    click(screen.getByRole('button', { name: /verify and sign in/i }));

    expect(await screen.findByText(/sign-in session expired/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /sign in to workspace/i })).toBeTruthy();
  });
});

describe('login without MFA', () => {
  it('shows the backend message for a wrong password and does not navigate', async () => {
    mockFetch(() => reply(flow.login_bad_password));
    renderAt('/login', <LoginPage />, '/login');
    await passwordStep();
    expect(await screen.findByText('Invalid username or password.')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });

  it('starts with empty fields (no pre-filled demo credentials)', async () => {
    mockFetch(() => ({}));
    renderAt('/login', <LoginPage />, '/login');
    expect(((await screen.findByLabelText(/work email/i)) as HTMLInputElement).value).toBe('');
  });
});

describe('forgot password', () => {
  it('calls the real endpoint and shows the neutral confirmation', async () => {
    const { calls } = mockFetch(() => reply(reset.forgot_ok));
    renderAt('/forgot-password', <ForgotPasswordPage />, '/forgot-password');
    fireEvent.change(await screen.findByPlaceholderText(/studiohub/i), { target: { value: 'someone@example.test' } });
    click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/check your email/i)).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/api/v1/auth/forgot-password/');
    expect(calls[0].body).toEqual({ email: 'someone@example.test' });
  });

  it('shows throttling instead of a false success', async () => {
    mockFetch(() => ({ status: 429, body: { detail: 'Request was throttled.' }, headers: { 'Retry-After': '30' } }));
    renderAt('/forgot-password', <ForgotPasswordPage />, '/forgot-password');
    fireEvent.change(await screen.findByPlaceholderText(/studiohub/i), { target: { value: 'someone@example.test' } });
    click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/Try again in 30s/)).toBeTruthy();
    expect(screen.queryByText(/check your email/i)).toBeNull();
  });
});

describe('reset password', () => {
  it('submits the token from the link and shows success', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: { detail: 'Password has been reset.' } }));
    renderAt('/reset-password?token=abc123', <ResetPasswordPage />, '/reset-password');
    await type('New password', 'Brand-new-pass-9');
    await type('Confirm new password', 'Brand-new-pass-9');
    click(screen.getByRole('button', { name: /set new password/i }));

    expect(await screen.findByText(/password updated/i)).toBeTruthy();
    expect(calls[0].body).toEqual({ token: 'abc123', new_password: 'Brand-new-pass-9', confirm_password: 'Brand-new-pass-9' });
  });

  it('shows the server message for an invalid or expired token', async () => {
    mockFetch(() => reply(reset.reset_invalid_token));
    renderAt('/reset-password?token=bogus', <ResetPasswordPage />, '/reset-password');
    await type('New password', 'Brand-new-pass-9');
    await type('Confirm new password', 'Brand-new-pass-9');
    click(screen.getByRole('button', { name: /set new password/i }));

    expect(await screen.findByText('Invalid or expired password reset token.')).toBeTruthy();
    expect(screen.getByRole('link', { name: /request a new reset link/i })).toBeTruthy();
  });

  it('blocks mismatched passwords client-side and a missing token entirely', async () => {
    const { calls } = mockFetch(() => ({}));
    const { unmount } = renderAt('/reset-password?token=abc', <ResetPasswordPage />, '/reset-password');
    await type('New password', 'one-password-1');
    await type('Confirm new password', 'another-pass-2');
    click(screen.getByRole('button', { name: /set new password/i }));
    expect(await screen.findByText('Passwords do not match.')).toBeTruthy();
    expect(calls).toHaveLength(0);
    unmount();

    renderAt('/reset-password', <ResetPasswordPage />, '/reset-password');
    expect(await screen.findByText(/reset link is incomplete/i)).toBeTruthy();
  });
});
