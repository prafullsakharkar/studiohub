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
import type { User } from '@/types/identity';
import { MembersPanel } from '../panels';

type Member = { id: string; user_id: string; show_id: string; show_code: string; role: string; roles: string[]; status: string; scope: string };
type Captured = { status: number; body: unknown };
const flow = loadSample<Record<string, Captured>>('production/_membership_show_flow.json');
const bodyOf = <T,>(name: string) => flow[name].body as T;
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const PID = (flow.ids as unknown as { project: string }).project;
const show = bodyOf<{ results: Array<{ id: string; code: string; name: string }> }>('shows_list').results[0];
// A member bound to the show (as the server answered after binding), and a suspended two-role member on the whole project.
const bound = bodyOf<{ results: Member[] }>('members_list').results[0];
const loose = bodyOf<Member>('other_add');
const members = { count: 2, results: [bound, loose] };

const path = (c: MockCall) => new URL(c.url).pathname;
let shows: unknown;
const server = (c: MockCall): MockReply => {
  if (path(c) === `/api/organizations/projects/${PID}/members/`) return c.method === 'POST' ? { body: bodyOf('other_readd_preserving') } : { body: members };
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

const posted = (calls: MockCall[]) => {
  const call = calls.find((c) => c.method === 'POST');
  if (!call) throw new Error('no POST was sent');
  return call;
};

const rowSelects = async () => (await screen.findAllByRole('combobox', { name: /^Show for/ })) as HTMLSelectElement[];

beforeEach(() => {
  shows = bodyOf('shows_list');
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
    const [first, second] = await rowSelects();
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
    expect(screen.getByText(bound.show_code)).toBeTruthy();
    expect(screen.getByText('Whole project')).toBeTruthy();
  });

  it('moves a member to a show by adding them again with their own role, roles, status and scope', async () => {
    const { calls } = mockFetch(server);
    mount(superuser);
    const [, second] = await rowSelects();
    fireEvent.change(second, { target: { value: show.id } });
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    // Without status/scope/roles the server would write "active", "PROJECT" and the one role: it reactivates a suspended
    // member and drops their other roles (captured: `other_readd_naive`).
    expect(posted(calls).body).toEqual({ user_id: loose.user_id, role: loose.role, roles: loose.roles, status: 'suspended', scope: loose.scope, show: show.id });
    expect(loose.status).toBe('suspended');
    expect(bodyOf<Member>('other_readd_naive').status).toBe('active');
    expect(bodyOf<Member>('other_readd_preserving').status).toBe('suspended');
  });

  it('releases a member to the whole project with an explicit null', async () => {
    const { calls } = mockFetch(server);
    mount(superuser);
    const [first] = await rowSelects();
    fireEvent.change(first, { target: { value: '' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const body = posted(calls).body as Record<string, unknown>;
    expect(body.user_id).toBe(bound.user_id);
    expect(body).toHaveProperty('show', null);
  });

  it('adds a member to a chosen show, and sends no show for the whole project', async () => {
    const { calls } = mockFetch(server);
    mount(superuser);
    await rowSelects();
    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: 'new@example.test' } });
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: show.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1));
    expect(posted(calls).body).toEqual({ email: 'new@example.test', role: 'Artist', show: show.id });

    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: 'again@example.test' } });
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'POST')[1].body).toEqual({ email: 'again@example.test', role: 'Artist' });
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
