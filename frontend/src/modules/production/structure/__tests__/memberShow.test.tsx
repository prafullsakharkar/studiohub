import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import type { User } from '@/types/identity';
import { MembersPanel } from '../panels';

type Member = { id: string; user_id: string; name: string; email: string; show_id: string | null; show_code: string; role: string; roles: string[]; status: string; scope: string; department: string };
type Captured = { status: number; body: unknown };
const showFlow = loadSample<Record<string, Captured>>('production/_membership_show_flow.json');
const detail = loadSample<Record<string, Captured>>('production/_member_detail_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const bodyOf = <T,>(flow: Record<string, Captured>, name: string) => flow[name].body as T;
const PID = (showFlow.ids as unknown as { project: string }).project;
const show = bodyOf<{ results: Array<{ id: string; code: string; name: string }> }>(showFlow, 'shows_list').results[0];
// A member bound to the show (as the server answered after binding), a suspended two-role member on the whole
// project, and the signed-in administrator's own membership (same row shape, their user id).
const bound = bodyOf<{ results: Member[] }>(showFlow, 'members_list').results[0];
const loose = bodyOf<Member>(showFlow, 'other_add');
const mine: Member = { ...loose, id: 'own-membership', user_id: superuser.id, name: 'The administrator', status: 'active', roles: ['Lead'], role: 'Lead' };
const members = { count: 3, results: [bound, loose, mine] };

const path = (c: MockCall) => new URL(c.url).pathname;
const membersUrl = `/api/organizations/projects/${PID}/members/`;
const memberUrl = (m: Member) => `/api/organizations/projects/${PID}/members/${m.id}/`;
let shows: unknown;
let reply: (c: MockCall) => MockReply | undefined;
const server = (c: MockCall): MockReply => {
  const custom = reply(c);
  if (custom) return custom;
  if (path(c) === `/api/organizations/projects/${PID}/members/`) return c.method === 'POST' ? { body: bodyOf(showFlow, 'other_readd_preserving') } : { body: members };
  if (path(c) === '/api/v1/shows/') return { body: shows };
  return { body: { count: 0, next: null, previous: null, results: [] } };
};

function mount(user: User) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>
          <MembersPanel projectId={PID} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const called = (calls: MockCall[], method: string) => {
  const call = calls.find((c) => c.method === method);
  if (!call) throw new Error(`no ${method} was sent`);
  return call;
};
const showSelect = async (n: number) => ((await screen.findAllByRole('combobox', { name: /^Show for/ })) as HTMLSelectElement[])[n];

beforeEach(() => {
  shows = bodyOf(showFlow, 'shows_list');
  reply = () => undefined;
  useNotificationStore.setState({ notifications: [] } as never);
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('members and their show (CR-36)', () => {
  it('shows each member’s show, and the whole project for the rest', async () => {
    mockFetch(server);
    mount(superuser);
    const first = await showSelect(0);
    const second = await showSelect(1);
    expect(first.value).toBe(show.id);
    expect(second.value).toBe('');
    expect(first.textContent).toContain(`${show.code} — ${show.name}`);
    expect(second.selectedOptions[0].textContent).toBe('Whole project');
  });

  it('is plain text for someone who may not change members', async () => {
    mockFetch(server);
    mount(artist);
    await screen.findByRole('table', { name: 'Project members' });
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /^Remove/ })).toBeNull();
    expect(screen.getByText(bound.show_code)).toBeTruthy();
    expect(screen.getAllByText('Whole project').length).toBeGreaterThan(0);
  });

  it('adds a member to a chosen show, and sends no show for the whole project', async () => {
    const { calls } = mockFetch(server);
    mount(superuser);
    await showSelect(0);
    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: show.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1));
    expect(called(calls, 'POST').body).toEqual({ email: 'new@example.test', role: 'Artist', show: show.id });

    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: 'again@example.test' } });
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'POST')[1].body).toEqual({ email: 'again@example.test', role: 'Artist' });
  });

  it('does not add someone who is already listed: no request, and a message that gives their status (CR-38)', async () => {
    // The server may store an e-mail with capitals; the match ignores case on both sides (the form trims the spaces).
    const mixed = { ...loose, email: 'Mixed.Case@Example.test' };
    reply = (c) => (c.method === 'GET' && path(c) === membersUrl ? { body: { count: 1, results: [mixed] } } : undefined);
    const { calls } = mockFetch(server);
    mount(superuser);
    await showSelect(0);
    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: '  mixed.case@EXAMPLE.test ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(useNotificationStore.getState().notifications.map((n) => n.message).join(' ')).toContain('already on this project (suspended)'));
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    expect((screen.getByLabelText('Add a member by email') as HTMLInputElement).value).toBe('');
  });

  it('still adds someone who is not listed', async () => {
    const { calls } = mockFetch(server);
    mount(superuser);
    await showSelect(0);
    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: 'someone.else@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1));
  });

  it('offers no show picker for a project that has no shows', async () => {
    shows = { count: 0, next: null, previous: null, results: [] };
    mockFetch(server);
    mount(superuser);
    await screen.findByRole('table', { name: 'Project members' });
    expect(screen.queryByLabelText('Show')).toBeNull();
    expect(screen.queryAllByRole('combobox', { name: /^Show for/ })).toHaveLength(0);
    expect(screen.getByText(bound.show_code)).toBeTruthy();
  });
});

