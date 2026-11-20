import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Version } from '@/api/production/review';
import type { Task } from '@/api/production/work';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useVersionsListConfig } from '@/modules/production/review/versions';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { TaskWorkspace } from '../TaskWorkspace';

/** RP-26 (C-RP-61, Q-RP-117 to Q-RP-120): the task on the Versions list and a task's versions, against _version_task_list_flow.json. */
type Captured<T = unknown> = { status: number; body: T };
type Page<T> = { count: number; next: null; previous: null; results: T[] };
const flow = loadSample<Record<string, Captured>>('production/_version_task_list_flow.json');
const supervisor = flow.me_supervisor.body as User;
const tasksOnly = flow.me_without_version_view.body as User;
const all = flow.list_as_supervisor.body as Page<Version>;
const asClient = flow.list_as_client.body as Page<Version>;
const ofTask = flow.task_filter.body as Page<Version>;
const task = flow.task_as_supervisor.body as Task;
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => new URL(c.url).searchParams;
const empty = { count: 0, next: null, previous: null, results: [] };
const row = (code: string) => screen.getByText(new RegExp(`^${code} ·`)).closest('tr') as HTMLElement;
/** The Task cell of a version's row, found by the column's header. */
const taskCell = (code: string) => within(row(code)).getAllByRole('cell')[screen.getAllByRole('columnheader').findIndex((h) => h.textContent === 'Task')];

function VersionsList() {
  return <DirectoryListPage config={useVersionsListConfig()} />;
}

function mount(user: User, initial: string, routes: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

function server(versions: Page<Version>) {
  return (c: MockCall): MockReply => {
    if (path(c) === '/api/v1/versions/') return { body: params(c).get('task_id') ? ofTask : versions };
    if (path(c) === `/api/v1/tasks/${task.id}/`) return { body: task };
    return { body: empty };
  };
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

describe('the Versions list: the Task column (Q-RP-117, Q-RP-119)', () => {
  it('names each row’s task, linking to it with its title as the tooltip; "—" without one', async () => {
    mockFetch(server(all));
    mount(supervisor, '/versions', <Route path="/versions" element={<VersionsList />} />);
    await screen.findByText(/^RVL_SH0010_COMP_V001 ·/);
    expect(screen.getByRole('columnheader', { name: 'Task' })).toBeTruthy();
    const link = within(row('RVL_SH0010_LIGHT_V001')).getByRole('link', { name: 'RVL_SH0010_LIGHT' });
    expect(link.getAttribute('href')).toBe(`/tasks/${all.results.find((v) => v.code === 'RVL_SH0010_LIGHT_V001')?.task_id}`);
    expect(link.getAttribute('title')).toBe('Lighting');
    for (const code of ['RVL_SH0010_PLATE_V001', 'RVL_SH0010_ROTO_V001']) {
      expect(taskCell(code).textContent).toBe('—');
      expect(within(taskCell(code)).queryByRole('link')).toBeNull();
    }
  });

  it('a client member’s row says nothing of the task, though it has a task_id', async () => {
    expect(asClient.results[0].task_id).not.toBeNull();
    mockFetch(server(asClient));
    mount(supervisor, '/versions', <Route path="/versions" element={<VersionsList />} />);
    await screen.findByText(/^RVL_SH0010_COMP_V001 ·/);
    expect(taskCell('RVL_SH0010_COMP_V001').textContent).toBe('—');
    expect(screen.queryByRole('link', { name: 'RVL_SH0010_COMP' })).toBeNull();
  });

  it('the export has the task’s code, empty without one', () => {
    const { result } = renderHook(() => useVersionsListConfig(), {
      wrapper: ({ children }) => <AuthContext.Provider value={{ user: supervisor, refreshUser: vi.fn() } as unknown as AuthContextValue}>{children}</AuthContext.Provider>,
    });
    const columns = result.current.exportColumns ?? [];
    const task = columns.find((c) => c.header === 'Task');
    const byCode = (code: string) => all.results.find((v) => v.code === code) as Version;
    expect(task?.value(byCode('RVL_SH0010_LIGHT_V001'))).toBe('RVL_SH0010_LIGHT');
    expect(task?.value(byCode('RVL_SH0010_PLATE_V001'))).toBe('');
    expect(columns.map((c) => c.header).indexOf('Task')).toBe(columns.map((c) => c.header).indexOf('For') + 1);
  });

  it('a card names the task first', async () => {
    localStorage.setItem('studiohub.listView:/versions', 'cards');
    mockFetch(server(all));
    mount(supervisor, '/versions', <Route path="/versions" element={<VersionsList />} />);
    expect((await screen.findAllByText(/^RVL_SH0010_LIGHT •/)).length).toBe(1);
  });
});

describe('a task’s page: its versions (Q-RP-118)', () => {
  it('the Versions tab lists the task’s versions through task_id, newest first, each linking to its page', async () => {
    const { calls } = mockFetch(server(all));
    mount(supervisor, `/tasks/${task.id}`, <Route path="/tasks/:taskId" element={<TaskWorkspace />} />);
    fireEvent.click(await screen.findByRole('tab', { name: 'Versions' }));
    const table = await screen.findByRole('table', { name: 'Versions of this task' });
    const asked = calls.filter((c) => path(c) === '/api/v1/versions/');
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((c) => params(c).get('task_id') === task.id && params(c).get('ordering') === '-created_at')).toBe(true);
    for (const v of ofTask.results) {
      expect(within(table).getByRole('link', { name: `${v.code} · ${v.version_number}` }).getAttribute('href')).toBe(`/versions/${v.id}`);
    }
    expect(within(table).queryByText(/RVL_SH0010_LIGHT_V001/)).toBeNull();
  });

  it('no Versions tab, and no versions asked for, without version.view', async () => {
    const { calls } = mockFetch(server(all));
    mount(tasksOnly, `/tasks/${task.id}`, <Route path="/tasks/:taskId" element={<TaskWorkspace />} />);
    await screen.findByRole('tab', { name: 'Time' });
    expect(screen.queryByRole('tab', { name: 'Versions' })).toBeNull();
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/tasks/${task.id}/`)).toBe(true));
    expect(calls.some((c) => path(c) === '/api/v1/versions/')).toBe(false);
  });
});
