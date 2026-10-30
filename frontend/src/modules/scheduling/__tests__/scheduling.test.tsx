import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { CalendarPage } from '../CalendarPage';
import { CapacityPage } from '../CapacityPage';
import { bookingFormConfig, eventFormConfig, useBookingsListConfig, useCalendarsListConfig, useEventsListConfig, useLeavesListConfig, useMilestonesListConfig, useResourcesListConfig } from '../records';
import { ResourceWorkspace } from '../ResourceWorkspace';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('scheduling/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
/** What an artist holds in the seeded matrix: read, and create (own leave, events). */
const reader = withCodes('schedule.view', 'schedule.create');
/** The production-admin: manage, approve, update, delete and the rates. */
const manager = withCodes('schedule.view', 'schedule.create', 'schedule.manage', 'schedule.approve', 'schedule.update', 'schedule.delete', 'schedule.view_rates');

const rows = (key: string): any[] => flow[key].body.items ?? flow[key].body;
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => new URL(c.url).searchParams;
const writes = (calls: MockCall[]) => calls.filter((c) => c.method !== 'GET');
const bare = (list: any[]): MockReply => ({ status: 200, body: list });

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
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
  useNotificationStore.setState({ notifications: [] } as never);
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('resources', () => {
  const List = () => <DirectoryListPage config={useResourcesListConfig()} />;
  const route = <Route path="/r" element={<List />} />;
  const list = () => rows('resources_list');

  it('shows the derived status, and a rate column only to whoever holds schedule.view_rates', async () => {
    mockFetch(() => bare(list()));
    renderAt('/r', manager, route);
    await screen.findByText(/ALICE · Alice Artist/);
    expect(screen.getByRole('columnheader', { name: 'Rate' })).toBeTruthy();
    expect(screen.getByText('$55.00/h')).toBeTruthy();
    cleanup();
    mockFetch(() => bare(list().map((r) => ({ ...r, hourly_rate_usd: null }))));
    renderAt('/r', reader, route);
    await screen.findByText(/ALICE · Alice Artist/);
    expect(screen.queryByRole('columnheader', { name: 'Rate' })).toBeNull();
  });

  it('asks the server for the chosen type and status (CR-25)', async () => {
    const { calls } = mockFetch(() => bare(list()));
    renderAt('/r', manager, route);
    await screen.findByText(/RN1 · Render node 1/);
    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'Equipment' } });
    await waitFor(() => expect(calls.some((c) => params(c).get('resource_type') === 'Equipment')).toBe(true));
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'On Leave' } });
    await waitFor(() => expect(calls.some((c) => params(c).get('status') === 'On Leave')).toBe(true));
  });

  it('New needs schedule.manage; delete needs schedule.delete', async () => {
    mockFetch(() => bare(list()));
    renderAt('/r', reader, route);
    await screen.findByText(/ALICE · Alice Artist/);
    expect(screen.queryByRole('link', { name: /new resource/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
    cleanup();
    mockFetch(() => bare(list()));
    renderAt('/r', manager, route);
    await screen.findByText(/ALICE · Alice Artist/);
    expect(screen.getByRole('link', { name: /new resource/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Delete ALICE/ })).toBeTruthy();
  });
});

describe('bookings', () => {
  it('sends the typed time as a UTC instant with a zone, and shows the server’s overlap sentence', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.schedules_create_overlap) : { status: 200, body: { count: 1, next: null, previous: null, results: [{ id: 'r-1', code: 'ALICE', name: 'Alice Artist' }] } }));
    renderAt('/scheduling/bookings/new?resource=r-1', manager, <Route path="/scheduling/bookings/new" element={<DirectoryFormPage config={bookingFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Starts/), { target: { value: '2026-11-02T12:00' } });
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: '2026-11-02T15:00' } });
    fireEvent.click(screen.getByRole('button', { name: /create booking/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    const body = writes(calls)[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ resource: 'r-1', status: 'Booked' });
    expect(String(body.start_time)).toMatch(/Z$/);
    expect(String(body.end_time)).toMatch(/Z$/);
    expect(await screen.findByText(/already taken by booking/)).toBeTruthy();
  });

  it('deletes the ticked bookings in one call and reports the ones not found', async () => {
    const list = rows('schedules_list');
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 207, body: flow.schedules_bulk_delete_partial.body } : bare(list)));
    const List = () => <DirectoryListPage config={useBookingsListConfig()} />;
    renderAt('/b', manager, <Route path="/b" element={<List />} />);
    fireEvent.click(await screen.findByRole('checkbox', { name: `Select ${list[0].resource_code} ${new Date(list[0].start_time).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete bookings' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete bookings' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe('/api/v1/scheduling/schedules/bulk-delete/');
    expect((writes(calls)[0].body as { ids: string[] }).ids).toHaveLength(1);
    await waitFor(() => expect(useNotificationStore.getState().notifications.map((n) => n.message).join(' ')).toMatch(/1 deleted, 1 not found/));
  });
});

describe('leave', () => {
  const List = () => <DirectoryListPage config={useLeavesListConfig()} />;
  const route = <Route path="/l" element={<List />} />;
  const pending = () => rows('leaves_list_manager').filter((l) => l.status === 'Pending')[0];

  it('offers Approve and Reject on a pending request, to an approver only', async () => {
    mockFetch(() => bare([pending()]));
    renderAt('/l', manager, route);
    await screen.findByText(/ALICE · Alice Artist/);
    expect(screen.getByRole('button', { name: /^Approve/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Reject/ })).toBeTruthy();
    cleanup();
    mockFetch(() => bare([pending()]));
    renderAt('/l', reader, route);
    await screen.findByText(/ALICE · Alice Artist/);
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
    expect(screen.getByRole('link', { name: /new leave request/i })).toBeTruthy(); // an artist files their own
  });

  it('a decided request offers neither; rejecting needs a reason and posts it', async () => {
    const decided = { ...pending(), id: 'l-done', status: 'Approved' };
    mockFetch(() => bare([decided]));
    renderAt('/l', manager, route);
    await screen.findByText(/ALICE · Alice Artist/);
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Edit/ })).toBeNull(); // only a pending request is edited
    cleanup();

    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.leaves_reject) : bare([pending()])));
    renderAt('/l', manager, route);
    await screen.findByText(/ALICE · Alice Artist/);
    fireEvent.click(screen.getByRole('button', { name: /^Reject/ }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Reject' }));
    expect(await dialog.findByText("Enter reason.")).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(dialog.getByLabelText(/^Reason/), { target: { value: "Need a doctor's note" } });
    fireEvent.click(dialog.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/scheduling/leaves/${pending().id}/reject/`);
    expect(writes(calls)[0].body).toEqual({ rejection_reason: "Need a doctor's note" });
  });

  it('shows the person’s reason when the server sent it and nothing when it did not', async () => {
    mockFetch(() => bare(rows('leaves_list_lead')));
    renderAt('/l', reader, route);
    await screen.findByText(/BOB · Bob Lead/);
    expect(screen.getByText('Flu')).toBeTruthy();
    expect(screen.queryByText('Holiday trip')).toBeNull();
  });
});

