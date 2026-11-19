import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Version } from '@/api/production/review';
import type { Task } from '@/api/production/work';
import type { Notification } from '@/api/notifications/notifications';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { NotificationsPage } from '@/modules/notifications/NotificationsPage';
import { useTasksListConfig } from '@/modules/production/work/tasks';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { useVersionsListConfig } from '../versions';

/** RP-24 (C-RP-58, Q-RP-109 to Q-RP-112): waiting for my review, against _review_queue_flow.json. */
type Captured<T = unknown> = { status: number; body: T };
type Page<T> = { count: number; next: null; previous: null; results: T[] };
const flow = loadSample<Record<string, Captured>>('production/_review_queue_flow.json');
const copies = loadSample<Record<string, Captured>>('notifications/_copy_to_review_flow.json');
const supervisor = flow.me_supervisor.body as User;
const queue = flow.to_review_supervisor.body as Page<Version>;
const everything = flow.versions_all_supervisor.body as Page<Version>;
const reviewed = flow.tasks_reviewed_by_supervisor.body as Page<Task>;
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => new URL(c.url).searchParams;
const lists = (calls: MockCall[], route: string) => calls.filter((c) => path(c) === route);
const empty = { count: 0, next: null, previous: null, results: [] };

const Where: React.FC = () => {
  const location = useLocation();
  return <output aria-label="Location">{`${location.pathname}${location.search}`}</output>;
};

function VersionsList() {
  return <DirectoryListPage config={useVersionsListConfig()} />;
}
function TasksList() {
  return <DirectoryListPage config={useTasksListConfig()} />;
}

function mount(initial: string, routes: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: supervisor, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

/** The versions route answers the captured queue for `to_review=mine`, and the whole list otherwise. */
function server(c: MockCall): MockReply {
  if (path(c) === '/api/v1/versions/') return { body: params(c).get('to_review') === 'mine' ? queue : everything };
  if (path(c) === '/api/v1/tasks/') return { body: params(c).get('reviewer_id') === supervisor.id ? reviewed : empty };
  return { body: empty };
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

describe('the Versions list: To review (C-RP-58, Q-RP-111)', () => {
  it('choosing To review: Mine asks the server for mine and lists its rows', async () => {
    const { calls } = mockFetch(server);
    mount('/versions', <Route path="/versions" element={<VersionsList />} />);
    await screen.findByText(new RegExp(everything.results[0].code));
    const select = screen.getByLabelText('Filter by to review') as HTMLSelectElement;
    expect([...select.options].map((o) => [o.value, o.text])).toEqual([
      ['', 'All to review'],
      ['mine', 'Mine'],
    ]);
    fireEvent.change(select, { target: { value: 'mine' } });
    await waitFor(() => expect(lists(calls, '/api/v1/versions/').some((c) => params(c).get('to_review') === 'mine')).toBe(true));
    for (const row of queue.results) await screen.findByText(new RegExp(row.code));
    const left = everything.results.filter((row) => !queue.results.some((q) => q.id === row.id));
    expect(left.length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText(new RegExp(left[0].code))).toBeNull());
  });

  it('never sends who: the value is "mine", whoever is signed in', async () => {
    const { calls } = mockFetch(server);
    mount('/versions?to_review=mine', <Route path="/versions" element={<VersionsList />} />);
    await screen.findByText(new RegExp(queue.results[0].code));
    const sent = lists(calls, '/api/v1/versions/').map((c) => params(c).get('to_review'));
    expect(sent).toEqual(sent.map(() => 'mine'));
    expect(sent.join()).not.toContain(supervisor.id);
  });
});

describe('a list starts with the filters its address names (RP-24)', () => {
  it('/versions?to_review=mine opens the list filtered, the select showing it', async () => {
    const { calls } = mockFetch(server);
    mount('/versions?to_review=mine', <Route path="/versions" element={<VersionsList />} />);
    await screen.findByText(new RegExp(queue.results[0].code));
    expect((screen.getByLabelText('Filter by to review') as HTMLSelectElement).value).toBe('mine');
    expect(lists(calls, '/api/v1/versions/').every((c) => params(c).get('to_review') === 'mine')).toBe(true);
  });

  it('a key the list does not offer, or a value a fixed filter does not have, is ignored', async () => {
    const { calls } = mockFetch(server);
    mount('/versions?to_review=theirs&reviewer=someone&tab=media&status=Pending%20Review', <Route path="/versions" element={<VersionsList />} />);
    await screen.findByText(new RegExp(everything.results[0].code));
    const first = params(lists(calls, '/api/v1/versions/')[0]);
    expect(first.get('to_review')).toBeNull();
    expect(first.get('reviewer')).toBeNull();
    expect(first.get('tab')).toBeNull();
    expect(first.get('status')).toBe('Pending Review'); // an offered key and value applies
  });

  it('the filters are the page’s own afterwards: All clears it', async () => {
    const { calls } = mockFetch(server);
    mount('/versions?to_review=mine', <Route path="/versions" element={<VersionsList />} />);
    await screen.findByText(new RegExp(queue.results[0].code));
    fireEvent.change(screen.getByLabelText('Filter by to review'), { target: { value: '' } });
    await waitFor(() => expect(params(lists(calls, '/api/v1/versions/').at(-1) as MockCall).get('to_review')).toBeNull());
  });
});

describe('the Tasks list: Reviewer: Me (C-RP-58)', () => {
  it('sends the signed-in person’s id as reviewer_id and lists the tasks they review', async () => {
    const { calls } = mockFetch(server);
    mount('/tasks', <Route path="/tasks" element={<TasksList />} />);
    const select = (await screen.findByLabelText('Filter by reviewer')) as HTMLSelectElement;
    expect([...select.options].map((o) => [o.value, o.text])).toEqual([
      ['', 'All reviewer'],
      [supervisor.id, 'Me'],
    ]);
    fireEvent.change(select, { target: { value: supervisor.id } });
    await waitFor(() => expect(lists(calls, '/api/v1/tasks/').some((c) => params(c).get('reviewer_id') === supervisor.id)).toBe(true));
    for (const row of reviewed.results) await screen.findByText(new RegExp(row.code));
    expect(reviewed.results.every((row) => row.reviewer_id === supervisor.id)).toBe(true);
  });
});

describe('the "copy to review" notice links to the queue (Q-RP-111)', () => {
  const notices = copies.supervisor_list.body as Page<Notification>;
  const others = copies.artist_list.body as Page<Notification>;

  it('a review_media_to_review row offers All waiting for my review, which opens the filtered list', async () => {
    expect(notices.results.map((n) => n.kind)).toEqual(['review_media_to_review']);
    mockFetch((c) => (path(c) === '/api/v1/notifications/' ? { body: notices } : path(c) === '/api/v1/notifications/unread-count/' ? { body: { count: 1 } } : { body: empty }));
    mount(
      '/notifications',
      <>
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="*" element={<Where />} />
      </>,
    );
    fireEvent.click(await screen.findByRole('link', { name: 'All waiting for my review' }));
    expect((await screen.findByLabelText('Location')).textContent).toBe('/versions?to_review=mine');
  });

  it('other kinds do not', async () => {
    expect(others.results.some((n) => n.kind === 'review_media_to_review')).toBe(false);
    mockFetch((c) => (path(c) === '/api/v1/notifications/' ? { body: others } : { body: empty }));
    mount('/notifications', <Route path="/notifications" element={<NotificationsPage />} />);
    await screen.findAllByRole('button', { name: /^Mark (un)?read/ });
    expect(screen.queryByRole('link', { name: 'All waiting for my review' })).toBeNull();
  });
});
