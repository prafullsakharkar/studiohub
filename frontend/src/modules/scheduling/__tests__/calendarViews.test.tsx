import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { CalendarPage, TIMELINE_DAYS } from '../CalendarPage';
import { setStudioLocale, toStudioLocale } from '@/core/locale/studioLocale';
import { addDays, dayKey, weekOf, windowOf } from '../calendarModel';

type Row = Record<string, string>;
type Captured = { status: number; body: { items?: Row[] } | Row[] };
const flow = loadSample<Record<string, Captured>>('scheduling/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
const reader = withCodes('schedule.view', 'schedule.create');
const manager = withCodes('schedule.view', 'schedule.create', 'schedule.manage', 'schedule.update');

const rows = (key: string): Row[] => {
  const body = flow[key].body;
  return Array.isArray(body) ? body : (body.items ?? []);
};
const bare = (list: unknown[]): MockReply => ({ status: 200, body: list });
const path = (c: MockCall) => new URL(c.url).pathname;
const param = (c: MockCall, name: string) => new URL(c.url).searchParams.get(name);
const lastCall = (calls: MockCall[], suffix: string) => {
  const found = calls.filter((c) => path(c).endsWith(suffix)).pop();
  if (!found) throw new Error(`no request to ${suffix}`);
  return found;
};

const [dailies] = rows('events_list').filter((e) => e.title === 'Dailies');
/** The local day Dailies falls on, in whatever zone the tests run. */
const DAILIES_DAY = dayKey(new Date(dailies.start_time));
const resources = rows('resources_list');
const bookings = rows('schedules_list');
const alice = resources.find((r) => r.name === 'Alice Artist');
const bob = resources.find((r) => r.name === 'Bob Lead');
const MONDAY = weekOf(dayKey(new Date(bookings[0].start_time)))[0]; // the week the captured bookings are in

const serve = (c: MockCall): MockReply => {
  const p = path(c);
  if (p.endsWith('/events/')) return bare(rows('events_list'));
  if (p.endsWith('/milestones/')) return bare(rows('milestones_list'));
  if (p.endsWith('/holidays/')) return bare(rows('holidays_list'));
  if (p.endsWith('/leaves/')) return bare(rows('leaves_list_manager'));
  if (p.endsWith('/resources/')) return bare(resources);
  if (p.endsWith('/schedules/')) return bare(bookings);
  return bare([]);
};

const Where: React.FC = () => <output data-testid="where">{useLocation().search}</output>;
function open(initial: string, user: User, element: React.ReactNode = <CalendarPage />) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route
              path="/cal"
              element={
                <>
                  {element}
                  <Where />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
const where = () => screen.getByTestId('where').textContent;
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed');

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  setStudioLocale(null);
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('the view and the day live in the address', () => {
  it('opens the view and the day the address names, and a bad address falls back to this month', async () => {
    mockFetch(serve);
    open(`/cal?view=week&date=${DAILIES_DAY}`, manager);
    expect(await screen.findByRole('region', { name: 'Week' })).toBeTruthy();
    expect(pressed('Week')).toBe('true');
    cleanup();
    mockFetch(serve);
    open('/cal?view=bogus&date=2026-02-31', manager);
    expect(await screen.findByRole('table')).toBeTruthy(); // the month grid
    expect(pressed('Month')).toBe('true');
    // 2026-02-31 is not a day: the page is on today's month, not on the March that the date would roll over to.
    const now = new Date();
    expect(screen.getByRole('table').getAttribute('aria-label')).toBe(now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
  });

  it('offers "New event" on the calendar views, for someone who may create one, and not on the timeline', async () => {
    mockFetch(serve);
    open(`/cal?view=week&date=${DAILIES_DAY}`, manager);
    await screen.findByRole('region', { name: 'Week' });
    expect(screen.getByRole('button', { name: 'New event' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Timeline' }));
    await screen.findByRole('region', { name: 'Resource timeline' });
    expect(screen.queryByRole('button', { name: 'New event' })).toBeNull();
  });

  it('switching view and stepping change the address, and Today goes back', async () => {
    mockFetch(serve);
    open(`/cal?view=week&date=${DAILIES_DAY}`, manager);
    await screen.findByRole('region', { name: 'Week' });
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
    expect(where()).toContain(`date=${addDays(DAILIES_DAY, 7)}`);
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous week' }));
    expect(where()).toContain(`date=${addDays(DAILIES_DAY, -7)}`);
    fireEvent.click(screen.getByRole('button', { name: 'Day' }));
    expect(where()).toContain('view=day');
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }));
    expect(where()).toContain(`date=${addDays(DAILIES_DAY, -6)}`);
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(where()).toContain(`date=${dayKey(new Date())}`);
  });
});

describe('week and day', () => {
  it('asks the server for the week it shows, with a time zone, and nothing about bookings', async () => {
    const { calls } = mockFetch(serve);
    open(`/cal?view=week&date=${DAILIES_DAY}`, manager);
    await screen.findByRole('region', { name: 'Week' });
    const week = weekOf(DAILIES_DAY);
    const expected = windowOf(week[0], week[6]);
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/events/'))).toBe(true));
    const asked = lastCall(calls, '/events/');
    expect([param(asked, 'start'), param(asked, 'end')]).toEqual([expected.start, expected.end]);
    expect(param(asked, 'start')).toMatch(/Z$/);
    expect(calls.some((c) => path(c).endsWith('/schedules/') || path(c).endsWith('/resources/'))).toBe(false);
  });

  it('puts a timed event in its day, once, and an all-day event in the all-day band', async () => {
    mockFetch(serve);
    open(`/cal?view=week&date=${DAILIES_DAY}`, manager);
    const grid = await screen.findByRole('region', { name: 'Week' });
    expect(within(grid).getAllByRole('list', { name: /^Timed events on / })).toHaveLength(7);
    const timed = within(grid).getAllByRole('list', { name: /^Timed events on / }).filter((l) => within(l).queryByText('Dailies'));
    expect(timed).toHaveLength(1);
    expect(within(grid).getAllByText('Offsite').length).toBeGreaterThan(0); // an all-day event sits in the band, not on the hours
    expect(timed[0].textContent).not.toContain('Offsite');
  });

  it('a day is one column, and every event opens its page, for a reader as well as for someone who may change events', async () => {
    mockFetch(serve);
    open(`/cal?view=day&date=${DAILIES_DAY}`, manager);
    const grid = await screen.findByRole('region', { name: /./ });
    expect(within(grid).getAllByRole('list', { name: /^Timed events on / })).toHaveLength(1);
    expect(within(grid).getByRole('link', { name: /^Dailies/ }).getAttribute('href')).toBe(`/scheduling/events/${dailies.id}`);
    cleanup();
    mockFetch(serve);
    open(`/cal?view=day&date=${DAILIES_DAY}`, reader);
    expect((await screen.findByRole('link', { name: /^Dailies/ })).getAttribute('href')).toBe(`/scheduling/events/${dailies.id}`);
  });

  it('a day with nothing timed shows an empty grid and still its all-day items', async () => {
    mockFetch(serve);
    open(`/cal?view=day&date=${addDays(DAILIES_DAY, 30)}`, manager);
    const column = await screen.findByRole('list', { name: /^Timed events on / });
    expect(within(column).queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('timeline', () => {
  it('asks for two weeks of bookings with a time zone, and for the resources', async () => {
    const { calls } = mockFetch(serve);
    open(`/cal?view=timeline&date=${addDays(MONDAY, 2)}`, manager);
    await screen.findByRole('region', { name: 'Resource timeline' });
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/schedules/'))).toBe(true));
    const expected = windowOf(MONDAY, addDays(MONDAY, TIMELINE_DAYS - 1));
    const asked = lastCall(calls, '/schedules/');
    expect([param(asked, 'start'), param(asked, 'end')]).toEqual([expected.start, expected.end]);
    expect(param(asked, 'start')).toMatch(/Z$/);
    expect(calls.some((c) => path(c).endsWith('/resources/'))).toBe(true);
    expect(calls.some((c) => path(c).endsWith('/events/'))).toBe(false);
    expect(within(screen.getByRole('list', { name: 'Days' })).getAllByRole('listitem')).toHaveLength(TIMELINE_DAYS);
  });

  it('draws a row per resource with a bar per booking, overlapping bookings in lanes', async () => {
    mockFetch(serve);
    open(`/cal?view=timeline&date=${MONDAY}`, manager);
    const list = await screen.findByRole('list', { name: 'Resources' });
    expect(within(list).getAllByText(/Artist|Lead|Render/).length).toBeGreaterThan(2);
    expect(within(screen.getByRole('list', { name: 'Bookings of Alice Artist' })).getAllByRole('link')).toHaveLength(2);
    expect(within(screen.getByRole('list', { name: 'Bookings of Bob Lead' })).getAllByRole('link')).toHaveLength(1);
    expect(within(screen.getByRole('list', { name: 'Bookings of Render node 1' })).queryAllByRole('listitem')).toHaveLength(0);
    const first = within(screen.getByRole('list', { name: 'Bookings of Alice Artist' })).getAllByRole('link').map((a) => a.getAttribute('style'));
    expect(new Set(first.map((s) => /top:\s*([\d.]+)px/.exec(s ?? '')?.[1])).size).toBe(2); // the two overlapping bookings sit in two lanes
  });

  it('a booking links to its form for a manager, and is plain for a reader, who gets no Book link either', async () => {
    mockFetch(serve);
    open(`/cal?view=timeline&date=${MONDAY}`, manager);
    await screen.findByRole('list', { name: 'Resources' });
    expect(screen.getByRole('link', { name: `Book ${alice.name}` }).getAttribute('href')).toBe(`/scheduling/bookings/new?resource=${alice.id}&start_time=${encodeURIComponent(`${MONDAY}T09:00`)}&end_time=${encodeURIComponent(`${MONDAY}T17:00`)}`);
    expect(within(screen.getByRole('list', { name: 'Bookings of Bob Lead' })).getByRole('link').getAttribute('href')).toMatch(new RegExp(`^/scheduling/bookings/${bookings.find((b) => b.resource === bob.id).id}/edit$`));
    cleanup();
    mockFetch(serve);
    open(`/cal?view=timeline&date=${MONDAY}`, reader);
    await screen.findByRole('list', { name: 'Resources' });
    expect(screen.queryByRole('link', { name: /^Book / })).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Bookings of Bob Lead' })).getAllByRole('article')).toHaveLength(1);
  });

  it('the day chosen in the header is the day "Book" proposes', async () => {
    mockFetch(serve);
    open(`/cal?view=timeline&date=${MONDAY}`, manager);
    await screen.findByRole('list', { name: 'Resources' });
    const next = addDays(MONDAY, 3);
    fireEvent.click(within(screen.getByRole('list', { name: 'Days' })).getAllByRole('button')[3]);
    expect(where()).toContain(`date=${next}`);
    expect(screen.getByRole('link', { name: `Book ${alice.name}` }).getAttribute('href')).toContain(encodeURIComponent(`${next}T09:00`));
  });

  it('shades leave on the resource that is away, and a holiday only on resources of that work calendar', async () => {
    const leave = rows('leaves_list_manager').find((l) => l.start_date === '2026-12-21');
    const holiday = rows('holidays_list').find((h) => h.holiday_date === '2026-12-28');
    mockFetch(serve);
    open(`/cal?view=timeline&date=${leave.start_date}`, manager);
    const away = await screen.findByRole('list', { name: `Bookings of ${leave.resource_name}` });
    expect(away.closest('li')?.querySelectorAll('[data-shade="leave"]').length).toBeGreaterThan(0);
    const rowOf = (name: string) => screen.getByRole('list', { name: `Bookings of ${name}` }).closest('li') as HTMLElement;
    const other = resources.find((r) => r.id !== leave.resource && r.calendar === null);
    expect(rowOf(other.name).querySelectorAll('[data-shade="leave"]').length).toBe(0);
    cleanup();
    mockFetch(serve);
    open(`/cal?view=timeline&date=${holiday.holiday_date}`, manager);
    await screen.findByRole('list', { name: 'Resources' });
    expect(rowOf(bob.name).querySelectorAll('[data-shade="holiday"]').length).toBe(1); // Bob's calendar (London) has Boxing Day
    // A resource with no work calendar and no leave on that day has no holiday (Alice is on leave then, which shows instead).
    const free = resources.find((r) => r.calendar === null && !rows('leaves_list_manager').some((l) => l.resource === r.id && l.start_date <= holiday.holiday_date && l.end_date >= holiday.holiday_date));
    expect(free).toBeTruthy();
    expect(rowOf(free.name).querySelectorAll('[data-shade="holiday"]').length).toBe(0);
    expect(rowOf(alice.name).querySelectorAll('[data-shade="leave"]').length).toBeGreaterThan(0); // and leave wins over a holiday
    expect((rowOf(bob.name).querySelector('[data-shade="holiday"]') as HTMLElement).title).toBe(`${holiday.name}${holiday.is_optional ? ' (optional)' : ''}`);
  });

  it('filters the rows by name, code or department', async () => {
    mockFetch(serve);
    open(`/cal?view=timeline&date=${MONDAY}`, manager);
    await screen.findByRole('list', { name: 'Resources' });
    fireEvent.change(screen.getByLabelText('Filter resources'), { target: { value: 'bob' } });
    expect(screen.queryByRole('list', { name: 'Bookings of Alice Artist' })).toBeNull();
    expect(screen.getByRole('list', { name: 'Bookings of Bob Lead' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter resources'), { target: { value: 'nobody-matches' } });
    expect(screen.getByText('No resource matches the filter.')).toBeTruthy();
  });
});

describe('inside a project', () => {
  it('offers month, week and day but no timeline, and keeps its state out of the address', async () => {
    mockFetch(serve);
    open('/cal?view=timeline', manager, <CalendarPage embedded projectId="p-1" />);
    await screen.findByRole('table'); // the address names the timeline: ignored, it is the month
    expect(screen.queryByRole('button', { name: 'Timeline' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(await screen.findByRole('region', { name: 'Week' })).toBeTruthy();
    expect(where()).toBe('?view=timeline'); // untouched: a project tab's address carries other state
  });

  it('asks for its project in the week too, and shows no leave', async () => {
    const { calls } = mockFetch(serve);
    open('/cal', manager, <CalendarPage embedded projectId="p-1" />);
    await screen.findByRole('table');
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    await screen.findByRole('region', { name: 'Week' });
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/events/') && param(c, 'project_id') === 'p-1' && param(c, 'end')?.endsWith('Z'))).toBe(true));
    expect(screen.queryByText(/ off$/)).toBeNull();
  });
});

describe('the studio’s first day of the week', () => {
  const sunday = { date_format: 'DD/MM/YYYY', time_format: '24H', number_format: 'dot', week_start: 0 };

  it('puts Sunday first in the month headings, and Monday first without a studio default', async () => {
    mockFetch(serve);
    open('/cal', manager);
    const monthHeadings = async () => (await screen.findAllByRole('columnheader')).map((h) => h.textContent);
    expect((await monthHeadings()).slice(0, 7)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    cleanup();
    setStudioLocale(toStudioLocale(sunday));
    mockFetch(serve);
    open('/cal', manager);
    expect((await monthHeadings()).slice(0, 7)).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('asks the server for the Sunday-to-Saturday week in the week view', async () => {
    setStudioLocale(toStudioLocale(sunday));
    const { calls } = mockFetch(serve);
    open(`/cal?view=week&date=${DAILIES_DAY}`, manager);
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/events/'))).toBe(true));
    const days = weekOf(DAILIES_DAY, 0);
    const span = windowOf(days[0], days[6]);
    expect(param(lastCall(calls, '/events/'), 'start')).toBe(span.start);
    expect(new Date(days[0] + 'T12:00:00').getDay()).toBe(0);
  });
});
