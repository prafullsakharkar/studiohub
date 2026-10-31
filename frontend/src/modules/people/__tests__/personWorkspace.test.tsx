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
import { PersonAssignmentsTab } from '../components/PersonAssignmentsTab';
import { PersonWorkspacePage } from '../pages/PersonWorkspacePage';

type Captured = { status: number; body: any };
const people = loadSample<Record<string, Captured>>('masterdata/people.json');
const tasks = loadSample<Record<string, Captured>>('production/tasks.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;

const person = people.detail_admin.body as { id: string; full_name: string; status: string };
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

function mount(ui: React.ReactElement, route = '/people/x', routePath = '/people/:id') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={routePath} element={ui} />
          </Routes>
        </MemoryRouter>
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

describe('person workspace', () => {
  const server = (c: MockCall): MockReply => {
    if (path(c) === `/api/v1/people/${person.id}/`) {
      if (c.method === 'PATCH') return { body: { ...people.detail_admin.body, ...(c.body as object) } };
      return { body: people.detail_admin.body };
    }
    if (path(c) === `/api/v1/people/${person.id}/deactivate/`) return { body: { ...people.detail_admin.body, status: 'inactive' } };
    return { body: page([]) };
  };

  it('shows the person’s own fields, with sensitive ones only when the API sends them', async () => {
    mockFetch(server);
    mount(<PersonWorkspacePage />, `/people/${person.id}`);
    expect(await screen.findByRole('heading', { name: person.full_name })).toBeTruthy();
    const grid = screen.getByRole('region', { name: 'Person' });
    expect(within(grid).getByText('Status')).toBeTruthy();
    for (const invented of ['Active Tasks', 'Logged Hours', 'MPAA Tier 3']) expect(screen.queryByText(invented)).toBeNull();
  });

  it('hides the sensitive fields when the API leaves them out', async () => {
    const { email, phone, security_clearance, date_of_birth, nationality, ...open } = people.detail_admin.body;
    void email; void phone; void security_clearance; void date_of_birth; void nationality;
    mockFetch((c) => (path(c) === `/api/v1/people/${person.id}/` ? { body: open } : { body: page([]) }));
    mount(<PersonWorkspacePage />, `/people/${person.id}`);
    await screen.findByRole('heading', { name: person.full_name });
    for (const gated of ['Email', 'Phone', 'Security clearance', 'Date of birth', 'Nationality']) expect(screen.queryByText(gated)).toBeNull();
  });

  it('saves the skills list as person.skills', async () => {
    const { calls } = mockFetch(server);
    mount(<PersonWorkspacePage />, `/people/${person.id}`);
    fireEvent.click(await screen.findByRole('tab', { name: 'Skills' }));
    fireEvent.change(await screen.findByLabelText('New skill'), { target: { value: 'Houdini' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ skills: ['Houdini'] });
  });

  it('deactivates through the lifecycle route', async () => {
    const { calls } = mockFetch(server);
    mount(<PersonWorkspacePage />, `/people/${person.id}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/people/${person.id}/deactivate/` && c.method === 'POST')).toBe(true));
  });
});

describe('a person’s assigned tasks', () => {
  it('asks for the tasks of the login, and says so when there is none', async () => {
    const { calls } = mockFetch((c) => (path(c) === '/api/v1/tasks/' ? { body: tasks.list_admin.body } : { body: page([]) }));
    mount(<PersonAssignmentsTab userId="user-1" personName="Ada" />, '/x', '/x');
    const first = (tasks.list_admin.body.results as Array<{ title: string }>)[0];
    expect(await screen.findByRole('link', { name: first.title })).toBeTruthy();
    expect(params(calls.find((c) => path(c) === '/api/v1/tasks/') as MockCall).assignee_id).toBe('user-1');
    cleanup();

    const none = mockFetch(() => ({ body: page([]) }));
    mount(<PersonAssignmentsTab userId={null} personName="Ada" />, '/x', '/x');
    expect(await screen.findByText(/has no login/)).toBeTruthy();
    expect(none.calls.some((c) => path(c) === '/api/v1/tasks/')).toBe(false);
  });
});
