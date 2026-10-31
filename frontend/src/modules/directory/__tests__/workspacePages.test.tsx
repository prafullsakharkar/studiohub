import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { ClientWorkspacePage } from '@/modules/clients/pages/ClientWorkspacePage';
import { TeamWorkspacePage } from '@/modules/teams/pages/TeamWorkspacePage';
import { EditDepartmentPage } from '@/modules/departments/pages/EditDepartmentPage';
import { PersonTeamsTab } from '@/modules/people/components/PersonTeamsTab';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';

type Captured = { status: number; body: any };
const clients = loadSample<Record<string, Captured>>('masterdata/clients.json');
const teams = loadSample<Record<string, Captured>>('masterdata/teams.json');
const departments = loadSample<Record<string, Captured>>('masterdata/departments.json');
const people = loadSample<Record<string, Captured>>('masterdata/people.json');
const projects = loadSample<Record<string, Captured>>('production/projects.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;

const client = clients.detail_admin.body as { id: string; name: string; code: string; studio_type: string };
const team = teams.detail_admin.body as { id: string; name: string; code: string };
const [firstPerson, secondPerson] = people.list_admin.body.results as Array<{ id: string; full_name: string }>;

const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

function mount(ui: React.ReactElement, route: string, routePath: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path={routePath} element={ui} />
            <Route path="/clients" element={<p>Clients directory</p>} />
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

describe('client workspace', () => {
  const server = (c: MockCall): MockReply => {
    if (path(c) === `/api/v1/clients/${client.id}/`) {
      if (c.method === 'DELETE') return { status: 204 };
      if (c.method === 'PATCH') return { body: { ...clients.detail_admin.body, ...(c.body as object) } };
      return { body: clients.detail_admin.body };
    }
    if (path(c) === '/api/v1/projects/') {
      const rows = projects.list_admin.body.results as Array<Record<string, unknown>>;
      // The same name on one project, and a longer name that merely contains it on another.
      return { body: page([{ ...rows[0], client_name: client.name }, { ...rows[1], client_name: `${client.name} Pictures` }]) };
    }
    return { status: 200, body: page([]) };
  };

  it('shows the fields the API has, and nothing the API lacks', async () => {
    mockFetch(server);
    mount(<ClientWorkspacePage />, `/clients/${client.id}`, '/clients/:id');
    expect(await screen.findByRole('heading', { name: client.name })).toBeTruthy();
    const grid = screen.getByRole('region', { name: 'Client' });
    expect(within(grid).getByText(client.studio_type)).toBeTruthy();
    for (const absent of ['Website', 'City', 'Country']) expect(screen.queryByText(absent)).toBeNull();
  });

  it('lists the projects whose client name is exactly this client, found by searching the name', async () => {
    const { calls } = mockFetch(server);
    mount(<ClientWorkspacePage />, `/clients/${client.id}`, '/clients/:id');
    fireEvent.click(await screen.findByRole('tab', { name: 'Projects' }));
    const rows = projects.list_admin.body.results as Array<{ name: string }>;
    expect(await screen.findByText(rows[0].name)).toBeTruthy();
    expect(screen.queryByText(rows[1].name)).toBeNull();
    expect(calls.find((c) => path(c) === '/api/v1/projects/')).toBeTruthy();
    expect(params(calls.find((c) => path(c) === '/api/v1/projects/') as MockCall).search).toBe(client.name);
  });

  it('archives with a PATCH of the status and deletes with DELETE, then returns to the directory', async () => {
    const { calls } = mockFetch(server);
    mount(<ClientWorkspacePage />, `/clients/${client.id}`, '/clients/:id');
    fireEvent.click(await screen.findByRole('button', { name: 'Archive' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'Archived' });

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('Clients directory')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'DELETE').map(path)).toEqual([`/api/v1/clients/${client.id}/`]);
  });
});

describe('team workspace: membership is the person’s team', () => {
  const state = { members: [{ ...firstPerson, team: team.id, team_name: team.name }] as Array<Record<string, unknown>> };
  const server = (c: MockCall): MockReply => {
    if (path(c) === `/api/v1/teams/${team.id}/`) return { body: teams.detail_admin.body };
    if (path(c) === '/api/v1/people/' && c.method === 'GET') {
      // Only a request filtered by this team is answered with its members.
      return { body: page(params(c).team === team.id ? state.members : people.list_admin.body.results) };
    }
    if (path(c).startsWith('/api/v1/people/') && c.method === 'PATCH') return { body: { ...secondPerson, ...(c.body as object) } };
    return { body: page([]) };
  };

  it('lists the people of the team, found with the team filter', async () => {
    const { calls } = mockFetch(server);
    mount(<TeamWorkspacePage />, `/teams/${team.id}`, '/teams/:id');
    fireEvent.click(await screen.findByRole('tab', { name: 'Members' }));
    expect(await screen.findByRole('link', { name: firstPerson.full_name })).toBeTruthy();
    expect(calls.some((c) => path(c) === '/api/v1/people/' && params(c).team === team.id)).toBe(true);
  });

  it('removes a member by clearing the person’s team, and adds one by setting it', async () => {
    const { calls } = mockFetch(server);
    mount(<TeamWorkspacePage />, `/teams/${team.id}`, '/teams/:id');
    fireEvent.click(await screen.findByRole('tab', { name: 'Members' }));
    fireEvent.click(await screen.findByRole('button', { name: `Remove ${firstPerson.full_name} from ${team.name}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const removal = calls.find((c) => c.method === 'PATCH') as MockCall;
    expect(path(removal)).toBe(`/api/v1/people/${firstPerson.id}/`);
    expect(removal.body).toEqual({ team: null });

    fireEvent.click(await screen.findByRole('button', { name: 'Add member' }));
    await screen.findByRole('option', { name: secondPerson.full_name });
    fireEvent.change(screen.getByLabelText(/^Person/), { target: { value: secondPerson.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2));
    const addition = calls.filter((c) => c.method === 'PATCH')[1];
    expect(path(addition)).toBe(`/api/v1/people/${secondPerson.id}/`);
    expect(addition.body).toEqual({ team: team.id });
  });
});

describe('a person’s team tab', () => {
  it('marks the current team and saves a choice as the id of the team', async () => {
    const rows = teams.list_admin.body.results as Array<{ id: string; name: string }>;
    mockFetch((c) => (path(c) === '/api/v1/teams/' ? { body: teams.list_admin.body } : { body: page([]) }));
    const onAssign = vi.fn(async () => undefined);
    mount(<PersonTeamsTab currentTeamId={rows[0].id} onAssignTeam={onAssign} />, '/x', '/x');
    const current = await screen.findByRole('button', { name: new RegExp(rows[0].name) });
    expect(current.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(rows[1].name) }));
    expect(onAssign).toHaveBeenCalledWith(rows[1].id);
    fireEvent.click(screen.getByRole('button', { name: 'Remove from team' }));
    expect(onAssign).toHaveBeenLastCalledWith(null);
  });
});

describe('department edit', () => {
  it('loads the department’s own fields and saves a PATCH of fields the API has', async () => {
    const dept = departments.detail_admin.body as { id: string; name: string; code: string; department_type: string };
    const { calls } = mockFetch((c) => {
      if (path(c) === `/api/v1/departments/${dept.id}/`) return c.method === 'PATCH' ? { body: { ...dept, ...(c.body as object) } } : { body: dept };
      return { body: page([]) };
    });
    mount(<EditDepartmentPage />, `/departments/${dept.id}/edit`, '/departments/:id/edit');
    const name = (await screen.findByLabelText(/^Name/)) as HTMLInputElement;
    expect(name.value).toBe(dept.name);
    fireEvent.change(name, { target: { value: `${dept.name} 2` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const body = calls.find((c) => c.method === 'PATCH')?.body as Record<string, unknown>;
    expect(body.name).toBe(`${dept.name} 2`);
    expect(Object.keys(body).sort()).toEqual(['code', 'color', 'department_type', 'description', 'manager', 'name', 'parent', 'software_stack']);
  });
});