describe('milestones', () => {
  it('Complete is offered until it is Completed, then Reopen; a project’s list is scoped by id', async () => {
    const list = rows('milestones_list');
    const open = list.find((m) => m.status !== 'Completed');
    const done = { ...open, id: 'm-done', name: 'Finished one', status: 'Completed' };
    const { calls } = mockFetch(() => bare([open, done]));
    const Scoped = () => <DirectoryListPage config={useMilestonesListConfig({ projectId: 'p-9' })} />;
    renderAt('/m', manager, <Route path="/m" element={<Scoped />} />);
    await screen.findByText(open.name);
    expect(screen.getByRole('button', { name: new RegExp(`^Complete ${open.name}`) })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Reopen Finished one/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Complete Finished one/ })).toBeNull();
    expect(screen.queryByLabelText('Filter by project')).toBeNull();
    expect(calls.some((c) => path(c) === '/api/v1/scheduling/milestones/' && params(c).get('project_id') === 'p-9')).toBe(true);
  });

  it('posts complete and reopen to their own routes', async () => {
    const open = rows('milestones_list').find((m) => m.status !== 'Completed');
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.milestones_complete) : bare([open])));
    const List = () => <DirectoryListPage config={useMilestonesListConfig()} />;
    renderAt('/m', manager, <Route path="/m" element={<List />} />);
    await screen.findByText(open.name);
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Complete ${open.name}`) }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Complete' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/scheduling/milestones/${open.id}/complete/`);
  });
});

