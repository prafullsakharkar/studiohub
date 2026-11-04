import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { SystemNav } from '@/modules/settings';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { AccountSection } from '../components/AccountSection';
import { DirectorySettingsPage } from '../pages/DirectorySettingsPage';

// CR-40: every reply below was captured from the backend (docs/sync/tools/test_capture_directory.py).
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_directory_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
const admin = withCodes('identity.directory.manage', 'settings.view', 'settings.manage');

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const writes = (calls: MockCall[]) => calls.filter((c) => c.method !== 'GET');

const DIRECTORY = '/api/v1/identity/directory/';
/** The saved connection (as `get_without_key` shows it, with the key back): a password set, tested, on. */
const configured = { ...flow.get_without_key.body, encryption_key_set: true };

function renderWith(user: User, ui: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const change = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('directory (LDAP) settings page', () => {
  it('shows the saved settings; the password is never shown, only whether one is set', async () => {
    mockFetch(() => ({ body: configured }));
    renderWith(admin, <DirectorySettingsPage />);
    expect(((await screen.findByLabelText('Server')) as HTMLInputElement).value).toBe('ldaps://ldap.example.test');
    expect((screen.getByLabelText('Service account password') as HTMLInputElement).value).toBe('');
    expect(screen.getByText(/A password is set/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Directory sign-in' })).getByText('On')).toBeTruthy();
  });

  it('saves the connection with the typed password; an untouched password field leaves it out (kept)', async () => {
    const { calls } = mockFetch((call) => (call.method === 'PATCH' ? reply(flow.patch_connection) : reply(flow.get_initial)));
    renderWith(admin, <DirectorySettingsPage />);
    await screen.findByLabelText('Server');
    change('Server', 'ldaps://ldap.example.test');
    change('Service account DN', 'cn=svc,dc=studio,dc=test');
    change('Service account password', 'service-secret');
    change('Search base', 'ou=people,dc=studio,dc=test');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await screen.findByText(/A password is set/);
    const [first] = writes(calls);
    expect(path(first)).toBe(DIRECTORY);
    expect(first.body).toMatchObject({ server_uri: 'ldaps://ldap.example.test', bind_dn: 'cn=svc,dc=studio,dc=test', bind_password: 'service-secret', user_search_base: 'ou=people,dc=studio,dc=test' });
    expect(first.body).not.toHaveProperty('enabled');
    expect(first.body).not.toHaveProperty('clear_bind_password');

    // Saved again without typing: the password key is absent, so the server keeps the stored one.
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(2));
    expect(writes(calls)[1].body).not.toHaveProperty('bind_password');
  });

  it('"Remove the stored password" sends an empty password', async () => {
    const { calls } = mockFetch((call) => (call.method === 'PATCH' ? { body: { ...configured, bind_password_set: false } } : { body: configured }));
    renderWith(admin, <DirectorySettingsPage />);
    fireEvent.click(await screen.findByLabelText('Remove the stored password'));
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ bind_password: '' });
  });

  it('puts the server’s field errors on the fields (plain ldap:// without StartTLS, a filter without {username})', async () => {
    mockFetch((call) => (call.method === 'PATCH' ? reply(flow.patch_plain_ldap) : reply(flow.get_initial)));
    renderWith(admin, <DirectorySettingsPage />);
    await screen.findByLabelText('Server');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(flow.patch_plain_ldap.body.start_tls[0])).toBeTruthy();
    cleanup();
    mockFetch((call) => (call.method === 'PATCH' ? reply(flow.patch_bad_filter) : reply(flow.get_initial)));
    renderWith(admin, <DirectorySettingsPage />);
    await screen.findByLabelText('Server');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText('The filter must contain {username}.')).toBeTruthy();
  });

  it('saves the older-TLS options (CR-41): older RSA ciphers and the certificate name', async () => {
    const { calls } = mockFetch((call) => (call.method === 'PATCH' ? reply(flow.patch_tls_options) : reply(flow.get_initial)));
    renderWith(admin, <DirectorySettingsPage />);
    const ciphers = (await screen.findByLabelText('Allow older RSA ciphers (no forward secrecy)')) as HTMLInputElement;
    expect(ciphers.checked).toBe(false);
    expect((screen.getByLabelText('Certificate name') as HTMLInputElement).value).toBe('');
    fireEvent.click(ciphers);
    change('Certificate name', 'ldap');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ tls_allow_legacy_ciphers: true, tls_server_name: 'ldap' });
    await waitFor(() => expect((screen.getByLabelText('Certificate name') as HTMLInputElement).value).toBe('ldap'));
    expect((screen.getByLabelText('Allow older RSA ciphers (no forward secrecy)') as HTMLInputElement).checked).toBe(true);
  });

  it('shows the server’s refusal of a wildcard certificate name on the field', async () => {
    mockFetch((call) => (call.method === 'PATCH' ? reply(flow.patch_bad_server_name) : reply(flow.get_initial)));
    renderWith(admin, <DirectorySettingsPage />);
    await screen.findByLabelText('Certificate name');
    change('Certificate name', '*');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(flow.patch_bad_server_name.body.tls_server_name[0])).toBeTruthy();
  });

  it('turning sign-in on before a successful test shows why it was refused; after a test it turns on', async () => {
    let tested = false;
    const { calls } = mockFetch((call) => {
      if (path(call).endsWith('/test-connection/')) {
        tested = true;
        return reply(flow.test_connection_ok);
      }
      if (call.method === 'PATCH') return reply(tested ? flow.patch_enable : flow.patch_enable_untested);
      return reply(flow.patch_connection);
    });
    renderWith(admin, <DirectorySettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Turn directory sign-in on' }));
    expect(await screen.findByText(/Run a successful connection test first/)).toBeTruthy();
    expect(writes(calls)[0].body).toEqual({ enabled: true });

    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText('Connected and read the search base.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Turn directory sign-in on' }));
    expect(await screen.findByRole('button', { name: 'Turn directory sign-in off' })).toBeTruthy();
  });

  it('a failed connection test says so', async () => {
    mockFetch((call) => (path(call).endsWith('/test-connection/') ? reply(flow.test_connection_down) : reply(flow.patch_connection)));
    renderWith(admin, <DirectorySettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(flow.test_connection_down.body.detail)).toBeTruthy();
  });

  it('looks up a username: the entry, what stops it signing in, or that there is none', async () => {
    const byName: Record<string, Captured> = { jdoe: flow.test_user_found, nomail: flow.test_user_no_mail, ghost: flow.test_user_missing, '': flow.test_user_blank };
    const { calls } = mockFetch((call) => (path(call).endsWith('/test-user/') ? reply(byName[(call.body as { username: string }).username]) : { body: configured }));
    renderWith(admin, <DirectorySettingsPage />);
    const lookUp = async (name: string) => {
      change('Username', name);
      fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
      await waitFor(() => expect(calls.at(-1)?.body).toEqual({ username: name }));
    };
    await screen.findByLabelText('Username');

    await lookUp('jdoe');
    const entry = await screen.findByLabelText('Directory entry');
    expect(within(entry).getByText('jdoe@studio.test')).toBeTruthy();
    await lookUp('nomail');
    expect(await screen.findByText('The entry has no e-mail, so no account can be made from it.')).toBeTruthy();
    await lookUp('ghost');
    expect(await screen.findByText('No entry matches this username.')).toBeTruthy();
    await lookUp('');
    expect(await screen.findByText('This field may not be blank.')).toBeTruthy();
  });

  it('warns when the server forces directory sign-in off or has no encryption key', async () => {
    mockFetch(() => ({ body: { ...configured, forced_off: true, encryption_key_set: false } }));
    renderWith(admin, <DirectorySettingsPage />);
    expect(await screen.findByText(/DIRECTORY_LOGIN_FORCE_OFF/)).toBeTruthy();
    expect(screen.getByText(/no DIRECTORY_ENCRYPTION_KEY/)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Turn directory sign-in off' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a 503 (no encryption key) fails the save with the generic server-error banner; the page says which key is missing', async () => {
    const noKey = { ...configured, encryption_key_set: false };
    mockFetch((call) => (call.method === 'PATCH' ? reply(flow.patch_password_without_key) : { body: noKey }));
    renderWith(admin, <DirectorySettingsPage />);
    await screen.findByLabelText('Service account password');
    change('Service account password', 'new-secret');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(await screen.findByText(`Ref: ${flow.patch_password_without_key.body.error.request_id}`)).toBeTruthy();
    expect(screen.getByText(/no DIRECTORY_ENCRYPTION_KEY/)).toBeTruthy();
  });
});

