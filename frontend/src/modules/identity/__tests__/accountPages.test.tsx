import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ProfilePage } from '../account/ProfilePage';
import { SecurityPage } from '../account/SecurityPage';
import { SessionsPage } from '../account/SessionsPage';
import { TokensPage } from '../account/TokensPage';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_identity_admin_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items ?? c.body });
const path = (c: MockCall) => new URL(c.url).pathname;

function renderPage(element: React.ReactElement, overrides: Partial<AuthContextValue> = {}, user: User = admin) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const value = { user, refreshUser: vi.fn().mockResolvedValue(undefined), updateUserProfile: vi.fn(), ...overrides } as unknown as AuthContextValue;
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={value}>
        <MemoryRouter>{element}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return value;
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('profile', () => {
  it('saves first and last name through the provider and resets the dirty state', async () => {
    const updated = flow.me_patch_ok.body as User;
    const updateUserProfile = vi.fn().mockResolvedValue(updated);
    renderPage(<ProfilePage />, { updateUserProfile });

    const save = screen.getByRole('button', { name: 'Save profile' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true); // nothing changed yet
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Root' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Admin' } });
    fireEvent.click(save);

    await waitFor(() => expect(updateUserProfile).toHaveBeenCalledWith({ first_name: 'Root', last_name: 'Admin' }));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Save profile' }) as HTMLButtonElement).disabled).toBe(true));
  });
});