describe('work calendars', () => {
  it('Make default is offered to a calendar that is not the default; the default and a calendar in use cannot be deleted', async () => {
    const [studio] = rows('calendars_list');
    const others = [
      { ...studio, id: 'c-default', code: 'DEF', name: 'Default one', is_default: true, resource_count: 0 },
      { ...studio, id: 'c-used', code: 'USED', name: 'Used one', is_default: false, resource_count: 3 },
      { ...studio, id: 'c-free', code: 'FREE', name: 'Free one', is_default: false, resource_count: 0 },
    ];
    mockFetch(() => bare(others));
    const List = () => <DirectoryListPage config={useCalendarsListConfig()} />;
    renderAt('/c', manager, <Route path="/c" element={<List />} />);
    await screen.findByText(/DEF · Default one/);
    expect(screen.queryByRole('button', { name: /^Make default Default one/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Make default Used one/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Delete Default one/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete Used one/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Delete Free one/ })).toBeTruthy();
  });
});

describe('events', () => {
  it('an artist creates events but is offered no status change, edit or delete (those need schedule.update / delete)', async () => {
    mockFetch(() => bare(rows('events_list')));
    const List = () => <DirectoryListPage config={useEventsListConfig()} />;
    renderAt('/e', reader, <Route path="/e" element={<List />} />);
    await screen.findByText('Dailies');
    expect(screen.getByRole('link', { name: /new event/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Mark/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
    cleanup();
    mockFetch(() => bare(rows('events_list')));
    renderAt('/e', manager, <Route path="/e" element={<List />} />);
    await screen.findByText('Dailies');
    expect(screen.getByRole('button', { name: /^Mark Completed Dailies/ })).toBeTruthy();
  });

  it('the form sends start_time and end_time with a zone (the old start_date form was a 400)', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.events_create) : { status: 200, body: { count: 0, next: null, previous: null, results: [] } }));
    renderAt('/scheduling/events/new', reader, <Route path="/scheduling/events/new" element={<DirectoryFormPage config={eventFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^Title/), { target: { value: 'Dailies' } });
    fireEvent.change(screen.getByLabelText(/^Starts/), { target: { value: '2026-11-04T10:00' } });
    fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: '2026-11-04T11:00' } });
    fireEvent.click(screen.getByRole('button', { name: /create event/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    const body = writes(calls)[0].body as Record<string, unknown>;
    expect(body).toMatchObject({ title: 'Dailies' });
    expect(String(body.start_time)).toMatch(/Z$/);
    expect(body).not.toHaveProperty('start_date');
  });
});

/** Click the month buttons from today to the month of `day` (a `YYYY-MM-DD`). */
async function goToMonthOf(day: string) {
  const [y, m] = day.split('-').map(Number);
  const now = new Date();
  const steps = (y - now.getFullYear()) * 12 + (m - 1 - now.getMonth());
  for (let i = 0; i < Math.abs(steps); i++) fireEvent.click(await screen.findByRole('button', { name: steps > 0 ? 'Next month' : 'Previous month' }));
}

