import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { RoleDetailPage } from '../pages/RoleDetailPage';
import { RolesPage } from '../pages/RolesPage';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_identity_admin_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items });
const path = (c: MockCall) => new URL(c.url).pathname;

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderAt(initial: string, user: User, refreshUser = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/access/roles" element={<RolesPage />} />
            <Route path="/access/roles/:roleId" element={<RoleDetailPage />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return { refreshUser };
}

const reviewer = flow.roles_permissions_get.body.items[0].role as { id: string; name: string; code: string };

/** Serves a role's detail page from the captured responses. */
const roleServer = (call: MockCall): MockReply => {
  const p = path(call);
  if (call.method === 'POST') return reply(flow.roles_permissions_grant);
  if (call.method === 'DELETE') return reply(flow.roles_permissions_revoke);
  // The capture is page 1 of 145 (page_size=3). The catalog loader follows `next`, so serve it as the last page.
  if (p === '/api/v1/permissions/') return { body: { ...flow.permissions_list.body, next: null } };
  if (p.endsWith('/permissions/')) return bare(flow.roles_permissions_get);
  if (p.endsWith('/users/')) return bare(flow.roles_users_get);
  if (p.endsWith('/groups/')) return bare(flow.roles_groups_get);
  if (p === '/api/v1/identity/users/') return bare(flow.users_list);
  return { body: { ...flow.roles_list.body.results[0], id: reviewer.id, name: reviewer.name, code: reviewer.code, is_system: false } };
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

describe('roles list', () => {
  it('shows the roles the server returned, flags system roles, and links to the detail page', async () => {
    const { calls } = mockFetch(() => reply(flow.roles_list));
    renderAt('/access/roles', superuser);

    expect(await screen.findByRole('link', { name: 'Platform Admin' })).toBeTruthy();
    expect(path(calls[0])).toBe('/api/v1/roles/');
    expect(screen.getAllByText('System').length).toBeGreaterThan(0);
  });

  it('offers "New role" only to a user who may create roles', async () => {
    mockFetch(() => reply(flow.roles_list));
    renderAt('/access/roles', artist);
    await screen.findByRole('link', { name: 'Platform Admin' });
    expect(screen.queryByRole('button', { name: /new role/i })).toBeNull();
  });

  it('creates a role, reads it back by code (the 201 has no id) and opens it', async () => {
    const created = { ...flow.roles_list.body.results[0], id: 'new-role-id', code: 'reviewer', name: 'Reviewer' };
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return reply(flow.roles_create);
      if (c.url.includes('search=reviewer')) return { body: { count: 1, next: null, previous: null, results: [created] } };
      if (path(c) !== '/api/v1/roles/') return roleServer(c); // the detail page opened after creating
      return reply(flow.roles_list);
    });
    renderAt('/access/roles', superuser);
    await screen.findByRole('link', { name: 'Platform Admin' });

    fireEvent.click(screen.getByRole('button', { name: /new role/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Reviewer' } });
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'reviewer' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /create role/i }));

    // Navigation to /access/roles/:id is proven by the detail page asking for THAT role.
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/roles/new-role-id/')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toMatchObject({ name: 'Reviewer', code: 'reviewer', priority: 40 });
  });

  it('puts a duplicate-code error from the server on the Code field', async () => {
    mockFetch((c) => (c.method === 'POST' ? reply(flow.roles_create_duplicate_code) : reply(flow.roles_list)));
    renderAt('/access/roles', superuser);
    await screen.findByRole('link', { name: 'Platform Admin' });

    fireEvent.click(screen.getByRole('button', { name: /new role/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Reviewer 2' } });
    fireEvent.change(within(dialog).getByLabelText('Code'), { target: { value: 'reviewer' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /create role/i }));

    expect(await within(dialog).findByText(/already exists/i)).toBeTruthy();
  });
});

describe('role detail', () => {
  it('lists the granted permissions by code, straight from the embedded refs', async () => {
    mockFetch(roleServer);
    renderAt(`/access/roles/${reviewer.id}`, superuser);

    expect(await screen.findByText('shot.update')).toBeTruthy();
    expect(screen.getByText('shot.view')).toBeTruthy();
    expect(screen.getByText('Never')).toBeTruthy(); // shot.view has no expiry
  });

  it('grants a permission with its expiry and then refreshes the signed-in user', async () => {
    const { calls } = mockFetch(roleServer);
    const { refreshUser } = renderAt(`/access/roles/${reviewer.id}`, superuser);
    await screen.findByText('shot.update');

    const candidate = flow.permissions_list.body.results[0] as { id: string; code: string };
    fireEvent.change(await screen.findByLabelText('Grant permission'), { target: { value: candidate.id } });
    fireEvent.change(screen.getByLabelText(/expires/i), { target: { value: '2030-01-01T00:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Grant' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe(`/api/v1/roles/${reviewer.id}/permissions/`);
    expect(post.body).toMatchObject({ permission_id: candidate.id });
    // datetime-local is local wall-clock time; the API gets the same instant in UTC.
    expect((post.body as { expires_at: string }).expires_at).toBe(new Date('2030-01-01T00:00').toISOString());
    // The user may hold this very role: the UI must follow their new permissions.
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it('revokes with the permission id in the DELETE body, after confirmation', async () => {
    const { calls } = mockFetch(roleServer);
    renderAt(`/access/roles/${reviewer.id}`, superuser);
    await screen.findByText('shot.update');

    fireEvent.click(screen.getByRole('button', { name: 'Revoke shot.update' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    const del = calls.find((c) => c.method === 'DELETE')!;
    expect(del.body).toEqual({ permission_id: flow.roles_permissions_get.body.items[0].permission.id });
  });

  it('read-only visitor: sees the (open) permission list but no grant/revoke controls and no member list', async () => {
    // RoleViewSet.get_permission_required: GET permissions/groups are open reference data; GET users needs
    // identity.role.view; writes need identity.role.update (verified live).
    const { calls } = mockFetch(roleServer);
    renderAt(`/access/roles/${reviewer.id}`, artist);

    expect(await screen.findByText('shot.update')).toBeTruthy();
    expect(screen.queryByLabelText('Grant permission')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Revoke/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: /users/i }));
    expect(await screen.findByRole('note')).toBeTruthy();
    expect(calls.map(path).some((p) => p.endsWith('/users/') && p.includes('/roles/'))).toBe(false);
  });

  it('explains why users cannot be chosen when the caller may not list users (the API answers 403)', async () => {
    // Verified live: GET /identity/users/ is 403 without identity.user.view (it is not "self only").
    mockFetch((c) => (path(c) === '/api/v1/identity/users/' ? { status: 403, body: { detail: 'You do not have permission to perform this action.' } } : roleServer(c)));
    renderAt(`/access/roles/${reviewer.id}`, superuser);
    await screen.findByText('shot.update');

    fireEvent.click(screen.getByRole('tab', { name: /users/i }));
    expect(await screen.findByRole('note')).toBeTruthy();
    expect(screen.queryByLabelText('Assign to user')).toBeNull();
  });

  it('shows who holds the role and removes a user by id', async () => {
    const { calls } = mockFetch(roleServer);
    renderAt(`/access/roles/${reviewer.id}`, superuser);
    await screen.findByText('shot.update');

    fireEvent.click(screen.getByRole('tab', { name: /users/i }));
    const user = flow.roles_users_get.body.items[0].user as { id: string; email: string };
    expect(await screen.findByText(user.email)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: `Remove ${user.email}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(calls.find((c) => c.method === 'DELETE')!.body).toEqual({ user_id: user.id });
  });
});