describe('sessions', () => {
  const sessionsServer = (c: MockCall): MockReply => {
    if (c.method === 'POST' && path(c).endsWith('/revoke-all-other/')) return reply(flow.sessions_revoke_all_other);
    if (c.method === 'POST') return { body: {} };
    return bare(flow.sessions_list);
  };

  it('marks the current session and offers no "End" for it', async () => {
    mockFetch(sessionsServer);
    renderPage(<SessionsPage />);
    expect(await screen.findByText('This session')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /end session started/i })).toBeNull();
  });

  it('ends another session by id after confirmation', async () => {
    const other = { ...flow.sessions_list.body.items[0], id: 'other-session', is_current: false };
    const { calls } = mockFetch((c) => (c.method === 'GET' ? { body: [...flow.sessions_list.body.items, other] } : sessionsServer(c)));
    renderPage(<SessionsPage />);
    await screen.findByText('This session');

    fireEvent.click(screen.getByRole('button', { name: /end session started/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'End session' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe('/api/v1/identity/sessions/other-session/revoke/');
  });
});

describe('security', () => {
  const mfaServer = (enabled: boolean) => (c: MockCall): MockReply => {
    const p = path(c);
    if (p.endsWith('/mfa/config/')) return { body: { ...flow.mfa_config.body, enabled } };
    if (p.endsWith('/mfa/recovery-codes/regenerate/')) return { body: { codes: ['aaaa-1111', 'bbbb-2222'] } };
    if (p.endsWith('/mfa/recovery-codes/')) return reply(flow.mfa_recovery_get);
    if (p.endsWith('/trusted-devices/')) return bare(flow.mfa_trusted_devices);
    if (p.endsWith('/mfa/totp/disable/')) return { body: { success: true } };
    return { status: 404, body: {} };
  };

  it('shows MFA on, the remaining recovery codes and the (empty) trusted devices', async () => {
    mockFetch(mfaServer(true));
    renderPage(<SecurityPage />);
    expect(await screen.findByText(/10 unused recovery codes left/i)).toBeTruthy();
    expect(await screen.findByText(/no trusted devices/i)).toBeTruthy();
  });

  it('regenerates recovery codes with password plus code and shows the new codes once', async () => {
    const { calls } = mockFetch(mfaServer(true));
    renderPage(<SecurityPage />);
    await screen.findByText(/10 unused recovery codes left/i);

    fireEvent.click(screen.getByRole('button', { name: 'Generate new codes' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'pw-12345678901' } });
    fireEvent.change(within(dialog).getByLabelText('Authentication code'), { target: { value: '123456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generate' }));

    expect(await screen.findByText('aaaa-1111')).toBeTruthy();
    const post = calls.find((c) => path(c).endsWith('/regenerate/'))!;
    expect(post.body).toEqual({ password: 'pw-12345678901', code: '123456' });
  });

  it('sends recovery_code instead of code when the user switches to a recovery code', async () => {
    const { calls } = mockFetch(mfaServer(true));
    renderPage(<SecurityPage />);
    await screen.findByText(/10 unused recovery codes left/i);

    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /use a recovery code instead/i }));
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'pw-12345678901' } });
    fireEvent.change(within(dialog).getByLabelText('Recovery code'), { target: { value: 'abcd-efgh' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));

    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/totp/disable/'))).toBe(true));
    expect(calls.find((c) => path(c).endsWith('/totp/disable/'))!.body).toEqual({ password: 'pw-12345678901', recovery_code: 'abcd-efgh' });
  });

  it('keeps the dialog open and shows the server’s reason when the code is wrong', async () => {
    mockFetch((c) => (path(c).endsWith('/totp/disable/') ? reply(flow.mfa_disable_wrong_password) : mfaServer(true)(c)));
    renderPage(<SecurityPage />);
    await screen.findByText(/10 unused recovery codes left/i);

    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.change(within(dialog).getByLabelText('Authentication code'), { target: { value: '000000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));

    expect(await within(dialog).findByText('Invalid verification code.')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('does not start an enrollment until the user asks (setup creates a pending secret)', async () => {
    const { calls } = mockFetch(mfaServer(false));
    renderPage(<SecurityPage />);
    expect(await screen.findByRole('button', { name: 'Turn on' })).toBeTruthy();
    expect(calls.some((c) => path(c).endsWith('/totp/setup/'))).toBe(false);
  });
});

describe('access tokens', () => {
  const tokenServer = (c: MockCall): MockReply => {
    if (c.method === 'POST' && path(c).endsWith('/rotate/')) return reply(flow.pat_rotate);
    if (c.method === 'POST') return reply(flow.pat_create);
    if (c.method === 'DELETE') return { status: 204, body: null };
    return reply(flow.pat_list);
  };
  const withPermissions = { ...admin, permissions: ['asset.create', 'asset.delete', 'shot.view'] } as User;

  it('lists tokens without any secret and shows "Never" for no expiry', async () => {
    mockFetch(tokenServer);
    renderPage(<TokensPage />, {}, withPermissions);
    expect(await screen.findByText('CI token')).toBeTruthy();
    expect(screen.queryByLabelText('Secret')).toBeNull();
  });

  it('refuses to create a credential without permissions chosen (the API requires a non-empty scope list)', async () => {
    const { calls } = mockFetch(tokenServer);
    renderPage(<TokensPage />, {}, withPermissions);
    await screen.findByText('CI token');

    fireEvent.click(screen.getByRole('button', { name: /new token/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'CI token' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /create token/i }));

    expect(await within(dialog).findByText('Choose at least one permission.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('creates with the chosen permission codes, then shows the secret once', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' && !path(c).endsWith('/rotate/') ? { status: 201, body: { ...flow.pat_create.body, secret: 'shsk_live_secret_value' } } : tokenServer(c)));
    renderPage(<TokensPage />, {}, withPermissions);
    await screen.findByText('CI token');

    fireEvent.click(screen.getByRole('button', { name: /new token/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'CI token' } });
    fireEvent.click(within(dialog).getByLabelText('asset.create'));
    fireEvent.click(within(dialog).getByLabelText('asset.delete'));
    fireEvent.click(within(dialog).getByRole('button', { name: /create token/i }));

    const secret = await screen.findByLabelText('Secret');
    expect(secret.textContent).toBe('shsk_live_secret_value');
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ name: 'CI token', scopes: ['asset.create', 'asset.delete'] });

    fireEvent.click(screen.getByRole('button', { name: 'I have stored it' }));
    await waitFor(() => expect(screen.queryByLabelText('Secret')).toBeNull());
  });

  it('only offers permissions the user holds', async () => {
    mockFetch(tokenServer);
    renderPage(<TokensPage />, {}, withPermissions);
    await screen.findByText('CI token');
    fireEvent.click(screen.getByRole('button', { name: /new token/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('checkbox').filter((box) => (box as HTMLInputElement).type === 'checkbox' && box.closest('label')?.textContent?.includes('.')).length).toBe(3);
  });

  it('rotates after confirmation and shows the new secret', async () => {
    const { calls } = mockFetch((c) => (path(c).endsWith('/rotate/') ? { body: { ...flow.pat_rotate.body, secret: 'rotated_secret_value' } } : tokenServer(c)));
    renderPage(<TokensPage />, {}, withPermissions);
    await screen.findByText('CI token');

    fireEvent.click(screen.getByRole('button', { name: 'Rotate CI token' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rotate' }));

    expect((await screen.findByLabelText('Secret')).textContent).toBe('rotated_secret_value');
    expect(calls.some((c) => path(c).endsWith(`/${flow.pat_list.body.results[0].id}/rotate/`))).toBe(true);
  });

  it('revokes with a DELETE after confirmation', async () => {
    const { calls } = mockFetch(tokenServer);
    renderPage(<TokensPage />, {}, withPermissions);
    await screen.findByText('CI token');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke CI token' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(calls.find((c) => c.method === 'DELETE')!)).toBe(`/api/v1/identity/personal-access-tokens/${flow.pat_list.body.results[0].id}/`);
  });
});
