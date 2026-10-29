import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { SecurityLogPage } from '../pages/SecurityLogPage';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_identity_admin_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
/** Captured bare arrays are stored as `{_bare_list, items}`; the wire format is the array itself. */
const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items ?? c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

function renderPage(user: User) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>
          <SecurityLogPage />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const server = (call: MockCall): MockReply => {
  const p = path(call);
  if (p === '/api/v1/identity/users/') return bare(flow.users_list);
  if (p.endsWith('/security-events/')) return bare(flow.ledger_security_events);
  if (p.endsWith('/login-history/')) return bare(flow.ledger_login_history);
  if (p.endsWith('/login-attempts/')) return bare(flow.ledger_login_attempts);
  if (p.endsWith('/ip-blacklist/') && call.method === 'POST') return reply(flow.ledger_ip_blacklist_create);
  if (p.endsWith('/ip-blacklist/')) return bare(flow.ledger_ip_blacklist_empty);
  return { status: 404, body: {} };
};

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('security log', () => {
  it('always asks the unpaginated ledgers for a bounded date window', async () => {
    const { calls } = mockFetch(server);
    renderPage(superuser);

    expect(await screen.findByText('mfa_verified')).toBeTruthy();
    const call = calls.find((c) => path(c).endsWith('/security-events/'))!;
    expect(params(call).start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(params(call).end_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('switches ledger and re-queries when the window changes', async () => {
    const { calls } = mockFetch(server);
    renderPage(superuser);
    await screen.findByText('mfa_verified');

    fireEvent.click(screen.getByRole('tab', { name: 'Login history' }));
    expect(await screen.findByRole('table', { name: 'Login history' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } });
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/login-history/') && params(c).start_date === '2026-01-01')).toBe(true));
  });

  it('blocks an IP address and shows the server’s validation message for a bad one', async () => {
    const { calls } = mockFetch((c) => {
      if (path(c).endsWith('/ip-blacklist/') && c.method === 'POST' && (c.body as { ip_address: string }).ip_address === 'nope') return reply(flow.ledger_ip_blacklist_create_invalid);
      return server(c);
    });
    renderPage(superuser);
    await screen.findByText('mfa_verified');
    fireEvent.click(screen.getByRole('tab', { name: 'IP blacklist' }));

    fireEvent.change(await screen.findByLabelText('IP address'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Block IP' }));
    expect(await screen.findByText(/valid IPv4 or IPv6/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('IP address'), { target: { value: '203.0.113.7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Block IP' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').length).toBe(2));
    expect(calls.filter((c) => c.method === 'POST')[1].body).toMatchObject({ ip_address: '203.0.113.7' });
  });

  it('tells a user without any ledger permission why there is nothing here, without calling the API', async () => {
    const { calls } = mockFetch(server);
    renderPage(artist);
    expect(await screen.findByRole('note')).toBeTruthy();
    expect(calls.map(path).some((p) => p.includes('/security-events/') || p.includes('/login-history/'))).toBe(false);
    expect(within(screen.getByRole('note')).getByText('identity.security_event.view')).toBeTruthy();
  });
});