describe('a project’s events', () => {
  it('are asked for by project id, with no project filter of their own, and a new event opens pre-filled', async () => {
    const { calls } = mockFetch(() => bare(rows('events_list')));
    const Scoped = () => <DirectoryListPage config={useEventsListConfig({ projectId: 'p-9' })} />;
    renderAt('/e', manager, <Route path="/e" element={<Scoped />} />);
    await screen.findByText('Dailies');
    expect(calls.some((c) => path(c) === '/api/v1/scheduling/events/' && params(c).get('project_id') === 'p-9')).toBe(true);
    expect(screen.queryByLabelText('Filter by project')).toBeNull();
    expect(screen.getByRole('link', { name: /new event/i }).getAttribute('href')).toContain('project_id=p-9');
  });
});

describe('the calendar', () => {
  const serve = (c: MockCall): MockReply => {
    const p = path(c);
    if (p.endsWith('/events/')) return bare(rows('events_list'));
    if (p.endsWith('/milestones/')) return bare(rows('milestones_list'));
    if (p.endsWith('/holidays/')) return bare(rows('holidays_list'));
    if (p.endsWith('/leaves/')) return bare(rows('leaves_list_manager'));
    return bare([]);
  };

  it('draws a month, moves between months and lists what is on the chosen day', async () => {
    mockFetch(serve);
    renderAt('/cal', manager, <Route path="/cal" element={<CalendarPage />} />);
    const holiday = rows('holidays_list')[0];
    const [y, m] = holiday.holiday_date.split('-').map(Number);
    await goToMonthOf(holiday.holiday_date);
    const cell = await screen.findByRole('button', { name: new RegExp(`^${new Date(y, m - 1, Number(holiday.holiday_date.slice(8))).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}, [1-9]`) });
    fireEvent.click(cell);
    const panel = within(screen.getByRole('region', { name: 'Selected day' }));
    expect(panel.getByText(holiday.name)).toBeTruthy();
    expect(panel.getByText('Holiday')).toBeTruthy();
  });

  it('asks the server for the grid’s window; a project’s calendar also asks for its project, and shows no leave', async () => {
    const mine = rows('events_list')[0];
    const { calls } = mockFetch(serve);
    renderAt('/cal', manager, <Route path="/cal" element={<CalendarPage embedded projectId="p-1" />} />);
    await screen.findByRole('table');
    await goToMonthOf(mine.start_time.slice(0, 10));
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/events/') && params(c).get('project_id') === 'p-1')).toBe(true));
    const asked = calls.filter((c) => path(c).endsWith('/events/')).pop()!;
    const start = new Date(params(asked).get('start')!);
    const end = new Date(params(asked).get('end')!);
    const at = new Date(mine.start_time);
    expect(start <= at && at < end).toBe(true); // the window the grid shows holds the month asked for
    expect(end >= new Date(at.getFullYear(), at.getMonth() + 1, 1)).toBe(true); // all of it, up to the Sunday after the month
    expect(params(asked).get('start')).toMatch(/Z$/); // a zone, or the server answers 400
    expect(calls.some((c) => path(c).endsWith('/milestones/') && params(c).get('project_id') === 'p-1')).toBe(true);
    cleanup();
    // the studio calendar asks for no project
    const studio = mockFetch(serve);
    renderAt('/cal', manager, <Route path="/cal" element={<CalendarPage />} />);
    await screen.findByRole('table');
    await waitFor(() => expect(studio.calls.some((c) => path(c).endsWith('/events/'))).toBe(true));
    expect(studio.calls.filter((c) => path(c).endsWith('/events/')).every((c) => !params(c).has('project_id'))).toBe(true);
  });
});

