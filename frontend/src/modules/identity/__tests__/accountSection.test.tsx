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

/**
 * The person as the server answers it: unlinked (a captured Person) until the login is created, then linked to it, as when the
 * server adopts the person by e-mail (DOM-MD-PER-10). `adopts: false` keeps it unlinked.
 */
const unlinkedPerson = { ...flow.people_unlink_user.body, id: PERSON, user: null, email: 'linda@studio.test' };
const linkedPerson = { ...flow.people_link_user.body, id: PERSON, user: flow.users_create.body.id, email: 'linda@studio.test' };
const people = { adopts: true, created: false, email: 'linda@studio.test' as string | null };
const personReply = (): MockReply => ({ body: people.adopts && people.created ? { ...linkedPerson, email: people.email } : { ...unlinkedPerson, email: people.email } });

const server = (call: MockCall): MockReply => {
  const p = path(call);
  if (p === `/api/v1/people/${PERSON}/` && call.method === 'PATCH') {
    people.email = (call.body as { email: string }).email;
    return personReply();
  }
  if (p === `/api/v1/people/${PERSON}/`) return personReply();
  if (p === '/api/v1/identity/users/' && call.method === 'POST') {
    people.created = true;
    return reply(flow.users_create);
  }
  if (p === '/api/v1/identity/users/') return bare(flow.users_list);
  if (p === `/api/v1/identity/users/${target.id}/`) return reply(flow.users_detail);
  if (p.endsWith('/activate/')) return reply(flow.users_activate);
  if (p.endsWith('/reset-password/')) return reply(flow.users_reset_password);
  if (p.endsWith('/link-user/')) return reply(flow.people_link_user);
  if (p.includes('/sessions/admin/')) return bare(flow.sessions_admin_list);
  if (p.includes('/mfa/admin/reset/')) return reply(flow.mfa_admin_reset_other);
  if (p.endsWith('/unlink-user/')) return reply(flow.people_unlink_user);
  if (p === '/api/v1/roles/') return { body: rolesWithHeld };
  if (/\/api\/v1\/roles\/[^/]+\/users\/$/.test(p)) {
    if (call.method === 'POST') return reply(flow.roles_users_assign);
    return p.includes(flow.roles_users_get.body.items[0].role.id) ? bare(flow.roles_users_get) : { body: [] };
  }
  return { status: 404, body: {} };
};

beforeEach(() => {
  Object.assign(people, { adopts: true, created: false, email: 'linda@studio.test' });
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('person account: no login yet', () => {
  it('creates the login and lets the server link the person it adopts by e-mail: no link call', async () => {
    const { calls } = mockFetch(server);
    renderSection(superuser, { userId: null });

    fireEvent.change(await screen.findByLabelText('Initial password'), { target: { value: 'correct-horse-battery' } });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('linda@studio.test');
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    await waitFor(() => expect(calls.filter((c) => path(c) === `/api/v1/people/${PERSON}/`).length).toBeGreaterThanOrEqual(2)); // read before, read after
    const writes = calls.filter((c) => c.method !== 'GET');
    expect(writes.map((c) => `${c.method} ${path(c)}`)).toEqual(['POST /api/v1/identity/users/']); // the e-mail already matched; the server linked the person
    expect(writes[0].body).toEqual({ email: 'linda@studio.test', password: 'correct-horse-battery' });
    expect(screen.queryByRole('button', { name: 'Retry link' })).toBeNull();
  });

  it('gives the person the login’s e-mail first when they differ, so the server adopts it instead of making a second person', async () => {
    people.email = 'old@studio.test';
    const { calls } = mockFetch(server);
    renderSection(superuser, { userId: null });

    fireEvent.change(await screen.findByLabelText('Initial password'), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    await waitFor(() => expect(calls.filter((c) => path(c) === `/api/v1/people/${PERSON}/`).length).toBeGreaterThanOrEqual(3));
    expect(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${path(c)}`)).toEqual([`PATCH /api/v1/people/${PERSON}/`, 'POST /api/v1/identity/users/']);
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ email: 'linda@studio.test' });
  });

  it('puts the person’s e-mail back when the login is refused', async () => {
    people.email = 'old@studio.test';
    const { calls } = mockFetch((c) => (c.method === 'POST' && path(c) === '/api/v1/identity/users/' ? reply(flow.users_create_weak) : server(c)));
    renderSection(superuser, { userId: null });

    fireEvent.change(await screen.findByLabelText('Initial password'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create login' }));

    expect(await screen.findByText(/at least 12 characters/i)).toBeTruthy();
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ email: 'linda@studio.test' }, { email: 'old@studio.test' }]));
  });

  it('when the server did not link the new login, offers a retry that does NOT create the user again', async () => {
    people.adopts = false;
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

  it('superuser sees the login’s sessions and can reset its two-factor authentication', async () => {
    const { calls } = mockFetch(server);
    renderSection({ ...superuser, is_superuser: true }, { userId: target.id });
    expect(await screen.findByLabelText('Active sessions')).toBeTruthy();
    expect(calls.some((c) => path(c) === `/api/v1/identity/sessions/admin/${target.id}/`)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Reset two-factor authentication' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/identity/mfa/admin/reset/${target.id}/`)).toBe(true));
  });

  it('a non-superuser never sees those controls (the API refuses them)', async () => {
    mockFetch(server);
    renderSection({ ...superuser, is_superuser: false, permissions: [...(superuser.permissions ?? [])] } as User, { userId: target.id });
    await screen.findByText(target.email);
    expect(screen.queryByRole('button', { name: 'Reset two-factor authentication' })).toBeNull();
  });
});
