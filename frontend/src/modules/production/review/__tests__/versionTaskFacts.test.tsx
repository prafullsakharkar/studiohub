import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { VersionWorkspace } from '../VersionWorkspace';

// RP-21: the version page names its task, the task's assignee and its reviewer, read from the task (Q-RP-97, Q-RP-98, Q-RP-99).
/** What the page reads of the captured version, task and refusal answers. */
interface Body {
  id: string;
  task_id?: string | null;
  code?: string;
  title?: string;
  reviewer_id?: string | null;
  [key: string]: unknown;
}
type Captured = { status: number; body: Body };
const flow = loadSample<Record<string, Captured>>('production/_version_task_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const reviewer = flow.me_reviewer.body as unknown as User;
const versionsOnly = flow.me_without_task_view.body as unknown as User;

const path = (c: MockCall) => new URL(c.url).pathname;
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const taskCalls = (calls: MockCall[]) => calls.filter((c) => path(c).startsWith('/api/v1/tasks/'));

/** Answers the version and its task as the capture did; anything else the page asks for is an empty list. */
function serve(version: Captured, task?: Captured) {
  return mockFetch((c) => {
    if (path(c) === `/api/v1/versions/${version.body.id}/`) return reply(version);
    if (task && path(c) === `/api/v1/tasks/${version.body.task_id}/`) return reply(task);
    return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
  });
}

function mount(version: Captured, user: User) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[`/versions/${version.body.id}`]}>
          <Routes>
            <Route path="/versions/:versionId" element={<VersionWorkspace />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

/** The overview's facts, by label. */
async function facts() {
  await screen.findByText('Artist');
  return (label: string) => {
    const term = screen.queryByText(label, { selector: 'dt' });
    return term ? (term.nextElementSibling as HTMLElement) : null;
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

describe('the version page names its task and who reviews it (RP-21)', () => {
  const task = flow.task_of_version.body;

  it('shows the task, linked to its page, its assignee and its reviewer', async () => {
    const { calls } = serve(flow.version_with_task, flow.task_of_version);
    mount(flow.version_with_task, admin);
    const link = await screen.findByRole('link', { name: `${task.code} · ${task.title}` });
    expect(link.getAttribute('href')).toBe(`/tasks/${task.id}`);
    const fact = await facts();
    expect(fact('Assignee')?.textContent).toBe('Artist Example');
    expect(fact('Reviewer')?.textContent).toBe('Supervisor Example');
    expect(taskCalls(calls).map(path)).toEqual([`/api/v1/tasks/${flow.version_with_task.body.task_id}/`]);
  });

  it('says “You” to the task’s reviewer', async () => {
    expect(task.reviewer_id).toBe(reviewer.id);
    serve(flow.version_with_task, flow.task_of_version);
    mount(flow.version_with_task, reviewer);
    await screen.findByRole('link', { name: `${task.code} · ${task.title}` });
    expect((await facts())('Reviewer')?.textContent).toBe('You');
  });

  it('a task with no reviewer shows an empty Reviewer', async () => {
    serve(flow.version_unreviewed, flow.task_without_reviewer);
    mount(flow.version_unreviewed, reviewer);
    await screen.findByRole('link', { name: /RVT_SH0010_ROTO/ });
    const fact = await facts();
    expect(fact('Reviewer')?.textContent).toBe('—');
    expect(fact('Assignee')?.textContent).toBe('Artist Example');
  });

  it('a version with no task shows none of the three and asks for no task', async () => {
    const { calls } = serve(flow.version_without_task);
    mount(flow.version_without_task, admin);
    const fact = await facts();
    for (const label of ['Task', 'Assignee', 'Reviewer']) expect(fact(label)).toBeNull();
    expect(taskCalls(calls)).toEqual([]);
  });

  it.each([
    ['a client member, answered 404 (the external scope)', 'version_as_client', 'task_as_client_404'],
    ['a role without task.view on the server, answered 403', 'version_without_task_view', 'task_without_task_view_403'],
  ])('%s: none of the three, and no error', async (_who, version, refusal) => {
    const { calls } = serve(flow[version], flow[refusal]);
    mount(flow[version], reviewer);
    await waitFor(() => expect(taskCalls(calls)).toHaveLength(1));
    const fact = await facts();
    await waitFor(() => expect(fact('Task')).toBeNull());
    for (const label of ['Assignee', 'Reviewer']) expect(fact(label)).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('without task.view the task is not asked for', async () => {
    expect(versionsOnly.permissions).not.toContain('task.view');
    const { calls } = serve(flow.version_without_task_view, flow.task_without_task_view_403);
    mount(flow.version_without_task_view, versionsOnly);
    const fact = await facts();
    expect(fact('Task')).toBeNull();
    expect(taskCalls(calls)).toEqual([]);
  });

  it('any other failure shows the three empty', async () => {
    serve(flow.version_with_task, { status: 500, body: { detail: 'Server error' } });
    mount(flow.version_with_task, admin);
    const fact = await facts();
    await waitFor(() => expect(fact('Task')?.textContent).toBe('—'));
    expect(fact('Assignee')?.textContent).toBe('—');
    expect(fact('Reviewer')?.textContent).toBe('—');
  });
});
