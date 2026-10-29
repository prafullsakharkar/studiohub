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
import { AccountSection } from '../components/AccountSection';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_identity_admin_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items ?? c.body });
const path = (c: MockCall) => new URL(c.url).pathname;

const PERSON = 'ea087ae9-cfee-4f5b-95b8-d1a9bb86e9c4';
const target = flow.users_detail.body as { id: string; email: string };

// roles_list was captured before the "Reviewer" role existed; add it (from the role embedded in the
// captured role-members response) so the login's held role is part of the catalog.
const heldRef = flow.roles_users_get.body.items[0].role as { id: string; name: string; code: string };
const rolesWithHeld = {
  ...flow.roles_list.body,
  count: flow.roles_list.body.results.length + 1,
  next: null,
  results: [...flow.roles_list.body.results, { ...flow.roles_list.body.results[0], ...heldRef, is_system: false }],
};

function renderSection(user: User, props: { userId: string | null }, refreshUser = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser } as unknown as AuthContextValue}>
        <MemoryRouter>
          <AccountSection personId={PERSON} personName="Linda Linker" personEmail="linda@studio.test" userId={props.userId} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return { refreshUser };
}

const server = (call: MockCall): MockReply => {
  const p = path(call);
  if (p === '/api/v1/identity/users/' && call.method === 'POST') return reply(flow.users_create);
  if (p === '/api/v1/identity/users/') return bare(flow.users_list);
  if (p === `/api/v1/identity/users/${target.id}/`) return reply(flow.users_detail);
  if (p.endsWith('/activate/')) return reply(flow.users_activate);
  if (p.endsWith('/reset-password/')) return reply(flow.users_reset_password);
  if (p.endsWith('/link-user/')) return reply(flow.people_link_user);
  if (p.endsWith('/unlink-user/')) return reply(flow.people_unlink_user);
  if (p === '/api/v1/roles/') return { body: rolesWithHeld };
  if (/\/api\/v1\/roles\/[^/]+\/users\/$/.test(p)) {
    if (call.method === 'POST') return reply(flow.roles_users_assign);
    return p.includes(flow.roles_users_get.body.items[0].role.id) ? bare(flow.roles_users_get) : { body: [] };
  }
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

describe('person account: no login yet', () => {
  it('creates the user, then links it to the person, in that order', async () => {
    const { calls } = mockFetch(server);
    renderSection(superuser, { userId: null });

    fireEvent.change(await screen.findByLabelText('Initial password'), { target: { value: 'correct-horse-battery' } });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('linda@studio.test');
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/link-user/'))).toBe(true));
    const writes = calls.filter((c) => c.method === 'POST');
    expect(writes.map((c) => path(c))).toEqual(['/api/v1/identity/users/', `/api/v1/people/${PERSON}/link-user/`]);
    expect(writes[0].body).toEqual({ email: 'linda@studio.test', password: 'correct-horse-battery' });
    expect(writes[1].body).toEqual({ user: flow.users_create.body.id });
  });

  it('when linking fails after the user was created, offers a retry that does NOT create the user again', async () => {
    let linkAttempts = 0;
    const { calls } = mockFetch((c) => {
      if (path(c).endsWith('/link-user/')) {
        linkAttempts += 1;
        return linkAttempts === 1 ? reply(flow.people_link_user_already_linked) : reply(flow.people_link_user);
      }
      return server(c);
    });
    renderSection(superuser, { userId: null });

    fireEvent.change(await screen.findByLabelText('Initial password'), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    expect(await screen.findByText(/already linked to another person/i)).toBeTruthy();
    const alert = screen.getByRole('alert');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry link' }));

    await waitFor(() => expect(linkAttempts).toBe(2));
    const creates = calls.filter((c) => c.method === 'POST' && path(c) === '/api/v1/identity/users/');
    expect(creates).toHaveLength(1); // a second create would fail as a duplicate email
    expect(calls.filter((c) => path(c).endsWith('/link-user/')).map((c) => c.body)).toEqual([{ user: flow.users_create.body.id }, { user: flow.users_create.body.id }]);
  });

  it('shows the server’s validation message for a weak initial password', async () => {
    mockFetch((c) => (c.method === 'POST' && path(c) === '/api/v1/identity/users/' ? reply(flow.users_create_weak) : server(c)));
    renderSection(superuser, { userId: null });

    fireEvent.change(await screen.findByLabelText('Initial password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));
    expect(await screen.findByText(/at least 12 characters/i)).toBeTruthy();
  });

  it('offers no create/link controls to a user without the permissions', async () => {
    mockFetch(server);
    renderSection(artist, { userId: null });
    expect(await screen.findByText(/do not have permission to create or link/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Create login' })).toBeNull();
  });
});

describe('person account: linked login', () => {
  it('shows the login state and runs a lifecycle action after confirmation', async () => {
    const { calls } = mockFetch(server);
    renderSection(superuser, { userId: target.id });

    expect(await screen.findByText(target.email)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Reset password' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));

    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/reset-password/'))).toBe(true));
    expect(calls.find((c) => path(c).endsWith('/reset-password/'))!.method).toBe('POST');
  });

  it('will not deactivate, suspend or archive the signed-in user’s own login (Q-08)', async () => {
    mockFetch(server);
    renderSection({ ...superuser, id: target.id }, { userId: target.id });
    await screen.findByText(target.email);

    for (const name of ['Deactivate', 'Suspend', 'Archive']) {
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((screen.getByRole('button', { name: 'Reset password' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('lists the roles the login holds and assigns another, then refreshes /auth/me', async () => {
    const { calls } = mockFetch(server);
    const { refreshUser } = renderSection(superuser, { userId: flow.roles_users_get.body.items[0].user.id });
    const heldRole = flow.roles_users_get.body.items[0].role as { id: string; name: string };

    expect(await screen.findByRole('button', { name: `Remove role ${heldRole.name}` })).toBeTruthy();

    const other = (flow.roles_list.body.results as Array<{ id: string; name: string }>).find((r) => r.id !== heldRole.id)!;
    fireEvent.change(screen.getByLabelText('Assign role'), { target: { value: other.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c) === `/api/v1/roles/${other.id}/users/`)).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && path(c) === `/api/v1/roles/${other.id}/users/`)!.body).toEqual({ user_id: flow.roles_users_get.body.items[0].user.id });
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it('unlinks the login after confirmation', async () => {
    const { calls } = mockFetch(server);
    renderSection(superuser, { userId: target.id });
    await screen.findByText(target.email);

    fireEvent.click(screen.getByRole('button', { name: /unlink login from this person/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unlink' }));
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/people/${PERSON}/unlink-user/`)).toBe(true));
  });
});
