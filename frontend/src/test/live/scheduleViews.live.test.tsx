import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingsApi, eventsApi, resourcesApi } from '@/api/scheduling/scheduling';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { CalendarPage } from '@/modules/scheduling';
import { addDays, dayKey, weekOf, windowOf } from '@/modules/scheduling/calendarModel';
import { live } from './liveBackend';

/**
 * The week, day and timeline views against a REAL backend (Phase 26): the server narrows bookings and events to the window a
 * view asks for (a time zone is required), the timeline draws a bar for the booking in the window and none for the one two
 * months away, and the week puts a timed event on its day. Run on a fresh live_backend.py seed.
 */
const T = { timeout: 20000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();
const today = dayKey(new Date());
/** A local clock time on a day, as the instant the API takes. */
const at = (day: string, h: number, m = 0) => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, h, m).toISOString();
};
const far = addDays(today, 60);
const fixture = {} as { resource: string };

const tree = (view: string, date: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[`/cal?view=${view}&date=${date}`]}>
      <AuthProvider>
        <CalendarPage />
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.producer);
  if (outcome.status === 'mfa_required') throw new Error('the producer unexpectedly needs MFA');
  const resource = await resourcesApi.create({ name: `Timeline ${uid}`, code: `TL${uid}`, resource_type: 'Equipment', capacity_hours_per_week: 40 });
  fixture.resource = resource.id;
  await resourcesApi.book(resource.id, { start_time: at(today, 9), end_time: at(today, 13) });
  await resourcesApi.book(resource.id, { start_time: at(far, 9), end_time: at(far, 13) });
  await eventsApi.create({ title: `Dailies ${uid}`, start_time: at(today, 10), end_time: at(today, 11) });
  await eventsApi.create({ title: `Far away ${uid}`, start_time: at(far, 10), end_time: at(far, 11) });
}, 60000);

describe('the server narrows to the window a view asks for', () => {
  it('bookings: the window holds one of the resource’s two, the unfiltered list both, and a bare date-time is refused', async () => {
    const week = weekOf(today);
    const span = windowOf(week[0], week[6]);
    const inWindow = (await bookingsApi.list({ start: span.start, end: span.end, resource: fixture.resource })).results;
    expect(inWindow).toHaveLength(1);
    expect(new Date(inWindow[0].start_time).getTime()).toBe(new Date(at(today, 9)).getTime());
    expect((await bookingsApi.list({ resource: fixture.resource })).results).toHaveLength(2);
    await expect(bookingsApi.list({ start: span.start.replace('Z', ''), end: span.end.replace('Z', '') })).rejects.toMatchObject({ status: 400 });
  });
});

describe('the views, on real data', () => {
  it('the timeline draws a bar for the booking in the two weeks and none for the one two months away', async () => {
    render(tree('timeline', today));
    const bars = await screen.findByRole('list', { name: `Bookings of Timeline ${uid}` }, T);
    await waitFor(() => expect(within(bars).getAllByRole('link')).toHaveLength(1), T);
    expect(within(bars).getByRole('link').getAttribute('href')).toMatch(/^\/scheduling\/bookings\/.+\/edit$/);
    expect(screen.getByRole('link', { name: `Book Timeline ${uid}` }).getAttribute('href')).toContain(`resource=${fixture.resource}`);
    // the filter keeps this resource and drops the others (the seed has some)
    fireEvent.change(screen.getByLabelText('Filter resources'), { target: { value: `TL${uid}` } });
    expect(screen.getAllByRole('list', { name: /^Bookings of / })).toHaveLength(1);
  });

  it('the week puts the event on its day, and the event two months away is not in it', async () => {
    render(tree('week', today));
    const grid = await screen.findByRole('region', { name: 'Week' }, T);
    await waitFor(() => expect(within(grid).queryByText(`Dailies ${uid}`)).toBeTruthy(), T);
    const lists = within(grid).getAllByRole('list', { name: /^Timed events on / }).filter((l) => within(l).queryByText(`Dailies ${uid}`));
    expect(lists).toHaveLength(1);
    expect(within(grid).queryByText(`Far away ${uid}`)).toBeNull();
  });

  it('the far booking shows in its own two weeks', async () => {
    render(tree('timeline', far));
    const bars = await screen.findByRole('list', { name: `Bookings of Timeline ${uid}` }, T);
    await waitFor(() => expect(within(bars).getAllByRole('link')).toHaveLength(1), T);
    expect(within(bars).getByRole('link').getAttribute('title')).toContain(`Timeline ${uid}`);
  });
});
