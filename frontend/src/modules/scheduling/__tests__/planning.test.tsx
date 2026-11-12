import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { AssignmentsPage } from '../AssignmentsPage';
import { addDays, dayKey, weekOf, windowOf } from '../calendarModel';
import { EventWorkspace } from '../EventWorkspace';
import { bandOf, hoursInWindow, utilizationOf } from '../planningModel';
import { UtilizationPage } from '../UtilizationPage';

type Row = Record<string, any>;
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('scheduling/_flow.json');
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
const reader = withCodes('schedule.view');
const manager = withCodes('schedule.view', 'schedule.update');

const rowsOf = (key: string): Row[] => (Array.isArray(flow[key].body) ? flow[key].body : (flow[key].body.items ?? []));
const path = (c: MockCall) => new URL(c.url).pathname;
const param = (c: MockCall, name: string) => new URL(c.url).searchParams.get(name);
const bare = (list: unknown[]): MockReply => ({ status: 200, body: list });
const at = (key: string, hour: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour).toISOString();
};

// The captured resources and booking, with the hours and times set for the case under test.
const [alice, bob, node] = rowsOf('resources_list');
const captured = rowsOf('schedules_list')[0];
const slot = (resource: Row, start: string, end: string, status = 'Booked', extra: Row = {}) => ({ ...captured, id: `${resource.id}-${start}`, resource: resource.id, resource_name: resource.name, start_time: start, end_time: end, status, event: null, task: null, notes: '', ...extra });
const thisWeek = weekOf(dayKey(new Date()));

function open(ui: React.ReactElement, user: User = reader, initial = '/p') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/p" element={ui} />
            <Route path="/ev/:eventId" element={ui} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('planning arithmetic', () => {
  const start = new Date('2026-11-02T00:00:00Z');
  const end = new Date('2026-11-09T00:00:00Z');

  it('counts only the part of a booking that falls in the week', () => {
    expect(hoursInWindow({ start_time: '2026-11-03T09:00:00Z', end_time: '2026-11-03T17:00:00Z' }, start, end)).toBe(8);
    expect(hoursInWindow({ start_time: '2026-11-01T20:00:00Z', end_time: '2026-11-02T04:00:00Z' }, start, end)).toBe(4); // across the first edge
    expect(hoursInWindow({ start_time: '2026-11-08T22:00:00Z', end_time: '2026-11-09T06:00:00Z' }, start, end)).toBe(2); // across the last edge
    expect(hoursInWindow({ start_time: '2026-11-20T09:00:00Z', end_time: '2026-11-20T10:00:00Z' }, start, end)).toBe(0);
    expect(hoursInWindow({ start_time: 'nonsense', end_time: '2026-11-03T10:00:00Z' }, start, end)).toBe(0);
  });

  it('puts the bands at 70 and 100 percent', () => {
    expect([bandOf(0), bandOf(69), bandOf(70), bandOf(100), bandOf(101)]).toEqual(['under', 'under', 'optimal', 'optimal', 'over']);
  });

  it('counts booked and overbooked time, ignores blocked and available time and resources with no capacity, and ranks the fullest first', () => {
    const r = (id: string, name: string, capacity: number) => ({ ...alice, id, name, capacity_hours_per_week: capacity });
    const slots = [
      { resource: 'a', start_time: '2026-11-03T09:00:00Z', end_time: '2026-11-03T17:00:00Z', status: 'Booked' },
      { resource: 'a', start_time: '2026-11-04T09:00:00Z', end_time: '2026-11-04T13:00:00Z', status: 'Overbooked' },
      { resource: 'a', start_time: '2026-11-05T09:00:00Z', end_time: '2026-11-05T17:00:00Z', status: 'Blocked' },
      { resource: 'a', start_time: '2026-11-06T09:00:00Z', end_time: '2026-11-06T17:00:00Z', status: 'Available' },
      { resource: 'b', start_time: '2026-11-03T09:00:00Z', end_time: '2026-11-03T19:00:00Z', status: 'Booked' },
    ];
    const rows = utilizationOf([r('a', 'A', 24), r('b', 'B', 8), r('c', 'C', 0)], slots, start, end);
    expect(rows.map((x) => [x.resource.name, x.booked, x.percent, x.band])).toEqual([
      ['B', 10, 125, 'over'],
      ['A', 12, 50, 'under'],
    ]); // C has no capacity to measure; A's blocked and available time did not count
  });
});