describe('leave on the calendar', () => {
  const serve = (c: MockCall): MockReply => (path(c).endsWith('/leaves/') ? bare(rows('leaves_list_manager')) : bare([]));
  const leave = () => rows('leaves_list_manager').find((l) => l.start_date === '2026-12-21');

  it('the studio calendar shows who is off; a project’s calendar does not', async () => {
    mockFetch(serve);
    renderAt('/cal', manager, <Route path="/cal" element={<CalendarPage />} />);
    await screen.findByRole('table');
    await goToMonthOf(leave().start_date);
    expect((await screen.findAllByText(`${leave().resource_name} off`)).length).toBeGreaterThan(0);
    cleanup();
    mockFetch(serve);
    const project = mockFetch(serve);
    renderAt('/cal', manager, <Route path="/cal" element={<CalendarPage embedded projectId="p-1" />} />);
    await screen.findByRole('table');
    await goToMonthOf(leave().start_date);
    await waitFor(() => expect(project.calls.some((c) => path(c).endsWith('/leaves/'))).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 50)); // let the answer land: a negative needs it
    expect(screen.queryByText(`${leave().resource_name} off`)).toBeNull();
  });
});

describe('capacity', () => {
  it('lists the departments and the alerts; Flag needs schedule.update and posts the alert and its resource', async () => {
    const serve = (c: MockCall): MockReply => (c.method === 'POST' ? reply(flow.resolve) : path(c).endsWith('/capacity/') ? bare(rows('capacity_get_over')) : bare(rows('overbooking_get')));
    const { calls } = mockFetch(serve);
    renderAt('/cap', manager, <Route path="/cap" element={<CapacityPage />} />);
    const alert = rows('overbooking_get')[0];
    await screen.findByText(alert.resource_name);
    expect(screen.getByRole('cell', { name: 'Unassigned' })).toBeTruthy();
    expect(screen.getByText(/4 h over/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Flag bookings as overbooked' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe('/api/v1/scheduling/resolve-overbooking/');
    expect(writes(calls)[0].body).toEqual({ alert_id: alert.id, resource_id: alert.resource_id });
    cleanup();
    mockFetch(serve);
    renderAt('/cap', reader, <Route path="/cap" element={<CapacityPage />} />);
    await screen.findByText(alert.resource_name);
    expect(screen.queryByRole('button', { name: 'Flag bookings as overbooked' })).toBeNull();
  });

  it('says plainly when nobody is overbooked', async () => {
    mockFetch((c) => (path(c).endsWith('/capacity/') ? bare(rows('capacity_get')) : bare([])));
    renderAt('/cap', reader, <Route path="/cap" element={<CapacityPage />} />);
    expect(await screen.findByText(/Nobody is booked beyond their capacity this week/)).toBeTruthy();
  });
});

describe('resource workspace', () => {
  const resource = () => flow.resources_detail.body;
  const open = (user: User) => {
    const m = mockFetch((c) => (path(c) === `/api/v1/scheduling/resources/${resource().id}/` ? { status: 200, body: resource() } : bare([])));
    renderAt(`/scheduling/resources/${resource().id}`, user, <Route path="/scheduling/resources/:resourceId" element={<ResourceWorkspace />} />);
    return m;
  };

  it('a manager can book and block time from the page; a reader cannot', async () => {
    open(manager);
    await screen.findByRole('heading', { name: new RegExp(resource().code) });
    expect(screen.getByRole('link', { name: 'Book time' }).getAttribute('href')).toBe(`/scheduling/bookings/new?resource=${resource().id}&status=Booked`);
    expect(screen.getByRole('link', { name: 'Block time' }).getAttribute('href')).toBe(`/scheduling/bookings/new?resource=${resource().id}&status=Blocked`);
    cleanup();
    open(reader);
    await screen.findByRole('heading', { name: new RegExp(resource().code) });
    expect(screen.queryByRole('link', { name: 'Book time' })).toBeNull();
  });

  it('the Bookings and Leave tabs ask the server for this resource only', async () => {
    const { calls } = open(manager);
    await screen.findByRole('heading', { name: new RegExp(resource().code) });
    fireEvent.click(screen.getByRole('tab', { name: 'Bookings' }));
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/scheduling/schedules/' && params(c).get('resource_id') === resource().id)).toBe(true));
    fireEvent.click(screen.getByRole('tab', { name: 'Leave' }));
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/scheduling/leaves/' && params(c).get('resource_id') === resource().id)).toBe(true));
  });
});
