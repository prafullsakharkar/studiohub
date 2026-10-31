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

describe('team workspace: members are team memberships', () => {
  const memberships = loadSample<Record<string, Captured>>('masterdata/_team_memberships_flow.json');
  const members = memberships.list_of_team.body.results as Array<{ id: string; team: string; team_name: string; person: string; person_name: string }>;
  const server = (c: MockCall): MockReply => {
    if (path(c) === `/api/v1/teams/${team.id}/`) return { body: teams.detail_admin.body };
    if (path(c) === '/api/v1/team-memberships/' && c.method === 'GET') return { body: params(c).team === team.id ? page(members) : page([]) };
    if (path(c) === '/api/v1/team-memberships/' && c.method === 'POST') return { status: 201, body: memberships.add_grace_to_comp.body };
    if (path(c).startsWith('/api/v1/team-memberships/') && c.method === 'DELETE') return { status: 204 };
    if (path(c) === '/api/v1/people/' && c.method === 'GET') return { body: people.list_admin.body };
    return { body: page([]) };
  };

  it('shows the number of members on the overview, as the API reports it', async () => {
    // The captured team has one member and capacity 1: use a count no other field can equal.
    const detail = { ...memberships.team_detail.body, member_count: 7 };
    mockFetch((c) => (path(c) === `/api/v1/teams/${detail.id}/` ? { body: detail } : { body: page([]) }));
    mount(<TeamWorkspacePage />, `/teams/${detail.id}`, '/teams/:id');
    const label = await screen.findByText('Members', { selector: 'dt' });
    expect(label.parentElement?.querySelector('dd')?.textContent).toBe('7');
  });

  it('lists the members of the team, found with the team filter on team-memberships', async () => {
    const { calls } = mockFetch(server);
    mount(<TeamWorkspacePage />, `/teams/${team.id}`, '/teams/:id');
    fireEvent.click(await screen.findByRole('tab', { name: 'Members' }));
    expect(await screen.findByRole('link', { name: members[0].person_name })).toBeTruthy();
    expect(calls.some((c) => path(c) === '/api/v1/team-memberships/' && params(c).team === team.id)).toBe(true);
    expect(calls.some((c) => path(c) === '/api/v1/people/' && params(c).team !== undefined)).toBe(false);
  });

  it('removes a member by deleting the membership, and adds one by creating it, without touching the person', async () => {
    const { calls } = mockFetch(server);
    mount(<TeamWorkspacePage />, `/teams/${team.id}`, '/teams/:id');
    fireEvent.click(await screen.findByRole('tab', { name: 'Members' }));
    fireEvent.click(await screen.findByRole('button', { name: `Remove ${members[0].person_name} from ${team.name}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(calls.find((c) => c.method === 'DELETE') as MockCall)).toBe(`/api/v1/team-memberships/${members[0].id}/`);

    fireEvent.click(await screen.findByRole('button', { name: 'Add member' }));
    await screen.findByRole('option', { name: secondPerson.full_name });
    fireEvent.change(screen.getByLabelText(/^Person/), { target: { value: secondPerson.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ team: team.id, person: secondPerson.id });
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);
  });

  it('shows the server’s reason when the person is already a member', async () => {
    mockFetch((c) => (path(c) === '/api/v1/team-memberships/' && c.method === 'POST' ? { status: 400, body: memberships.add_duplicate_400.body } : server(c)));
    mount(<TeamWorkspacePage />, `/teams/${team.id}`, '/teams/:id');
    fireEvent.click(await screen.findByRole('tab', { name: 'Members' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add member' }));
    await screen.findByRole('option', { name: secondPerson.full_name });
    fireEvent.change(screen.getByLabelText(/^Person/), { target: { value: secondPerson.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }));
    expect(await screen.findByText(/already a member/)).toBeTruthy();
  });
});

describe('a person’s teams tab: several teams', () => {
  const memberships = loadSample<Record<string, Captured>>('masterdata/_team_memberships_flow.json');
  const rows = teams.list_admin.body.results as Array<{ id: string; name: string }>;
  const mine = [{ ...memberships.add_ada_to_comp.body, team: rows[0].id, team_name: rows[0].name, person: 'p1' }];
  const server = (c: MockCall): MockReply => {
    if (path(c) === '/api/v1/teams/') return { body: teams.list_admin.body };
    if (path(c) === '/api/v1/team-memberships/' && c.method === 'GET') return { body: page(mine) };
    if (path(c) === '/api/v1/team-memberships/' && c.method === 'POST') return { status: 201, body: memberships.add_ada_to_lighting.body };
    if (path(c).startsWith('/api/v1/team-memberships/') && c.method === 'DELETE') return { status: 204 };
    return { body: page([]) };
  };
  const mountTab = (primaryTeamId: string | null = rows[0].id) => {
    const onSetPrimary = vi.fn(async () => undefined);
    mount(<PersonTeamsTab personId="p1" personName="Ada" primaryTeamId={primaryTeamId} onSetPrimary={onSetPrimary} />, '/x', '/x');
    return onSetPrimary;
  };

  it('marks the teams the person is in and the primary one, and asks only for this person’s memberships', async () => {
    const { calls } = mockFetch(server);
    mountTab();
    expect(await screen.findByRole('button', { name: `Leave ${rows[0].name}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Join ${rows[1].name}` })).toBeTruthy();
    expect(screen.getAllByText('Primary')).toHaveLength(1);
    expect(calls.find((c) => path(c) === '/api/v1/team-memberships/' && c.method === 'GET')).toBeTruthy();
    expect(params(calls.find((c) => path(c) === '/api/v1/team-memberships/') as MockCall).person).toBe('p1');
  });

  it('joins another team without leaving the first (a POST of the pair), and leaves one with a DELETE', async () => {
    const { calls } = mockFetch(server);
    mountTab();
    fireEvent.click(await screen.findByRole('button', { name: `Join ${rows[1].name}` }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ team: rows[1].id, person: 'p1' });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);

    fireEvent.click(await screen.findByRole('button', { name: `Leave ${rows[0].name}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Leave' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(calls.find((c) => c.method === 'DELETE') as MockCall)).toBe(`/api/v1/team-memberships/${mine[0].id}/`);
  });

  it('warns that leaving the primary team leaves the person without one, and says nothing of it for another team', async () => {
    mockFetch(server);
    mountTab(rows[0].id);
    fireEvent.click(await screen.findByRole('button', { name: `Leave ${rows[0].name}` }));
    expect(await within(await screen.findByRole('dialog')).findByText(/no primary team afterwards/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    cleanup();

    mockFetch(server);
    mountTab(rows[1].id);
    fireEvent.click(await screen.findByRole('button', { name: `Leave ${rows[0].name}` }));
    await within(await screen.findByRole('dialog')).findByText(/stay in their other teams/);
    expect(within(screen.getByRole('dialog')).queryByText(/no primary team afterwards/)).toBeNull();
  });

  it('chooses another team as the primary one through onSetPrimary, and clears it', async () => {
    mockFetch(server);
    const onSetPrimary = mountTab(rows[1].id);
    fireEvent.click(await screen.findByRole('button', { name: `Make ${rows[0].name} primary` }));
    await waitFor(() => expect(onSetPrimary).toHaveBeenLastCalledWith(rows[0].id));
    fireEvent.click(screen.getByRole('button', { name: 'Clear primary team' }));
    await waitFor(() => expect(onSetPrimary).toHaveBeenLastCalledWith(null));
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