describe('editing a member by id (CR-37)', () => {
  it('moves a member to a show with a PATCH that carries only the show', async () => {
    reply = (c) => (c.method === 'PATCH' ? { body: bodyOf(detail, 'cr37_patch_show') } : undefined);
    const { calls } = mockFetch(server);
    mount(superuser);
    fireEvent.change(await showSelect(1), { target: { value: show.id } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(path(called(calls, 'PATCH'))).toBe(memberUrl(loose));
    // No status, roles or scope are sent back any more: a PATCH changes only what it carries.
    expect(called(calls, 'PATCH').body).toEqual({ show: show.id });
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('releases a member to the whole project with an explicit null', async () => {
    reply = (c) => (c.method === 'PATCH' ? { body: bodyOf(detail, 'cr37_patch_release_show') } : undefined);
    const { calls } = mockFetch(server);
    mount(superuser);
    fireEvent.change(await showSelect(0), { target: { value: '' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(path(called(calls, 'PATCH'))).toBe(memberUrl(bound));
    expect(called(calls, 'PATCH').body).toEqual({ show: null });
  });

  it('changes a status with its own value and offers the four the server knows', async () => {
    reply = (c) => (c.method === 'PATCH' ? { body: bodyOf(detail, 'cr37_patch_back') } : undefined);
    const { calls } = mockFetch(server);
    mount(superuser);
    const select = (await screen.findAllByRole('combobox', { name: /^Status for/ })) as HTMLSelectElement[];
    expect([...select[1].options].map((o) => o.value)).toEqual(['active', 'on_leave', 'suspended', 'terminated']);
    expect(select[1].value).toBe('suspended');
    fireEvent.change(select[1], { target: { value: 'active' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(path(called(calls, 'PATCH'))).toBe(memberUrl(loose));
    expect(called(calls, 'PATCH').body).toEqual({ status: 'active' });
  });

  it('will not let the signed-in person take their own membership off the project, and says why', async () => {
    mockFetch(server);
    mount(superuser);
    const select = (await screen.findAllByRole('combobox', { name: /^Status for/ })) as HTMLSelectElement[];
    expect(select[2].disabled).toBe(true);
    expect(select[2].title).toBe('You cannot take your own membership off the project.');
    expect(select[0].disabled).toBe(false);
    // Remove is offered for the other two members, never for their own row.
    expect(screen.queryByRole('button', { name: `Remove ${mine.name}` })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2);
  });

  it('shows the server’s refusal when it refuses a change', async () => {
    const refusal = detail.cr37_self_suspend;
    expect(refusal.status).toBe(400);
    reply = (c) => (c.method === 'PATCH' ? { status: refusal.status, body: refusal.body } : undefined);
    mockFetch(server);
    mount(superuser);
    const select = (await screen.findAllByRole('combobox', { name: /^Status for/ })) as HTMLSelectElement[];
    fireEvent.change(select[0], { target: { value: 'suspended' } });
    const messages = () => useNotificationStore.getState().notifications.map((n) => n.message);
    await waitFor(() => expect(messages()).toContain('You cannot take your own membership off the project.'));
    // Said once: the API client already reports a failed request, so the panel must not say it again.
    expect(messages().filter((m) => m === 'You cannot take your own membership off the project.')).toHaveLength(1);
  });

  it('sets a department by name when the field is left, clears it, and ignores an unchanged field', async () => {
    reply = (c) => (c.method === 'PATCH' ? { body: bodyOf(detail, 'cr37_patch_department') } : undefined);
    const { calls } = mockFetch(server);
    mount(superuser);
    const field = ((await screen.findAllByRole('textbox', { name: /^Department for/ })) as HTMLInputElement[])[1];
    fireEvent.blur(field); // unchanged: nothing is sent
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
    fireEvent.change(field, { target: { value: '  Comp ' } });
    fireEvent.blur(field);
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(path(called(calls, 'PATCH'))).toBe(memberUrl(loose));
    expect(called(calls, 'PATCH').body).toEqual({ department: 'Comp' });
  });
});

describe('removing a member (CR-37)', () => {
  it('asks first, then deletes the member by id', async () => {
    reply = (c) => (c.method === 'DELETE' ? { status: 204, body: null } : undefined);
    const { calls } = mockFetch(server);
    mount(superuser);
    fireEvent.click((await screen.findAllByRole('button', { name: /^Remove / }))[1]); // the second member: `loose`
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(await screen.findByText('Remove from the project?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(called(calls, 'DELETE'))).toBe(memberUrl(loose));
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const { calls } = mockFetch(server);
    mount(superuser);
    fireEvent.click((await screen.findAllByRole('button', { name: /^Remove / }))[1]);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });
});
