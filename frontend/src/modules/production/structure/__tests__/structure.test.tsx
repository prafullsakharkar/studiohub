import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { projectsFormConfig, projectsListConfig, sequencesConfig } from '../configs';
import { MembersPanel, NotesPanel, OverviewPanel } from '../panels';
import { openPicker } from '@/test/picker';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const notesFlow = loadSample<Record<string, Captured>>('production/_notes_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const PID = flow.projects_list.body.results[0].id as string;
const project = flow.projects_list.body.results[0] as { id: string; name: string; code: string };

/** Shows which record the route opened. */
const Opened = () => <div>{`opened ${useParams().id}`}</div>;

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
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

describe('projects list', () => {
  const listRoute = <Route path="/projects" element={<DirectoryListPage config={projectsListConfig} />} />;

  it('filters by the backend’s status and type values', async () => {
    const { calls } = mockFetch(() => reply(flow.projects_list));
    renderAt('/projects', superuser, listRoute);
    expect(await screen.findByRole('link', { name: project.name })).toBeTruthy();
    expect(path(calls[0])).toBe('/api/v1/projects/');

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'In Progress' } });
    await waitFor(() => expect(calls.some((c) => q(c).status === 'In Progress')).toBe(true));
  });

  it('"Archive" deletes the project (DELETE needs no body; POST …/archive/ does the same since CR-13) and the Archived view can restore it', async () => {
    const { calls } = mockFetch((c) => {
      if (c.method === 'DELETE') return { status: 204, body: null };
      if (c.method === 'POST') return reply(flow.projects_restore);
      return path(c).endsWith('/archived/') ? reply(flow.projects_archived_list) : reply(flow.projects_list);
    });
    renderAt('/projects', superuser, listRoute);
    await screen.findByRole('link', { name: project.name });

    fireEvent.click(screen.getByRole('button', { name: `Archive ${project.name}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(calls.find((c) => c.method === 'DELETE')!)).toBe(`/api/v1/projects/${PID}/`);
    expect(calls.some((c) => path(c).endsWith('/archive/'))).toBe(false);

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'archived' } });
    fireEvent.click(await screen.findByRole('button', { name: `Restore ${project.name}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c) === `/api/v1/projects/${PID}/restore/`)).toBe(true));
  });

  it('shows no create or archive controls to a user without project.create', async () => {
    mockFetch(() => reply(flow.projects_list));
    renderAt('/projects', artist, listRoute);
    await screen.findByRole('link', { name: project.name });
    expect(screen.queryByRole('link', { name: /new project/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Archive / })).toBeNull();
  });
});