describe('system settings navigation', () => {
  it('offers the Directory (LDAP) tab only with identity.directory.manage', () => {
    renderWith(admin, <SystemNav />);
    expect(screen.getByRole('link', { name: 'Directory (LDAP)' })).toBeTruthy();
    cleanup();
    renderWith(withCodes('settings.view', 'settings.manage'), <SystemNav />);
    expect(screen.queryByRole('link', { name: 'Directory (LDAP)' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Feature flags' })).toBeTruthy();
    cleanup();
    // The permission alone shows only that tab.
    renderWith(withCodes('identity.directory.manage'), <SystemNav />);
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Directory (LDAP)']);
  });
});

describe('person account: directory login and the per-user MFA requirement', () => {
  const ldapUser = flow.user_detail_directory_user.body as { id: string };
  const localUser = flow.user_detail_local_user.body as { id: string };
  const staffAdmin = withCodes('identity.user.reset_password', 'identity.user.update', 'identity.user.require_mfa');
  const server = (call: MockCall): MockReply => {
    const p = path(call);
    if (p === `/api/v1/identity/users/${ldapUser.id}/require-mfa/`) return reply((call.body as { required: boolean }).required ? flow.require_mfa_on : flow.require_mfa_off);
    if (p === `/api/v1/identity/users/${ldapUser.id}/`) return reply(flow.user_detail_directory_user);
    if (p === `/api/v1/identity/users/${localUser.id}/`) return reply(flow.user_detail_local_user);
    return { status: 404, body: {} };
  };
  const section = (user: User, userId: string) => renderWith(user, <AccountSection personId="p1" personName="Jane Doe" userId={userId} />);

  it('marks a directory login and offers no password actions for it (the API refuses them)', async () => {
    mockFetch(server);
    section(staffAdmin, ldapUser.id);
    expect(await screen.findByText('Directory (LDAP)')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reset password' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Require password change' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign out everywhere' })).toBeTruthy();
    cleanup();
    mockFetch(server);
    section(staffAdmin, localUser.id);
    expect(await screen.findByRole('button', { name: 'Reset password' })).toBeTruthy();
    expect(screen.queryByText('Directory (LDAP)')).toBeNull();
  });

  it('"Require two-factor sign-in" posts the choice and reloads the login', async () => {
    const { calls } = mockFetch(server);
    section(staffAdmin, ldapUser.id);
    const box = (await screen.findByLabelText('Require two-factor sign-in for this login')) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/identity/users/${ldapUser.id}/require-mfa/`);
    expect(writes(calls)[0].body).toEqual({ required: true });
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && path(c) === `/api/v1/identity/users/${ldapUser.id}/`)).toHaveLength(2));
  });

  it('unticking it posts required: false', async () => {
    const { calls } = mockFetch((call) =>
      call.method === 'GET' && path(call) === `/api/v1/identity/users/${ldapUser.id}/` ? { body: { ...flow.user_detail_directory_user.body, mfa_required: true } } : server(call)
    );
    section(staffAdmin, ldapUser.id);
    expect(await screen.findByText('Two-factor required')).toBeTruthy();
    const box = screen.getByLabelText('Require two-factor sign-in for this login') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toEqual({ required: false });
  });

  it('is not offered without identity.user.require_mfa', async () => {
    mockFetch(server);
    section(withCodes('identity.user.update'), ldapUser.id);
    await screen.findByText('Directory (LDAP)');
    expect(screen.queryByLabelText('Require two-factor sign-in for this login')).toBeNull();
  });
});