describe('utilization', () => {
  const serve =
    (slots: unknown[], people = [alice, bob, node]) =>
    (c: MockCall): MockReply =>
      path(c).endsWith('/resources/') ? bare(people) : path(c).endsWith('/schedules/') ? bare(slots) : bare([]);
  const people = [{ ...alice, capacity_hours_per_week: 40 }, { ...bob, capacity_hours_per_week: 40 }, { ...node, capacity_hours_per_week: 10 }];
  const slots = [
    ...thisWeek.slice(0, 5).map((d) => slot(alice, at(d, 9), at(d, 17))), // 40 h of 40
    slot(bob, at(thisWeek[0], 9), at(thisWeek[0], 11)), // 2 h of 40
    slot(bob, at(thisWeek[1], 9), at(thisWeek[1], 17), 'Blocked'), // does not count
    slot(node, at(thisWeek[0], 8), at(thisWeek[0], 23)), // 15 h of 10
  ];

  it('sorts the resources into over capacity, well used and under-used, with the hours and the average', async () => {
    mockFetch(serve(slots, people));
    open(<UtilizationPage />);
    const over = within(await screen.findByRole('region', { name: 'Over capacity' }));
    expect(over.getByText(node.name)).toBeTruthy();
    expect(over.getByText(/150%/)).toBeTruthy();
    expect(over.getByRole('meter', { name: `${node.name} utilization` }).getAttribute('aria-valuenow')).toBe('100'); // the bar stops at full
    expect(within(screen.getByRole('region', { name: 'Well used' })).getByText(/100%/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Under-used' })).getByText(/5%/)).toBeTruthy();
    const summary = within(screen.getByLabelText('Summary'));
    expect(summary.getByText('85%')).toBeTruthy(); // (150 + 100 + 5) / 3
    expect(summary.getByText('Over capacity').nextElementSibling?.textContent).toBe('1');
  });

  it('asks for the week with time zones, and moves a week at a time', async () => {
    const { calls } = mockFetch(serve(slots, people));
    open(<UtilizationPage />);
    await screen.findByRole('region', { name: 'Well used' });
    const week = windowOf(thisWeek[0], thisWeek[6]);
    const bookingCall = () => calls.filter((c) => path(c).endsWith('/schedules/')).at(-1) as MockCall;
    expect([param(bookingCall(), 'start'), param(bookingCall(), 'end')]).toEqual([week.start, week.end]);
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    const before = windowOf(addDays(thisWeek[0], -7), addDays(thisWeek[0], -1));
    await waitFor(() => expect(param(bookingCall(), 'start')).toBe(before.start));
    expect(param(bookingCall(), 'end')).toBe(before.end);
    fireEvent.click(screen.getByRole('button', { name: 'This week' }));
    await waitFor(() => expect(param(bookingCall(), 'start')).toBe(week.start));
  });

  it('says so when no resource has a weekly capacity', async () => {
    mockFetch(serve([], people.map((p) => ({ ...p, capacity_hours_per_week: 0 }))));
    open(<UtilizationPage />);
    expect(await screen.findByText('No resources with a weekly capacity')).toBeTruthy();
  });
});

describe('assignments', () => {
  const task = work.tasks_list.body.results[0];
  const event = rowsOf('events_list')[0];
  const page = (results: unknown[]): MockReply => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });
  const serve = (c: MockCall): MockReply => {
    const p = path(c);
    if (p.endsWith('/resources/')) return bare([alice, bob]);
    if (p.endsWith('/schedules/'))
      return bare([
        slot(alice, at(thisWeek[0], 9), at(thisWeek[0], 12), 'Booked', { task: task.id, notes: '' }),
        slot(alice, at(thisWeek[1], 9), at(thisWeek[1], 10), 'Booked', { event: event.id }),
        slot(alice, at(thisWeek[2], 9), at(thisWeek[2], 11), 'Booked', { notes: 'Plate prep' }),
        slot(alice, at(thisWeek[3], 9), at(thisWeek[3], 17), 'Blocked'),
      ]);
    if (p.endsWith('/tasks/')) return page([task]);
    if (p.endsWith('/events/')) return bare([event]);
    return bare([]);
  };

  it('lists each booked resource with what each booking is for, and the free ones apart', async () => {
    mockFetch(serve);
    open(<AssignmentsPage />);
    const list = within(await screen.findByRole('list', { name: `Bookings of ${alice.name}` }));
    expect((await list.findByRole('link', { name: `${task.code} · ${task.title}` })).getAttribute('href')).toBe(`/tasks/${task.id}`);
    expect(list.getByRole('link', { name: event.title }).getAttribute('href')).toBe(`/scheduling/events/${event.id}`);
    expect(list.getByText('Plate prep')).toBeTruthy(); // not linked: its note says what it is
    expect(list.getAllByText('Blocked')).toHaveLength(2); // what it is, and its status
    expect(screen.getByText('6 h of 40 h')).toBeTruthy(); // 3 + 1 + 2 booked; the 8 blocked hours do not count against the capacity
    expect(within(screen.getByRole('region', { name: 'Nothing booked' })).getByRole('link', { name: bob.name })).toBeTruthy();
  });

  it('does not ask for tasks or events when no booking names one', async () => {
    const { calls } = mockFetch((c) => (path(c).endsWith('/resources/') ? bare([alice]) : path(c).endsWith('/schedules/') ? bare([slot(alice, at(thisWeek[0], 9), at(thisWeek[0], 10))]) : bare([])));
    open(<AssignmentsPage />);
    await screen.findByRole('list', { name: `Bookings of ${alice.name}` });
    expect(calls.some((c) => path(c).endsWith('/tasks/') || path(c).endsWith('/events/'))).toBe(false);
  });

  it('says so when nothing is booked, and moves a week at a time', async () => {
    const { calls } = mockFetch((c) => (path(c).endsWith('/resources/') ? bare([alice]) : bare([])));
    open(<AssignmentsPage />);
    expect(await screen.findByText('Nothing is booked this week.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    const next = windowOf(addDays(thisWeek[0], 7), addDays(thisWeek[0], 13));
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/schedules/') && param(c, 'start') === next.start)).toBe(true));
  });
});

describe('event page', () => {
  const detail = flow.events_detail.body;
  const crew = [slot(alice, detail.start_time, detail.end_time, 'Booked', { event: detail.id }), slot(bob, detail.start_time, detail.end_time, 'Booked', { event: detail.id })];
  const serve =
    (event: Row = detail) =>
    (c: MockCall): MockReply =>
      c.method === 'POST' ? { status: 200, body: { ...event, status: 'Completed' } } : path(c).endsWith(`/events/${detail.id}/`) ? { status: 200, body: event } : path(c).endsWith('/schedules/') ? bare(crew) : bare([]);

  it('shows when, where, the project, the meeting link and who is booked on it', async () => {
    const { calls } = mockFetch(serve());
    open(<EventWorkspace />, reader, `/ev/${detail.id}`);
    expect(await screen.findByRole('heading', { name: detail.title })).toBeTruthy();
    const facts = within(screen.getByLabelText('Event details'));
    expect(facts.getByText(detail.location)).toBeTruthy();
    expect(facts.getByRole('link', { name: detail.project_name }).getAttribute('href')).toBe(`/projects/${detail.project}`);
    expect(facts.getByRole('link', { name: 'Join' }).getAttribute('href')).toBe(detail.meeting_url);
    const booked = within(await screen.findByRole('list', { name: 'Booked on this event' }));
    expect(booked.getByRole('link', { name: alice.name }).getAttribute('href')).toBe(`/scheduling/resources/${alice.id}`);
    expect(booked.getAllByRole('listitem')).toHaveLength(2);
    expect(calls.some((c) => path(c).endsWith('/schedules/') && param(c, 'event') === detail.id)).toBe(true);
  });

  it('offers the status moves and Edit only to someone who may update events, and each move posts update-status', async () => {
    const { calls } = mockFetch(serve());
    open(<EventWorkspace />, manager, `/ev/${detail.id}`);
    await screen.findByRole('heading', { name: detail.title });
    const toolbar = within(screen.getByRole('toolbar', { name: 'Event actions' }));
    expect(toolbar.queryByRole('button', { name: `Mark ${detail.status}` })).toBeNull(); // not the status it already has
    expect(toolbar.getByRole('link', { name: 'Edit' }).getAttribute('href')).toBe(`/scheduling/events/${detail.id}/edit`);
    fireEvent.click(toolbar.getByRole('button', { name: 'Mark Completed' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST') as MockCall;
    expect(path(post)).toBe(`/api/v1/scheduling/events/${detail.id}/update-status/`);
    expect(post.body).toEqual({ status: 'Completed' });
    cleanup();

    mockFetch(serve());
    open(<EventWorkspace />, reader, `/ev/${detail.id}`);
    await screen.findByRole('heading', { name: detail.title });
    expect(screen.queryByRole('toolbar', { name: 'Event actions' })?.querySelectorAll('button, a').length ?? 0).toBe(0);
  });

  it('does not make a link of a meeting address that is not a web address', async () => {
    mockFetch(serve({ ...detail, meeting_url: 'javascript:alert(1)' }));
    open(<EventWorkspace />, reader, `/ev/${detail.id}`);
    await screen.findByRole('heading', { name: detail.title });
    expect(screen.queryByRole('link', { name: 'Join' })).toBeNull();
  });

  it('says so when nobody is booked on it', async () => {
    mockFetch((c) => (path(c).endsWith('/schedules/') ? bare([]) : serve()(c)));
    open(<EventWorkspace />, reader, `/ev/${detail.id}`);
    expect(await screen.findByText('Nobody is booked on this event.')).toBeTruthy();
  });
});