describe('project form', () => {
  it('creates with the chosen type and workflow and shows the server’s duplicate-code error inline', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.projects_create_duplicate) : { body: { count: 0, next: null, previous: null, results: [] } }));
    renderAt('/projects/new', superuser, <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Alpha 2' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'ALPHA' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Episodic Series' } });
    fireEvent.change(screen.getByLabelText('Workflow'), { target: { value: 'episodic' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText('project with this code already exists.')).toBeTruthy();
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ name: 'Alpha 2', code: 'ALPHA', type: 'Episodic Series', workflow_type: 'episodic' });
  });

  it('reloads the session after a create, so the creator’s new membership is known before the detail route checks it', async () => {
    const refreshUser = vi.fn().mockResolvedValue(undefined);
    mockFetch((c) => (c.method === 'POST' ? { status: 201, body: flow.projects_detail.body } : { body: { count: 0, next: null, previous: null, results: [] } }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user: superuser, refreshUser } as unknown as AuthContextValue}>
          <MemoryRouter initialEntries={['/projects/new']}>
            <Routes>
              <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />
              <Route path="/projects/:id" element={<div>project detail</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Beta' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'BETA' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(await screen.findByText('project detail')).toBeTruthy();
    expect(refreshUser).toHaveBeenCalledTimes(1);
  });

  it('after saving an edit it returns to the project (a project’s PATCH answers without an id)', async () => {
    expect('id' in flow.projects_patch.body).toBe(false); // as captured from the backend
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? reply(flow.projects_patch) : { body: flow.projects_detail.body }));
    renderAt(
      `/projects/${PID}/edit`,
      superuser,
      <>
        <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />
        <Route path="/projects/:id" element={<Opened />} />
      </>
    );
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(project.name));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: `${project.name} 2` } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(`opened ${PID}`)).toBeTruthy();
    expect(calls.some((c) => c.method === 'PATCH' && path(c) === `/api/v1/projects/${PID}/`)).toBe(true);
  });

  it('the workflow cannot be changed once the project exists', async () => {
    mockFetch(() => ({ body: flow.projects_detail.body }));
    renderAt(`/projects/${PID}/edit`, superuser, <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />);
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(project.name));
    expect((screen.getByLabelText('Workflow') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('project form: approval roll-up (RP-3, C-RP-14)', () => {
  const rollup = loadSample<Record<string, Captured>>('production/_rollup_flow.json');
  const on = rollup.project_detail.body;
  const label = 'Approve the task when one of its versions is approved';

  it('shows the switch as the server has it and sends only that change when it is turned off', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? reply(rollup.patch_switch_off) : { body: on }));
    renderAt(
      `/projects/${on.id}/edit`,
      superuser,
      <>
        <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />
        <Route path="/projects/:id" element={<Opened />} />
      </>
    );
    const box = (await screen.findByLabelText(label)) as HTMLInputElement;
    await waitFor(() => expect(box.checked).toBe(true));
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(`opened ${on.id}`)).toBeTruthy();
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ approve_task_on_version_approval: false });
  });

  it('a new project sends the switch as chosen; it starts off', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(rollup.create_project_on) : { body: { count: 0, next: null, previous: null, results: [] } }));
    renderAt('/projects/new', superuser, <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />);
    const box = (await screen.findByLabelText(label)) as HTMLInputElement;
    expect(box.checked).toBe(false);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Roll-up' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'RPR' } });
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ code: 'RPR', approve_task_on_version_approval: true });
  });
});

describe('project form: budget (CR-55)', () => {
  // Captured after CR-55: the supervisor's project has no budget_usd, the producer's has it.
  const cr55 = loadSample<Record<string, Captured>>('production/_budget_counts_cr54_55_after.json');
  const asSupervisor = cr55.project_detail_vfx_supervisor.body;
  const asProducer = cr55.project_detail_production_admin.body;
  const editor = (...extra: string[]) => ({ ...artist, permissions: [...artist.permissions, 'project.create', 'project.update', ...extra] }) as User;
  const editRoutes = (
    <>
      <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />
      <Route path="/projects/:id" element={<Opened />} />
    </>
  );

  it('the captures agree with the rule: the field is absent without project.view_budget', () => {
    expect('budget_usd' in asSupervisor).toBe(false);
    expect(asProducer.budget_usd).toBe('4800000.00');
    expect(cr55.patch_budget_vfx_supervisor.status).toBe(403);
  });

  it('an editor without the code edits a project with no budget input and never sends one', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? reply(cr55.patch_name_vfx_supervisor) : { body: asSupervisor }));
    renderAt(`/projects/${asSupervisor.id}/edit`, editor(), editRoutes);

    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(asSupervisor.name));
    expect(screen.queryByLabelText('Budget (USD)')).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'BDG renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(`opened ${asSupervisor.id}`)).toBeTruthy();
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(patch.body).toEqual({ name: 'BDG renamed' });
  });

  it('an editor without the code creates a project with no budget input', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.projects_create_duplicate) : { body: { count: 0, next: null, previous: null, results: [] } }));
    renderAt('/projects/new', editor(), <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Gamma' } });
    expect(screen.queryByLabelText('Budget (USD)')).toBeNull();
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'GAMMA' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).not.toHaveProperty('budget_usd');
  });

  it('a holder of the code sees the budget and saves a change to it', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? reply(cr55.patch_name_vfx_supervisor) : { body: asProducer }));
    renderAt(`/projects/${asProducer.id}/edit`, editor('project.view_budget'), editRoutes);

    const budget = (await screen.findByLabelText('Budget (USD)')) as HTMLInputElement;
    await waitFor(() => expect(Number(budget.value)).toBe(4800000));
    fireEvent.change(budget, { target: { value: '5000000' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(`opened ${asProducer.id}`)).toBeTruthy();
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ budget_usd: 5000000 });
  });
});

