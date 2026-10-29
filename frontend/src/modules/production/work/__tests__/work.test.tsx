import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { notify } from '@/core/notifications/notify';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { tasksFormConfig, useTasksListConfig } from '../tasks';
import { timelogsFormConfig, useTimelogsListConfig } from '../timelogs';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_work_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

const logs = flow.timelogs_admin_list.body.results as Array<{ id: string; person_id: string; status: string; task_code: string; duration_hours: number }>;
const [leadsOwn, artistsSubmitted, artistsApproved] = logs;
/** The seeded lead-artist role (init_platform.PRODUCTION_LEAD_PERMISSIONS) adds these to an artist; the live capture exercised them. */
const lead = { ...artist, id: leadsOwn.person_id, permissions: [...artist.permissions, 'timelog.approve', 'timelog.view_all', 'shot.update', 'shot.approve', 'task.create'] } as User;

function ListPage({ which }: { which: 'tasks' | 'timelogs' }) {
  const tasks = useTasksListConfig();
  const timelogs = useTimelogsListConfig();
  return which === 'tasks' ? <DirectoryListPage config={tasks} /> : <DirectoryListPage config={timelogs} />;
}

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
  vi.restoreAllMocks();
});

describe('tasks list', () => {
  const route = <Route path="/tasks" element={<ListPage which="tasks" />} />;
  const first = flow.tasks_list.body.results[0] as { id: string; code: string; title: string };

  it('lists the real rows and offers only the moves the backend allows from Not Started', async () => {
    mockFetch(() => reply(flow.tasks_list));
    renderAt('/tasks', artist, route);
    await screen.findByRole('link', { name: `${first.code} · ${first.title}` });
    const menu = screen.getByLabelText(`Status of ${first.code}`) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.value)).toEqual(['Not Started', 'In Progress', 'Pending Review', 'Retake']); // no Approved, no On Hold (shots only), no Archived
  });

  it('changing the status PATCHes only the status; a refused move shows the server’s message', async () => {
    const error = vi.spyOn(notify, 'error').mockImplementation(() => undefined);
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? reply(flow.tasks_status_approved_direct) : reply(flow.tasks_list)));
    renderAt('/tasks', artist, route);
    await screen.findByRole('link', { name: `${first.code} · ${first.title}` });
    fireEvent.change(screen.getByLabelText(`Status of ${first.code}`), { target: { value: 'Retake' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(path(patch)).toBe(`/api/v1/tasks/${first.id}/`);
    expect(patch.body).toEqual({ status: 'Retake' });
    await waitFor(() => expect(error).toHaveBeenCalledWith(expect.stringContaining("A task cannot move from 'In Progress' to 'Approved'")));
  });

  it('filters with the backend’s own parameter names', async () => {
    const { calls } = mockFetch(() => reply(flow.tasks_list));
    renderAt('/tasks', artist, route);
    await screen.findByRole('link', { name: `${first.code} · ${first.title}` });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'Pending Review' } });
    fireEvent.change(screen.getByLabelText('Filter by priority'), { target: { value: 'High' } });
    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'Shot' } });
    fireEvent.change(screen.getByLabelText('Filter by assignee'), { target: { value: artist.id } });
    await waitFor(() => expect(calls.some((c) => q(c).assignee_id === artist.id && q(c).entity_type === 'Shot' && q(c).priority === 'High' && q(c).status === 'Pending Review')).toBe(true));
  });

  it('bulk status: ticked ids go to bulk-status as task_ids, and refusals are reported per cause (207)', async () => {
    const info = vi.spyOn(notify, 'info').mockImplementation(() => undefined);
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.tasks_bulk_status_forbidden_move) : reply(flow.tasks_list)));
    renderAt('/tasks', artist, route);
    await screen.findByRole('link', { name: `${first.code} · ${first.title}` });
    fireEvent.click(screen.getByLabelText(`Select ${first.code}`));
    fireEvent.click(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Set status' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Status'), { target: { value: 'Retake' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Set status' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe('/api/v1/tasks/bulk-status/');
    expect(post.body).toEqual({ task_ids: [first.id], status: 'Retake' });
    await waitFor(() => expect(info).toHaveBeenCalledWith(expect.stringContaining('1 refused (invalid_transition)')));
  });

  it('Assign needs a project: members can only be offered for one', async () => {
    mockFetch(() => reply(flow.tasks_list));
    renderAt('/tasks', artist, route);
    await screen.findByRole('link', { name: `${first.code} · ${first.title}` });
    fireEvent.click(screen.getByLabelText(`Select ${first.code}`));
    expect(within(screen.getByRole('toolbar')).queryByRole('button', { name: 'Assign' })).toBeNull();
    expect(within(screen.getByRole('toolbar')).getByRole('button', { name: 'Archive' })).toBeTruthy();
  });

  it('an artist can change status but cannot create tasks; archiving is task.update, so it is offered', async () => {
    mockFetch(() => reply(flow.tasks_list));
    renderAt('/tasks', artist, route);
    await screen.findByRole('link', { name: `${first.code} · ${first.title}` });
    expect(screen.queryByRole('link', { name: /New task/ })).toBeNull();
    expect(screen.getByRole('button', { name: `Archive ${first.code}` })).toBeTruthy();
  });
});

