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
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { BOARD_COLUMNS } from '../TaskBoard';
import { useTasksListConfig } from '../tasks';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_work_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const readOnly = { ...artist, permissions: artist.permissions.filter((p) => p !== 'task.update') } as User;

const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
/** A request for the tasks themselves (the filters' own option lists are fetched too). */
const forTasks = (c: MockCall) => path(c) === '/api/v1/tasks/';
const tasks = flow.tasks_list.body.results as Array<{ id: string; code: string; title: string }>;
const inReview = { ...tasks[1], status: 'Pending Review' };
const board = (items: unknown[]) => ({ status: 200, body: { count: items.length, next: null, previous: null, results: items } });

function TasksScreen({ projectId }: { projectId?: string }) {
  return <DirectoryListPage config={useTasksListConfig(projectId ? { projectId } : undefined)} />;
}

/** The task list on its own page, switched to its Board view. */
async function renderBoard(user: User, projectId?: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={['/tasks']}>
          <Routes>
            <Route path="/tasks" element={<TasksScreen projectId={projectId} />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  await screen.findByRole('table', { name: 'Tasks' });
  fireEvent.click(screen.getByRole('button', { name: 'Board view' }));
}
const dnd = { setData: vi.fn(), getData: vi.fn(), effectAllowed: '', dropEffect: '' };
const drag = (card: HTMLElement, column: HTMLElement) => {
  fireEvent.dragStart(card, { dataTransfer: dnd });
  const over = createEvent.dragOver(column, { dataTransfer: dnd });
  fireEvent(column, over);
  fireEvent.drop(column, { dataTransfer: dnd });
  return over.defaultPrevented; // a column that accepts the card cancels dragover
};

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('task board', () => {
  it('has a column per status and files each task under its own', async () => {
    mockFetch(() => board([...tasks.slice(0, 2), inReview].slice(0, 1).concat([inReview, tasks[2]])));
    await renderBoard(artist);
    await screen.findByRole('article', { name: tasks[0].code });
    expect(BOARD_COLUMNS.map((c) => screen.getByRole('region', { name: c }).querySelector('h2')?.textContent)).toEqual([...BOARD_COLUMNS]);
    expect(within(screen.getByRole('region', { name: 'Not Started' })).getAllByRole('article')).toHaveLength(2);
    expect(within(screen.getByRole('region', { name: 'Pending Review' })).getAllByRole('article')).toHaveLength(1);
    expect(within(screen.getByRole('region', { name: 'Approved' })).queryAllByRole('article')).toHaveLength(0);
  });

  it('loads the board with the page’s own project, search and assignee filters, 500 at a time and in code order', async () => {
    const { calls } = mockFetch(() => board(tasks));
    await renderBoard(artist, 'proj-1');
    await screen.findByRole('article', { name: tasks[0].code });
    const boardCall = () => calls.filter((c) => forTasks(c) && q(c).page_size === '500').at(-1);
    expect(q(boardCall()!)).toMatchObject({ project_id: 'proj-1', ordering: 'code', page: '1', page_size: '500' });
    expect(q(boardCall()!).assignee_id).toBeUndefined();
    fireEvent.change(screen.getByLabelText('Filter by assignee'), { target: { value: artist.id } });
    await waitFor(() => expect(calls.some((c) => forTasks(c) && q(c).page_size === '500' && q(c).assignee_id === artist.id)).toBe(true));
    fireEvent.change(screen.getByLabelText('Search tasks'), { target: { value: 'comp' } });
    await waitFor(() => expect(calls.some((c) => forTasks(c) && q(c).page_size === '500' && q(c).search === 'comp')).toBe(true));
  });

  it('dropping a card on an allowed column PATCHes its status; a column the backend would refuse does not accept it', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? flow.tasks_status_in_progress : board(tasks)));
    await renderBoard(artist);
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
    await renderBoard(artist);
    const card = await screen.findByRole('article', { name: inReview.code });
    expect(drag(card, screen.getByRole('region', { name: 'Approved' }))).toBe(true);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'Approved' }));
  });

  it('without task.update the cards cannot be dragged and have no status menu', async () => {
    mockFetch(() => board(tasks));
    await renderBoard(readOnly);
    const card = await screen.findByRole('article', { name: tasks[0].code });
    expect(card.getAttribute('draggable')).toBe('false');
    expect(within(card).queryByLabelText(`Status of ${tasks[0].code}`)).toBeNull();
  });

  it('says so when the board shows only the first page of many tasks', async () => {
    mockFetch(() => ({ status: 200, body: { count: 900, next: 'x', previous: null, results: tasks } }));
    await renderBoard(artist);
    expect(await screen.findByText(/Showing the first 3 of 900 tasks/)).toBeTruthy();
  });

  describe('the cards and lanes', () => {
    const row = tasks[0] as any;
    const card = (over: Record<string, unknown>) => ({ ...row, ...over });

    it('a card shows its code and priority, the shot or asset, who has it, the hours and the due date; an empty lane says so', async () => {
      mockFetch(() => board([card({ status: 'In Progress', priority: 'High', due_date: '2099-03-04', assignee_name: 'Sarah Jenkins', entity_type: 'Shot', entity_code: 'SH0010' })]));
      await renderBoard(artist);
      const article = await screen.findByRole('article', { name: row.code });
      expect(within(article).getByRole('link', { name: row.code }).getAttribute('href')).toBe(`/tasks/${row.id}`);
      expect(within(article).getByText('High')).toBeTruthy();
      expect(within(article).getByText('SH0010')).toBeTruthy();
      expect(within(article).getByText('Sarah')).toBeTruthy(); // the first name, as the old board showed it
      expect(within(article).getByTitle('Logged / estimated')).toBeTruthy();
      expect(within(article).queryByLabelText('Overdue')).toBeNull();
      expect(within(screen.getByRole('region', { name: 'Retake' })).getByText('No tasks')).toBeTruthy();
      expect(within(screen.getByRole('region', { name: 'In Progress' })).getByText('1')).toBeTruthy(); // the lane's count
    });

    it('marks a task that is past due, but not one that is approved', async () => {
      mockFetch(() => board([card({ status: 'In Progress', due_date: '2020-01-02' }), card({ id: 'x2', code: 'DONE1', status: 'Approved', due_date: '2020-01-02' })]));
      await renderBoard(artist);
      const late = await screen.findByRole('article', { name: row.code });
      expect(within(late).getByLabelText('Overdue')).toBeTruthy();
      expect(within(screen.getByRole('article', { name: 'DONE1' })).queryByLabelText('Overdue')).toBeNull();
    });

    it('the arrows move a card one step along the usual path; each PATCHes the status', async () => {
      const { calls } = mockFetch((c) => (c.method === 'PATCH' ? flow.tasks_status_in_progress : board([card({ status: 'In Progress' })])));
      await renderBoard(artist);
      const article = await screen.findByRole('article', { name: row.code });
      fireEvent.click(within(article).getByRole('button', { name: `Move ${row.code} to Pending Review` }));
      await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
      expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'Pending Review' });
      fireEvent.click(within(article).getByRole('button', { name: `Move ${row.code} to Not Started` }));
      await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(2));
      expect(calls.filter((c) => c.method === 'PATCH')[1].body).toEqual({ status: 'Not Started' });
    });

    it('offers only moves that exist: nothing back from Not Started, nothing at all from Approved, a retake only goes forward', async () => {
      mockFetch(() => board([card({ status: 'Not Started' }), card({ id: 'a', code: 'A1', status: 'Approved' }), card({ id: 'r', code: 'R1', status: 'Retake' })]));
      await renderBoard(artist);
      await screen.findByRole('article', { name: row.code });
      const moves = (code: string) => within(screen.getByRole('article', { name: code })).queryAllByRole('button', { name: /^Move / }).map((b) => b.getAttribute('aria-label'));
      expect(moves(row.code)).toEqual([`Move ${row.code} to In Progress`]);
      expect(moves('A1')).toEqual([]);
      expect(moves('R1')).toEqual(['Move R1 to In Progress']);
    });

    it('without task.update there are no arrows', async () => {
      mockFetch(() => board([card({ status: 'In Progress' })]));
      await renderBoard(readOnly);
      const article = await screen.findByRole('article', { name: row.code });
      expect(within(article).queryAllByRole('button', { name: /^Move / })).toHaveLength(0);
    });
  });
});

