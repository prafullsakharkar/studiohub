import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { GroupDetailPage } from '../pages/GroupDetailPage';
import { GroupsPage } from '../pages/GroupsPage';
import { PermissionsPage } from '../pages/PermissionsPage';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('identity/_identity_admin_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items });
const path = (c: MockCall) => new URL(c.url).pathname;

function renderAt(initial: string, user: User, refreshUser = vi.fn().mockResolvedValue(undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/access/groups" element={<GroupsPage />} />
            <Route path="/access/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/access/permissions" element={<PermissionsPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  return { refreshUser };
}

const lighting = flow.groups_list_with_row.body.results[0] as { id: string; name: string; code: string };
const firstMember = flow.groups_members_get.body.items[0] as { user: { id: string; email: string } };
const firstLink = flow.groups_roles_get.body.items[0] as { role: { id: string; name: string } };

/** The captured catalog is page 1 of 145 (page_size=3); serve it as the last page so the loader stops. */
const catalogPage = { body: { ...flow.permissions_list.body, next: null } };

const membersTable = () => screen.findByRole('table', { name: 'Group members' });

const groupServer = (call: MockCall): MockReply => {
  const p = path(call);
  if (call.method === 'POST') return reply(flow.groups_members_add);
  if (call.method === 'DELETE') return reply(flow.groups_members_remove);
  if (p.endsWith('/members/')) return bare(flow.groups_members_get);
  if (p.endsWith('/roles/') && p.includes('/groups/')) return bare(flow.groups_roles_get);
  if (p === '/api/v1/roles/') return reply(flow.roles_list);
  if (p === '/api/v1/identity/users/') return bare(flow.users_list);
  return reply(flow.groups_detail);
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

describe('groups list', () => {
  it('lists groups and offers creation only to those who may create', async () => {
    mockFetch(() => reply(flow.groups_list_with_row));
    renderAt('/access/groups', superuser);
    expect(await screen.findByRole('link', { name: lighting.name })).toBeTruthy();
    expect(screen.getByRole('button', { name: /new group/i })).toBeTruthy();
    cleanup();

    mockFetch(() => reply(flow.groups_list_with_row));
    renderAt('/access/groups', artist);
    await screen.findByRole('link', { name: lighting.name });
    expect(screen.queryByRole('button', { name: /new group/i })).toBeNull();
  });
});

describe('group detail', () => {
  it('shows members with their group role', async () => {
    mockFetch(groupServer);
    renderAt(`/access/groups/${lighting.id}`, superuser);
    const table = within(await membersTable());
    expect(table.getAllByText(firstMember.user.email).length).toBe(flow.groups_members_get.body.items.length);
    expect(table.getAllByText('Owner').length).toBeGreaterThan(0);
  });

  it('adds a member with the owner/manager flags and refreshes the signed-in user', async () => {
    const { calls } = mockFetch(groupServer);
    const { refreshUser } = renderAt(`/access/groups/${lighting.id}`, superuser);
    await membersTable();

    const candidate = (flow.users_list.body.items as Array<{ id: string; email: string }>).find((u) => u.id !== firstMember.user.id)!;
    fireEvent.change(await screen.findByLabelText('Add member'), { target: { value: candidate.id } });
    fireEvent.click(screen.getByLabelText('Manager'));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe(`/api/v1/groups/${lighting.id}/members/`);
    expect(post.body).toEqual({ user_id: candidate.id, is_owner: false, is_manager: true });
    await waitFor(() => expect(refreshUser).toHaveBeenCalled());
  });

  it('removes a member by user id after confirmation', async () => {
    const { calls } = mockFetch(groupServer);
    renderAt(`/access/groups/${lighting.id}`, superuser);
    const table = within(await membersTable());

    fireEvent.click(table.getAllByRole('button', { name: /^Remove / })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(calls.find((c) => c.method === 'DELETE')!.body).toEqual({ user_id: firstMember.user.id });
  });

  it('detaches an attached role by role id', async () => {
    const { calls } = mockFetch(groupServer);
    renderAt(`/access/groups/${lighting.id}`, superuser);
    await membersTable();

    fireEvent.click(screen.getByRole('tab', { name: /roles/i }));
    fireEvent.click(await screen.findByRole('button', { name: `Detach ${firstLink.role.name}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Detach' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(calls.find((c) => c.method === 'DELETE')!.body).toEqual({ role_id: firstLink.role.id });
  });

  it('does not request members for a user who cannot update groups (the API answers 403)', async () => {
    const { calls } = mockFetch(groupServer);
    renderAt(`/access/groups/${lighting.id}`, artist);
    expect(await screen.findByRole('note')).toBeTruthy();
    expect(calls.map(path).some((p) => p.endsWith('/members/'))).toBe(false);
  });
});

describe('permission catalog', () => {
  it('filters by module and text on the client, never sending the broken ?module= filter', async () => {
    const { calls } = mockFetch(() => catalogPage);
    renderAt('/access/permissions', superuser);
    const rows = flow.permissions_list.body.results as Array<{ code: string; module: string }>;
    expect(await screen.findByText(rows[0].code)).toBeTruthy();

    const other = rows.find((r) => r.module !== rows[0].module);
    if (other) {
      fireEvent.change(screen.getByLabelText('Filter by module'), { target: { value: rows[0].module } });
      expect(screen.queryByText(other.code)).toBeNull();
    }
    fireEvent.change(screen.getByLabelText('Search permissions'), { target: { value: 'no-such-code' } });
    expect(await screen.findByText(/no permissions match/i)).toBeTruthy();
    expect(calls.every((c) => !new URL(c.url).searchParams.has('module'))).toBe(true);
  });
});