describe('time logs list: approval is for holders of timelog.approve, never for your own entries', () => {
  const route = <Route path="/timelogs" element={<ListPage which="timelogs" />} />;

  it('a lead can approve or reject an artist’s submitted log but not their own', async () => {
    mockFetch(() => reply(flow.timelogs_admin_list));
    renderAt('/timelogs', lead, route);
    await screen.findAllByRole('row');
    expect(screen.getAllByRole('button', { name: /^Approve / })).toHaveLength(1); // only the artist's Submitted log
    expect(screen.getAllByRole('button', { name: /^Reject / })).toHaveLength(1);
  });

  it('an artist is offered no approval at all', async () => {
    mockFetch(() => reply(flow.timelogs_admin_list));
    renderAt('/timelogs', artist, route);
    await screen.findAllByRole('row');
    expect(screen.queryByRole('button', { name: /^Approve / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Reject / })).toBeNull();
  });

  it('reject asks for a reason and sends it as rejection_reason; approve sends an empty body', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.timelogs_reject) : reply(flow.timelogs_admin_list)));
    renderAt('/timelogs', lead, route);
    await screen.findAllByRole('row');
    fireEvent.click(screen.getByRole('button', { name: /^Reject / }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText('Enter reason.')).toBeTruthy(); // refused before any request
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Wrong task' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/timelogs/${artistsSubmitted.id}/reject/`);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ rejection_reason: 'Wrong task' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /^Approve / }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    expect(path(calls.filter((c) => c.method === 'POST')[1])).toBe(`/api/v1/timelogs/${artistsSubmitted.id}/approve/`);
  });

  it('an approved log is final: no Edit, no Delete', async () => {
    mockFetch(() => reply(flow.timelogs_admin_list));
    renderAt('/timelogs', superuser, route);
    await screen.findAllByRole('row');
    expect(screen.queryByRole('link', { name: `Edit ${artistsApproved.task_code} ${(flow.timelogs_admin_list.body.results[2] as { date: string }).date}` })).toBeNull();
    expect(screen.getAllByRole('link', { name: /^Edit / })).toHaveLength(2); // the two Submitted logs only
  });

  it('a rejected log can be resubmitted by its owner, with a PATCH of the status', async () => {
    const rejected = { ...flow.timelogs_after_reject.body, id: 'rejected-1', person_id: artist.id, status: 'Rejected', rejection_reason: 'Wrong task' };
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? reply(flow.timelogs_patch_rejected) : { status: 200, body: { count: 1, next: null, previous: null, results: [rejected] } }));
    renderAt('/timelogs', artist, route);
    expect(await screen.findByText('Wrong task')).toBeTruthy(); // the reason is on the row
    fireEvent.click(screen.getByRole('button', { name: /^Resubmit / }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resubmit' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(path(calls.find((c) => c.method === 'PATCH')!)).toBe('/api/v1/timelogs/rejected-1/');
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ status: 'Submitted' });
  });
});

describe('forms', () => {
  it('CR-14: the time form refuses zero and negative hours before sending anything', async () => {
    const { calls } = mockFetch(() => reply(flow.tasks_list));
    renderAt('/timelogs/new', artist, <Route path="/timelogs/new" element={<DirectoryFormPage config={timelogsFormConfig} />} />);
    const hours = await screen.findByLabelText(/^Hours/);
    for (const bad of ['0', '-1']) {
      fireEvent.change(hours, { target: { value: bad } });
      fireEvent.click(screen.getByRole('button', { name: /create time log/i }));
      expect(await screen.findByText('Hours must be greater than zero.')).toBeTruthy();
    }
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('a new task links its shot with entity_type + entity_id, never shot_id; the link field appears only for a linked type', async () => {
    const shot = flow.shots_list.body.results[0] as { id: string; code: string; name: string };
    const projectRow = loadSample<Record<string, Captured>>('production/_structure_flow.json').projects_list.body.results[0] as { id: string; code: string; name: string };
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return reply(flow.tasks_create);
      const p = path(c);
      if (p === '/api/v1/shots/') return reply(flow.shots_list);
      if (p.startsWith('/api/v1/projects')) return { status: 200, body: { count: 1, next: null, previous: null, results: [projectRow] } };
      return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
    });
    renderAt('/tasks/new', lead, <Route path="/tasks/new" element={<DirectoryFormPage config={tasksFormConfig} />} />);
    await screen.findByLabelText(/^Code/);
    expect(screen.queryByLabelText(/^Shot/)).toBeNull(); // General by default: nothing to link
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'T900' } });
    fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Comp the walk' } });
    fireEvent.change(screen.getByLabelText('About'), { target: { value: 'Shot' } });
    fireEvent.change(await screen.findByLabelText(/^Project/), { target: { value: projectRow.id } });
    await screen.findByRole('option', { name: new RegExp(shot.code) }); // the picker lists the project's shots once a project is chosen
    fireEvent.change(screen.getByLabelText(/^Shot/), { target: { value: shot.id } });
    fireEvent.click(screen.getByRole('button', { name: /create task/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const body = calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>;
    expect(body).toMatchObject({ project: projectRow.id, code: 'T900', title: 'Comp the walk', entity_type: 'Shot', entity_id: shot.id, priority: 'Medium' });
    expect(body).not.toHaveProperty('shot_id');
    expect(q(calls.find((c) => path(c) === '/api/v1/shots/')!).project_id).toBe(projectRow.id); // the picker lists that project's shots only
  });
});
