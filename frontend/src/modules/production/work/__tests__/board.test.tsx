import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { BOARD_COLUMNS, TaskBoard } from '../TaskBoard';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_work_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const readOnly = { ...artist, permissions: artist.permissions.filter((p) => p !== 'task.update') } as User;

const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const tasks = flow.tasks_list.body.results as Array<{ id: string; code: string; title: string }>;
const inReview = { ...tasks[1], status: 'Pending Review' };
const board = (items: unknown[]) => ({ status: 200, body: { count: items.length, next: null, previous: null, results: items } });

function renderBoard(user: User, projectId?: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={['/tasks']}>
          <Routes>
            <Route path="/tasks" element={<TaskBoard projectId={projectId} />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
const dnd = { setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' };
const drag = (card: HTMLElement, column: HTMLElement) => {
  fireEvent.dragStart(card, { dataTransfer: dnd });
  const over = createEvent.dragOver(column, { dataTransfer: dnd });
  fireEvent(column, over);
  fireEvent.drop(column, { dataTransfer: dnd });
  return over.defaultPrevented; // a column that accepts the card cancels dragover
};

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('task board', () => {
  it('has a column per status and files each task under its own', async () => {
    mockFetch(() => board([...tasks.slice(0, 2), inReview].slice(0, 1).concat([inReview, tasks[2]])));
    renderBoard(artist);
    await screen.findByRole('article', { name: tasks[0].code });
    expect(BOARD_COLUMNS.map((c) => screen.getByRole('region', { name: c }).querySelector('h2')?.textContent)).toEqual([...BOARD_COLUMNS]);
    expect(within(screen.getByRole('region', { name: 'Not Started' })).getAllByRole('article')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Pending Review' })).getAllByRole('article')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Approved' })).queryAllByRole('article')).toHaveLength(0);
  });

  it('asks the server for the project and the caller’s own tasks only when told to', async () => {
    const { calls } = mockFetch(() => board(tasks));
    renderBoard(artist, 'proj-1');
    await screen.findByRole('article', { name: tasks[0].code });
    expect(q(calls[0])).toMatchObject({ project_id: 'proj-1', ordering: 'code', page_size: '500' });
    expect(q(calls[0]).assignee_id).toBeUndefined();
    fireEvent.click(screen.getByLabelText('Mine'));
    await waitFor(() => expect(calls.some((c) => q(c).assignee_id === artist.id)).toBe(true));
  });

  it('dropping a card on an allowed column PATCHes its status; a column the backend would refuse does not accept it', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? flow.tasks_status_in_progress : board(tasks)));
    renderBoard(artist);
    const card = await screen.findByRole('article', { name: tasks[0].code });
    expect(drag(card, screen.getByRole('region', { name: 'Approved' }))).toBe(false); // Not Started → Approved is refused by the server
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    expect(drag(card, screen.getByRole('region', { name: 'In Progress' }))).toBe(true);
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(path(patch)).toBe(`/api/v1/tasks/${tasks[0].id}/`);
    expect(patch.body).toEqual({ status: 'In Progress' });
  });

  it('a card in review can be dropped on Approved', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? flow.tasks_status_review : board([inReview])));
    renderBoard(artist);
    const card = await screen.findByRole('article', { name: inReview.code });
    expect(drag(card, screen.getByRole('region', { name: 'Approved' }))).toBe(true);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'Approved' }));
  });

  it('without task.update the cards cannot be dragged and have no status menu', async () => {
    mockFetch(() => board(tasks));
    renderBoard(readOnly);
    const card = await screen.findByRole('article', { name: tasks[0].code });
    expect(card.getAttribute('draggable')).toBe('false');
    expect(within(card).queryByLabelText(`Status of ${tasks[0].code}`)).toBeNull();
  });

  it('says so when the board shows only the first page of many tasks', async () => {
    mockFetch(() => ({ status: 200, body: { count: 900, next: 'x', previous: null, results: tasks } }));
    renderBoard(artist);
    expect(await screen.findByText(/Showing the first 3 of 900 tasks/)).toBeTruthy();
  });
});
