import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Notification } from '@/api/notifications/notifications';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { describeNotification, notificationPath } from '../describe';
import { newestSeen } from '../hooks';
import { NotificationBell } from '../NotificationBell';
import { NotificationsPage } from '../NotificationsPage';

/**
 * The bell and the notifications page (review pipeline RP-6, C-RP-23, Q-RP-36 and Q-RP-39), served from
 * docs/sync/samples/notifications/_notifications_flow.json.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('notifications/_notifications_flow.json');
const list = flow.artist_list.body.results as Notification[];
const of = (kind: Notification['kind'], rows: Notification[] = list) => rows.find((n) => n.kind === kind) as Notification;
const lead = flow.lead_list.body.results as Notification[];
const path = (c: MockCall) => new URL(c.url).pathname;
const BASE = '/api/v1/notifications/';

function server(c: MockCall): MockReply {
  const p = path(c);
  if (p === `${BASE}unread-count/`) return { body: flow.artist_unread_count.body };
  if (p === `${BASE}read-all/`) return { body: flow.artist_read_all.body };
  if (p.endsWith('/unread/')) return { body: flow.artist_unread_one.body };
  if (p.endsWith('/read/')) return { body: flow.artist_read_one.body };
  if (p === BASE) {
    const params = new URL(c.url).searchParams;
    if (params.get('kind') === 'version_status') return { body: flow.artist_list_kind_version_status.body };
    if (params.get('unread') === 'false') return { body: flow.artist_list_read.body };
    return { body: flow.artist_list.body };
  }
  return { status: 404, body: {} };
}

const Where: React.FC = () => {
  const location = useLocation();
  return <output aria-label="Location">{`${location.pathname}${location.search}`}</output>;
};

function mount(node: React.ReactNode, at = '/') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>
        {node}
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const location = () => screen.getByLabelText('Location').textContent;

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('what a row says and where it leads', () => {
  it('names the actor, the record and the statuses', () => {
    const who = of('task_assigned').actor?.name;
    expect(describeNotification(of('task_assigned'))).toBe(`${who} assigned you RPN_T1`);
    expect(describeNotification(of('version_status'))).toBe(`${who} moved your version RPN_SH010_COMP_V001 Pending Review → Retake`);
    expect(describeNotification(of('task_status'))).toBe(`${who} moved your task RPN_T1 In Progress → Pending Review`);
    expect(describeNotification(of('note_mention'))).toBe(`${who} mentioned you in “Edge is soft”`);
    expect(describeNotification(of('note_created'))).toBe(`${who} wrote a note on your work: “Edge is soft”`);
    expect(describeNotification(of('note_reply', lead))).toMatch(/ replied in “Edge is soft”$/);
    expect(describeNotification(of('note_status', lead))).toMatch(/ moved “Edge is soft” Open → Addressed$/);
  });

  it('a review movie has no actor; a failure says why in words', () => {
    expect(describeNotification(of('review_media_ready'))).toBe('The review movie of RPN_SH010_COMP_V001 is ready');
    expect(describeNotification(of('review_media_failed'))).toBe('The review movie of RPN_SH010_COMP_V001 failed: the proxy could not be made');
  });

  it('a task and a version open their page, a review movie the Media tab, a note the Notes of its record', () => {
    const task = of('task_assigned');
    const version = of('version_status');
    expect(notificationPath(task)).toBe(`/tasks/${task.target.id}`);
    expect(notificationPath(version)).toBe(`/versions/${version.target.id}`);
    expect(notificationPath(of('review_media_failed'))).toBe(`/versions/${version.target.id}?tab=media`);
    const note = of('note_created');
    expect(notificationPath(note)).toBe(`/versions/${note.record?.id}?tab=notes`);
    expect(notificationPath({ ...note, record: { type: 'Shot', id: 's1', code: 'SH' } })).toBe(`/projects/${note.project.id}/shots/s1/notes`);
    expect(notificationPath({ ...note, record: { type: 'Asset', id: 'a1', code: 'AS' } })).toBe(`/projects/${note.project.id}/assets/a1/notes`);
    expect(notificationPath({ ...note, record: null })).toBe(`/projects/${note.project.id}/notes`);
  });

  it('read-all stops at the newest row seen, whatever the order given', () => {
    expect(newestSeen([...list].reverse())).toBe(list[0].created_at);
    expect(newestSeen([])).toBeUndefined();
  });
});

describe('the bell', () => {
  it('shows the unread count and loads the rows only when opened', async () => {
    const { calls } = mockFetch(server);
    mount(<NotificationBell />);
    const bell = await screen.findByRole('button', { name: `Notifications, ${flow.artist_unread_count.body.count} unread` });
    expect(calls.some((c) => path(c) === BASE)).toBe(false);
    fireEvent.click(bell);
    const panel = await screen.findByRole('dialog', { name: 'Notifications' });
    await within(panel).findByText(describeNotification(list[0]));
    const listed = new URL(calls.find((c) => path(c) === BASE)?.url ?? '').searchParams;
    expect([listed.get('page'), listed.get('page_size')]).toEqual(['1', '20']);
  });

  it('no badge when nothing is unread', async () => {
    mockFetch((c) => (path(c) === `${BASE}unread-count/` ? { body: flow.artist_unread_count_after.body } : server(c)));
    mount(<NotificationBell />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy());
  });

  it('a row marks itself read and opens its record; the panel closes', async () => {
    const { calls } = mockFetch(server);
    mount(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /^Notifications/ }));
    const task = of('task_assigned');
    await screen.findByText(describeNotification(task));
    const row = screen.getAllByRole('button').find((b) => b.getAttribute('data-unread') && b.textContent?.includes(describeNotification(task))) as HTMLElement;
    fireEvent.click(row);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c) === `${BASE}${task.id}/read/`)).toBe(true));
    expect(location()).toBe(`/tasks/${task.target.id}`);
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });

  it('Mark all read sends the newest row shown as `before`', async () => {
    const { calls } = mockFetch(server);
    mount(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /^Notifications/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(calls.some((c) => path(c) === `${BASE}read-all/`)).toBe(true));
    expect(calls.find((c) => path(c) === `${BASE}read-all/`)?.body).toEqual({ before: list[0].created_at });
  });

  it('Escape closes the panel', async () => {
    mockFetch(server);
    mount(<NotificationBell />);
    fireEvent.click(await screen.findByRole('button', { name: /^Notifications/ }));
    await screen.findByRole('dialog', { name: 'Notifications' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).toBeNull();
  });
});

describe('the notifications page', () => {
  it('lists every row and filters by kind and by read state', async () => {
    const { calls } = mockFetch(server);
    mount(<NotificationsPage />, '/notifications');
    for (const n of list) await screen.findAllByText(describeNotification(n));
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'version_status' } });
    await waitFor(() => expect(calls.some((c) => new URL(c.url).searchParams.get('kind') === 'version_status')).toBe(true));
    await waitFor(() => expect(screen.queryByText(describeNotification(of('task_assigned')))).toBeNull());
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'false' } });
    await waitFor(() => expect(calls.some((c) => new URL(c.url).searchParams.get('unread') === 'false')).toBe(true));
  });

  it('an unread row can be marked read', async () => {
    const { calls } = mockFetch(server);
    mount(<NotificationsPage />, '/notifications');
    const fresh = of('task_assigned');
    fireEvent.click(await screen.findByRole('button', { name: `Mark read: ${describeNotification(fresh)}` }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map(path)).toEqual([`${BASE}${fresh.id}/read/`]));
    expect(screen.queryByRole('button', { name: `Mark unread: ${describeNotification(fresh)}` })).toBeNull();
  });

  it('a read row can be marked unread', async () => {
    const { calls } = mockFetch((c) => (path(c) === BASE ? { body: flow.artist_list_read.body } : server(c)));
    mount(<NotificationsPage />, '/notifications');
    const seen = (flow.artist_list_read.body.results as Notification[])[0];
    expect(seen.read_at).not.toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: `Mark unread: ${describeNotification(seen)}` }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map(path)).toEqual([`${BASE}${seen.id}/unread/`]));
  });

  it('on the first page, Mark all read stops at the newest row shown', async () => {
    const { calls } = mockFetch(server);
    mount(<NotificationsPage />, '/notifications');
    await screen.findAllByText(describeNotification(list[0]));
    await waitFor(() => expect((screen.getByRole('button', { name: 'Mark all read' }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(calls.some((c) => path(c) === `${BASE}read-all/`)).toBe(true));
    expect(calls.find((c) => path(c) === `${BASE}read-all/`)?.body).toEqual({ before: list[0].created_at });
  });
});
