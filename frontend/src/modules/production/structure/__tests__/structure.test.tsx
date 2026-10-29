import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const PID = flow.projects_list.body.results[0].id as string;
const project = flow.projects_list.body.results[0] as { id: string; name: string; code: string };

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

  it('the workflow cannot be changed once the project exists', async () => {
    mockFetch(() => ({ body: flow.projects_detail.body }));
    renderAt(`/projects/${PID}/edit`, superuser, <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />);
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(project.name));
    expect((screen.getByLabelText('Workflow') as HTMLSelectElement).disabled).toBe(true);
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
    await within(dialog).findByRole('option', { name: /EP150/ });
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
    mockFetch(() => reply(flow.members_get));
    renderAt('/x', artist, <Route path="/x" element={<MembersPanel projectId={PID} />} />);
    await screen.findByRole('table', { name: 'Project members' });
    expect(screen.queryByLabelText('Add a member by email')).toBeNull();
  });

  it('notes: requires a subject and posts it', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: flow.scoped_notes_post.body } : reply(flow.scoped_notes_after)));
    renderAt('/x', superuser, <Route path="/x" element={<NotesPanel projectId={PID} />} />);
    await screen.findByLabelText('Subject');
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Enter a subject')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Check the plates' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ subject: 'Check the plates' });
  });

  it('overview: shows the real counts from the summary route', async () => {
    mockFetch(() => reply(flow.scoped_summary));
    renderAt('/x', superuser, <Route path="/x" element={<OverviewPanel projectId={PID} />} />);
    const counts = await screen.findByLabelText('Project counts');
    expect(within(counts).getByText('sequences')).toBeTruthy();
  });
});