describe('project form: vendors (CR-42)', () => {
  const cr42 = loadSample<Record<string, Captured>>('production/_vendor_ids_cr42_flow.json');
  const vendors = loadSample<Record<string, Captured>>('masterdata/vendors.json');
  // A project whose vendor "Ember FX" was deleted after it was added: the API still lists the id.
  const saved = cr42.project_detail_after_vendor_delete.body as { id: string; name: string; vendor_ids: string[] };
  const [northId, deletedId] = [cr42.vendor_rename_north.body.id as string, cr42.vendor_create_ember.body.id as string];
  const server = (c: MockCall): MockReply => {
    const p = path(c);
    if (c.method === 'PATCH') return reply(cr42.project_patch_live_only);
    if (p === `/api/v1/projects/${saved.id}/`) return reply(cr42.project_detail_after_vendor_delete);
    if (p === '/api/v1/vendors/') return reply(vendors.list_admin);
    if (p === `/api/v1/vendors/${northId}/`) return reply(cr42.vendor_rename_north);
    if (p === `/api/v1/vendors/${deletedId}/`) return reply(vendors.detail_404);
    return { body: { count: 0, next: null, previous: null, results: [] } };
  };
  const editRoute = <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />;
  const chips = () => within(screen.getByRole('list', { name: 'Chosen vendors' })).queryAllByRole('listitem').map((li) => li.textContent);

  it('shows the saved vendors by name; a deleted one is "Unknown vendor"', async () => {
    mockFetch(server);
    renderAt(`/projects/${saved.id}/edit`, superuser, editRoute);
    await waitFor(() => expect(chips()).toEqual(['Unknown vendor', 'Northlight Studios']));
    expect(saved.vendor_ids).toEqual([deletedId, northId]); // the saved order is kept
  });

  it('removing the unknown vendor sends the live ids only (the API refuses a deleted one)', async () => {
    const { calls } = mockFetch(server);
    renderAt(`/projects/${saved.id}/edit`, superuser, editRoute);
    await waitFor(() => expect(chips()).toContain('Unknown vendor'));
    fireEvent.click(screen.getByRole('button', { name: 'Remove Unknown vendor' }));
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ vendor_ids: [northId] });
  });

  it('an edit that leaves the vendors alone does not send them', async () => {
    const { calls } = mockFetch(server);
    renderAt(`/projects/${saved.id}/edit`, superuser, editRoute);
    await waitFor(() => expect(chips()).toContain('Unknown vendor'));
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ name: 'Renamed' });
  });

  it('a new project sends the vendors picked, in order', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.projects_create_duplicate) : server(c)));
    renderAt('/projects/new', superuser, <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Gamma' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'GAMMA' } });
    const { menu } = await openPicker('Vendors');
    const [first, second] = vendors.list_admin.body.results as { id: string; name: string }[];
    fireEvent.click(await within(menu).findByRole('option', { name: second.name }));
    fireEvent.click(within(menu).getByRole('option', { name: first.name }));
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toMatchObject({ vendor_ids: [second.id, first.id] });
  });
});

