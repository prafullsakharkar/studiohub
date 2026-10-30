import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { bookingsApi, leavesApi, milestonesApi, resourcesApi } from '@/api/scheduling/scheduling';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { BookingFormPage, BookingsPage, LeaveFormPage, LeavesPage, MilestonesPage, ResourcesPage, ResourceWorkspacePage, SchedulingCapacityPage } from '@/modules/scheduling';
import { live } from './liveBackend';

/**
 * Phase 10 against a REAL backend, with the roles the studio seeds. A producer (schedule.manage and approve) books a
 * resource and an overlapping booking is refused with the server's own sentence; an artist files leave for their own
 * resource (no resource named), cannot decide it, and a producer approves it, which puts the person On Leave; this
 * week's over-allocation shows on the capacity page and is flagged; milestones are completed and reopened. Rates are
 * hidden from the artist for everyone's resource but their own. Run on a fresh live_backend.py seed.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const pages = (
  <Routes>
    <Route path="/scheduling/resources" element={<ResourcesPage />} />
    <Route path="/scheduling/resources/:resourceId" element={<ResourceWorkspacePage />} />
    <Route path="/scheduling/bookings" element={<BookingsPage />} />
    <Route path="/scheduling/bookings/new" element={<BookingFormPage />} />
    <Route path="/scheduling/leaves" element={<LeavesPage />} />
    <Route path="/scheduling/leaves/new" element={<LeaveFormPage />} />
    <Route path="/scheduling/milestones" element={<MilestonesPage />} />
    <Route path="/scheduling/capacity" element={<SchedulingCapacityPage />} />
  </Routes>
);

async function signIn(who: 'supervisor' | 'producer' | 'artist') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}
const heading = (text: string | RegExp) => screen.findByRole('heading', { name: text }, { timeout: 20000 });
const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('bookings', () => {
  it('a producer books a resource from its page; an overlapping booking is refused with the server’s sentence and nothing is stored', async () => {
    await signIn('producer');
    const created = await resourcesApi.create({ name: `Render node ${uid}`, code: `RN${uid}`, resource_type: 'Equipment', capacity_hours_per_week: 40 });
    const book = async (start: string, end: string) => {
      render(tree(pages, `/scheduling/resources/${created.id}`));
      await heading(new RegExp(`RN${uid}`));
      fireEvent.click(await screen.findByRole('link', { name: 'Book time' }, { timeout: 20000 }));
      fireEvent.change(await screen.findByLabelText(/^Starts/, {}, { timeout: 20000 }), { target: { value: start } });
      fireEvent.change(screen.getByLabelText(/^Ends/), { target: { value: end } });
      fireEvent.click(screen.getByRole('button', { name: /create booking/i }));
    };

    await book('2027-03-01T09:00', '2027-03-01T13:00');
    await heading('Bookings');
    const stored = (await bookingsApi.list({ search: `RN${uid}` })).results;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ status: 'Booked', resource: created.id });
    expect(stored[0].start_time).toMatch(/Z$/);
    cleanup();

    await book('2027-03-01T12:00', '2027-03-01T15:00');
    expect(await screen.findByText(/already taken by booking/, {}, { timeout: 20000 })).toBeTruthy();
    expect((await bookingsApi.list({ search: `RN${uid}` })).results).toHaveLength(1);
    cleanup();

    // an adjacent slot is fine
    await book('2027-03-01T13:00', '2027-03-01T17:00');
    await heading('Bookings');
    expect((await bookingsApi.list({ search: `RN${uid}` })).results).toHaveLength(2);

    // the server filters (CR-25): by resource under both spellings, by status and by a time window
    expect((await bookingsApi.list({ resource: created.id })).results).toHaveLength(2);
    expect((await bookingsApi.list({ resource_id: created.id, status: 'blocked' })).results).toHaveLength(0);
    // a window opening where the first booking ends holds the second only (touching the edge is not overlapping); times are the
    // ones the server stored, whatever zone the typed local times were read in
    const both = (await bookingsApi.list({ resource_id: created.id, ordering: 'start_time' })).results;
    expect((await bookingsApi.list({ resource_id: created.id, start: both[0].end_time, end: both[1].end_time })).results.map((b) => b.id)).toEqual([both[1].id]);
    await expect(bookingsApi.list({ start: '2027-03-01T13:00:00' })).rejects.toMatchObject({ status: 400, fieldErrors: { start: [expect.stringMatching(/time zone/)] } });
    expect((await resourcesApi.list({ resource_type: 'equipment', search: uid })).results.map((r) => r.id)).toContain(created.id);
    expect((await resourcesApi.list({ resource_type: 'Room', search: uid })).results).toHaveLength(0);
  }, 240000);
});

describe('leave', () => {
  it('an artist files leave for their own resource, cannot decide it; a producer approves it and the person shows as On Leave; rates stay hidden from the artist', async () => {
    await signIn('artist');
    const me = await apiClient.get<{ id: string }>('/api/v1/auth/me/');
    await signIn('producer');
    const own = await resourcesApi.create({ name: `Alice ${uid}`, code: `AL${uid}`, user_id: me.id, hourly_rate_usd: '55.00' });
    const other = await resourcesApi.create({ name: `Bob ${uid}`, code: `BO${uid}`, hourly_rate_usd: '70.00' });

    // the artist: the form names no resource, so the request is for their own
    await signIn('artist');
    render(tree(pages, '/scheduling/leaves/new'));
    fireEvent.change(await screen.findByLabelText(/^From/, {}, { timeout: 20000 }), { target: { value: isoDay(-1) } });
    fireEvent.change(screen.getByLabelText(/^To/), { target: { value: isoDay(1) } });
    fireEvent.change(screen.getByLabelText(/^Reason/), { target: { value: 'Long weekend' } });
    fireEvent.click(screen.getByRole('button', { name: /create leave request/i }));
    await heading('Leave');
    const filed = (await leavesApi.list({ search: `AL${uid}` })).results;
    expect(filed).toHaveLength(1);
    expect(filed[0]).toMatchObject({ status: 'Pending', resource: own.id, reason: 'Long weekend' });
    expect(await screen.findByText(new RegExp(`AL${uid} · Alice ${uid}`), {}, { timeout: 20000 })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Approve/ })).toBeNull();
    await expect(leavesApi.approve(filed[0].id)).rejects.toMatchObject({ status: 403 });
    cleanup();

    // rates: the artist reads their own, not Bob's
    const seen = (await resourcesApi.list({ search: uid })).results;
    expect(seen.find((r) => r.id === own.id)?.hourly_rate_usd).toBe('55.00');
    expect(seen.find((r) => r.id === other.id)?.hourly_rate_usd).toBeNull();

    // the producer approves it from the list
    await signIn('producer');
    render(tree(pages, '/scheduling/leaves'));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^Approve AL${uid}`) }, { timeout: 20000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await waitFor(async () => expect((await leavesApi.get(filed[0].id)).status).toBe('Approved'), { timeout: 20000 });
    expect((await resourcesApi.get(own.id)).status).toBe('On Leave');
    expect((await resourcesApi.list({ status: 'On Leave', search: uid })).results.map((r) => r.id)).toEqual([own.id]);
    expect((await resourcesApi.list({ status: 'Active', search: `BO${uid}` })).results.map((r) => r.id)).toEqual([other.id]);
    expect((await leavesApi.list({ status: 'approved', resource_id: own.id })).results.map((l) => l.id)).toEqual([filed[0].id]);
    expect((await leavesApi.list({ start: isoDay(5) })).results.map((l) => l.id)).not.toContain(filed[0].id); // it ended before that
    cleanup();
    render(tree(pages, '/scheduling/resources'));
    expect(await screen.findByText(new RegExp(`AL${uid} · Alice ${uid}`), {}, { timeout: 20000 })).toBeTruthy();
    await waitFor(() => expect(within(screen.getByText(new RegExp(`AL${uid} · Alice`)).closest('tr') as HTMLElement).getByText('On Leave')).toBeTruthy(), { timeout: 20000 });
  }, 240000);
});

describe('capacity', () => {
  it('this week’s over-allocation shows with its excess and is flagged from the page', async () => {
    await signIn('producer');
    const small = await resourcesApi.create({ name: `Small box ${uid}`, code: `SM${uid}`, resource_type: 'Equipment', capacity_hours_per_week: 8 });
    const monday = new Date();
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    monday.setUTCHours(8, 0, 0, 0);
    const at = (days: number, hours: number) => new Date(monday.getTime() + days * 86400000 + hours * 3600000).toISOString();
    await bookingsApi.create({ resource: small.id, start_time: at(0, 0), end_time: at(0, 6), status: 'Booked' });
    await bookingsApi.create({ resource: small.id, start_time: at(1, 0), end_time: at(1, 6), status: 'Booked' });

    render(tree(pages, '/scheduling/capacity'));
    const alert = (await screen.findAllByText(new RegExp(`Small box ${uid}`), {}, { timeout: 20000 }))[0];
    const card = alert.closest('li') as HTMLElement;
    expect(within(card).getByText(/4 h over/)).toBeTruthy();
    fireEvent.click(await within(card).findByRole('button', { name: 'Flag bookings as overbooked' }, { timeout: 20000 }));
    await waitFor(async () => expect((await bookingsApi.list({ search: `SM${uid}` })).results.map((b) => b.status)).toEqual(['Overbooked', 'Overbooked']), { timeout: 20000 });
  }, 240000);
});

describe('milestones', () => {
  it('are completed and reopened from the list; Completed is reached only through complete', async () => {
    await signIn('producer');
    const milestone = await milestonesApi.create({ project_id: live.dlv.project, name: `Turnover ${uid}`, due_date: '2027-03-15' });
    expect(milestone).toMatchObject({ name: `Turnover ${uid}` });
    expect((await milestonesApi.list({ project_id: live.dlv.project, status: 'pending' })).results.map((m) => m.id)).toContain(milestone.id);
    expect((await milestonesApi.list({ project_id: live.dlv.project, status: 'completed' })).results.map((m) => m.id)).not.toContain(milestone.id);
    expect((await milestonesApi.list({ project_id: milestone.project_code })).results.map((m) => m.id)).toContain(milestone.id); // by code
    const id = milestone.id;
    await expect(milestonesApi.update(id, { status: 'Completed' } as never)).rejects.toMatchObject({ status: 400 });

    render(tree(pages, '/scheduling/milestones'));
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^Complete Turnover ${uid}`) }, { timeout: 20000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Complete' }));
    await waitFor(async () => expect((await milestonesApi.get(id)).status).toBe('Completed'), { timeout: 20000 });
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^Reopen Turnover ${uid}`) }, { timeout: 20000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Reopen' }));
    await waitFor(async () => expect((await milestonesApi.get(id)).status).toBe('In Progress'), { timeout: 20000 });
  }, 240000);
});