describe('the Board view beside Table and Card', () => {
  const open = async (start: 'table' | 'board' = 'table', user: User = artist) => {
    const mock = mockFetch(() => board(tasks));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter initialEntries={['/tasks']}>
            <Routes>
              <Route path="/tasks" element={<TasksScreen />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    if (start === 'table') await screen.findByRole('table', { name: 'Tasks' });
    else await screen.findByRole('article', { name: tasks[0].code });
    return mock;
  };

  it('is a third choice on the same page: the table is the start, the board replaces it, and the table comes back', async () => {
    await open();
    expect(screen.getAllByRole('button', { name: /(Table|Card|Board) view/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Table view', 'Card view', 'Board view']);
    fireEvent.click(screen.getByRole('button', { name: 'Board view' }));
    await screen.findByRole('article', { name: tasks[0].code });
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeTruthy(); // the same page and header, with its search and filters
    expect(screen.getByLabelText('Search tasks')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(await screen.findByRole('table', { name: 'Tasks' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'In Progress' })).toBeNull();
  });

  it('asks for the table page only while the table is shown, and for the board set only while the board is', async () => {
    const { calls } = await open();
    expect(calls.filter((c) => forTasks(c) && q(c).page_size === '25')).toHaveLength(1);
    expect(calls.filter((c) => forTasks(c) && q(c).page_size === '500')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Board view' }));
    await screen.findByRole('article', { name: tasks[0].code });
    expect(calls.filter((c) => forTasks(c) && q(c).page_size === '500')).toHaveLength(1);
    expect(calls.filter((c) => forTasks(c) && q(c).page_size === '25')).toHaveLength(1);
  });

  it('is remembered for this screen, and the bulk tools and pager are not shown on the board', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Board view' }));
    await screen.findByRole('article', { name: tasks[0].code });
    expect(screen.queryByLabelText('Select all on this page')).toBeNull();
    expect(screen.queryByRole('navigation', { name: /pagination/i })).toBeNull();
    cleanup();
    const { calls } = await open('board');
    expect(screen.queryByRole('table')).toBeNull();
    expect(calls.filter((c) => forTasks(c) && q(c).page_size === '25')).toHaveLength(0); // started on the board, so the table page was never asked for
  });

  it('the archived view has no board: the choice is not offered there and the table shows', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Board view' }));
    await screen.findByRole('article', { name: tasks[0].code });
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'archived' } });
    expect(await screen.findByRole('table', { name: 'Tasks' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Board view' })).toBeNull();
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'active' } });
    expect(await screen.findByRole('article', { name: tasks[0].code })).toBeTruthy(); // back to the saved board
  });
});