describe('project children and panels', () => {
  it('sequences: lists this project’s sequences, and the episode picker offers only this project’s episodes', async () => {
    const episodes = { count: 1, next: null, previous: null, results: flow.episodes_list.body.results };
    const { calls } = mockFetch((c) => {
      if (path(c) === '/api/v1/episodes/') return { body: episodes };
      return reply(flow.sequences_list_after_bulk);
    });
    renderAt('/x', superuser, <Route path="/x" element={<RelatedRecords config={sequencesConfig} parentId={PID} />} />);
    await screen.findByRole('table', { name: 'Sequences' });
    expect(q(calls.find((c) => path(c) === '/api/v1/sequences/')!).project).toBe(PID);

    fireEvent.click(screen.getByRole('button', { name: 'Add sequence' }));
    const dialog = await screen.findByRole('dialog');
    const { menu } = await openPicker(/^Episode/);
    expect(dialog.contains(menu)).toBe(true);
    await within(menu).findByRole('option', { name: /EP150/ });
    expect(calls.some((c) => path(c) === '/api/v1/episodes/' && q(c).project === PID)).toBe(true);
  });

  it('archiving a sequence posts to its archive route (not DELETE)', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.episodes_archive) : reply(flow.sequences_list_after_bulk)));
    const seq = flow.sequences_list_after_bulk.body.results[0] as { id: string; name: string; code: string };
    renderAt('/x', superuser, <Route path="/x" element={<RelatedRecords config={sequencesConfig} parentId={PID} />} />);
    fireEvent.click(await screen.findByRole('button', { name: `Archive ${seq.name || seq.code}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/sequences/${seq.id}/archive/`);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('members: adds by e-mail and shows the API’s "User not found." for an unknown address', async () => {
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return reply(flow.members_add_unknown);
      if (path(c) === '/api/v1/shows/') return reply(flow.shows_list);
      return reply(flow.members_get);
    });
    renderAt('/x', superuser, <Route path="/x" element={<MembersPanel projectId={PID} />} />);
    await screen.findByRole('table', { name: 'Project members' });

    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: 'nobody@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('User not found.')).toBeTruthy();
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/organizations/projects/${PID}/members/`);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ email: 'nobody@example.test', role: 'Artist' });
  });

  it('members: the add form is only for users who may update the project', async () => {
    mockFetch((c) => reply(path(c) === '/api/v1/shows/' ? flow.shows_list : flow.members_get));
    renderAt('/x', artist, <Route path="/x" element={<MembersPanel projectId={PID} />} />);
    await screen.findByRole('table', { name: 'Project members' });
    expect(screen.queryByLabelText('Add a member by email')).toBeNull();
  });

  it('notes: lists the threads, requires a subject and posts it about no record', async () => {
    const empty = { count: 0, next: null, previous: null, results: [] };
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return { status: 201, body: notesFlow.create_on_project.body };
      return new URL(c.url).pathname.endsWith('/notes/') ? reply(notesFlow.list) : { body: empty };
    });
    renderAt('/x', superuser, <Route path="/x" element={<NotesPanel projectId={PID} />} />);
    for (const row of notesFlow.list.body.results as Array<{ subject: string }>) expect(await screen.findByText(row.subject)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add note' }));
    expect(await within(dialog).findByText('Enter a subject')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    fireEvent.change(within(dialog).getByLabelText(/^Subject/), { target: { value: 'Check the plates' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ subject: 'Check the plates', body: '', category: 'General', links: [] });
  });

  it('overview: shows the real counts from the summary route', async () => {
    mockFetch(() => reply(flow.scoped_summary));
    renderAt('/x', superuser, <Route path="/x" element={<OverviewPanel projectId={PID} />} />);
    const counts = await screen.findByLabelText('Project counts');
    expect(within(counts).getByText('sequences')).toBeTruthy();
  });

  it('overview: the delivery count shows only with delivery.view, the server answering 0 without it (CR-54)', async () => {
    const cr54 = loadSample<Record<string, Captured>>('production/_budget_counts_cr54_55_after.json');
    expect(cr54.summary_artist.body.counts.deliveries).toBe(0);
    const noDeliveries = { ...artist, permissions: artist.permissions.filter((p) => p !== 'delivery.view') } as User;
    mockFetch(() => reply(cr54.summary_artist));
    renderAt('/x', noDeliveries, <Route path="/x" element={<OverviewPanel projectId={PID} />} />);
    const counts = await screen.findByLabelText('Project counts');
    expect(within(counts).getByText('shots')).toBeTruthy();
    expect(within(counts).queryByText('deliveries')).toBeNull();
    cleanup();

    mockFetch(() => reply(cr54.summary_lead_artist));
    renderAt('/x', { ...artist, permissions: [...artist.permissions, 'delivery.view'] } as User, <Route path="/x" element={<OverviewPanel projectId={PID} />} />);
    const term = within(await screen.findByLabelText('Project counts')).getByText('deliveries');
    expect(term.parentElement!.textContent).toBe('deliveries2');
  });
});
