import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { projectScopedApi, projectsApi } from '@/api/production/structure';
import { shotsApi, tasksApi, timelogsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { ShotsPage } from '@/modules/shots';
import { TasksPage, TimelogsPage } from '@/modules/tasks';
import { freshTotp, live } from './liveBackend';

/**
 * Phase 6 against a REAL backend: the artist → lead flow with role-correct screens.
 * Run on a fresh live_backend.py seed. The manager (a superuser) signs in ONCE to build the fixtures; the
 * tests then sign in as the seeded `artist` and `lead-artist` users and drive the real pages.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; artistUser: string; leadUser: string; task1: string; task2: string; task3: string; shotReview: string; shotOther: string };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const pages = (
  <Routes>
    <Route path="/tasks" element={<TasksPage />} />
    <Route path="/timelogs" element={<TimelogsPage />} />
    <Route path="/shots" element={<ShotsPage />} />
  </Routes>
);

async function signIn(who: 'artist' | 'lead') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });

  const project = await projectsApi.create({ code: `W${uid}`, name: 'Work flow', workflow_type: 'standard' });
  const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
  const lead = await projectScopedApi.addMember(project.id, { email: live.users.lead.email, role: 'Lead' });
  const shotA = await shotsApi.create({ project: project.id, code: `SA${uid}`, name: 'Walk' });
  const shotB = await shotsApi.create({ project: project.id, code: `SB${uid}`, name: 'Turn' });
  await shotsApi.update(shotA.id, { status: 'In Progress' });
  await shotsApi.update(shotA.id, { status: 'Pending Review' });
  const task = (code: string, title: string) => tasksApi.create({ project: project.id, code, title, entity_type: 'Shot', entity_id: shotB.id, assignee: artist.user_id });
  const [t1, t2, t3] = [await task(`T1${uid}`, 'Comp the walk'), await task(`T2${uid}`, 'Roto the turn'), await task(`T3${uid}`, 'Clean plate')];
  Object.assign(fixture, { project: project.id, artistUser: artist.user_id, leadUser: lead.user_id, task1: t1.id, task2: t2.id, task3: t3.id, shotReview: shotA.id, shotOther: shotB.id });
  tokenStorage.clearTokens();
}, 120000);

describe('artist logs time, lead approves', () => {
  it('the artist moves a task along (no Approved on offer), logs time on it, sees it submitted and cannot approve it', async () => {
    await signIn('artist');
    render(tree(pages, '/tasks'));
    const menu = (await screen.findByLabelText(`Status of T1${uid}`, {}, { timeout: 20000 })) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.value)).toEqual(['Not Started', 'In Progress', 'Pending Review', 'Retake']); // the real server accepts exactly these moves
    fireEvent.change(menu, { target: { value: 'In Progress' } });
    await waitFor(async () => expect((await tasksApi.get(fixture.task1)).status).toBe('In Progress'), { timeout: 15000 });

    fireEvent.click(screen.getByRole('button', { name: `Log time on T1${uid}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Hours/), { target: { value: '2.5' } });
    fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'Roto pass' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Log time' }));
    await waitFor(async () => expect((await timelogsApi.list({ task: fixture.task1 })).results).toHaveLength(1), { timeout: 15000 });
    const log = (await timelogsApi.list({ task: fixture.task1 })).results[0];
    expect(log).toMatchObject({ status: 'Submitted', duration_hours: 2.5, notes: 'Roto pass' });
    cleanup();

    render(tree(pages, '/timelogs'));
    await screen.findByText(`T1${uid} · Comp the walk`, {}, { timeout: 15000 });
    expect(screen.queryByRole('button', { name: /^Approve / })).toBeNull(); // an artist approves nothing
    expect(await tasksApi.get(fixture.task1)).toMatchObject({ logged_hours: '0.00', pending_hours: '2.50' }); // not counted until approved
  }, 90000);

  it('the lead sees the artist’s log, approves it, and the task’s logged hours move', async () => {
    await signIn('lead');
    render(tree(pages, '/timelogs'));
    const approve = await screen.findByRole('button', { name: /^Approve T1/ }, { timeout: 20000 });
    fireEvent.click(approve);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await waitFor(async () => expect((await timelogsApi.list({ task: fixture.task1 })).results[0].status).toBe('Approved'), { timeout: 15000 });
    expect(await tasksApi.get(fixture.task1)).toMatchObject({ logged_hours: '2.50', pending_hours: '0.00' });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Approve T1/ })).toBeNull(), { timeout: 15000 }); // approved logs are final: no Approve, no Edit
    expect(screen.queryByRole('link', { name: /^Edit T1/ })).toBeNull();
  }, 90000);

  it('a rejection carries its reason back to the artist, who resubmits it, and the lead approves the resubmission', async () => {
    await signIn('artist');
    const logged = await timelogsApi.create({ task_id: fixture.task2, duration_hours: '1.5', date: '2030-02-01', notes: 'Wrong plate' });
    expect(logged.status).toBe('Submitted');

    await signIn('lead');
    render(tree(pages, '/timelogs'));
    fireEvent.click(await screen.findByRole('button', { name: /^Reject T2/ }, { timeout: 20000 }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(await within(dialog).findByText('Enter reason.')).toBeTruthy(); // a reason is required, asked before the server is
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Wrong plate, use v002' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    await waitFor(async () => expect((await timelogsApi.get(logged.id)).status).toBe('Rejected'), { timeout: 15000 });
    cleanup();

    await signIn('artist');
    render(tree(pages, '/timelogs'));
    expect(await screen.findByText('Wrong plate, use v002', {}, { timeout: 20000 })).toBeTruthy(); // the reason is on the row
    fireEvent.click(await screen.findByRole('button', { name: /^Resubmit T2/ }, { timeout: 15000 })); // the row can render before /auth/me has loaded
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resubmit' }));
    await waitFor(async () => expect((await timelogsApi.get(logged.id)).status).toBe('Submitted'), { timeout: 15000 });
    cleanup();

    await signIn('lead');
    render(tree(pages, '/timelogs'));
    fireEvent.click(await screen.findByRole('button', { name: /^Approve T2/ }, { timeout: 20000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await waitFor(async () => expect((await timelogsApi.get(logged.id)).status).toBe('Approved'), { timeout: 15000 });
    const history = await timelogsApi.statusHistory(logged.id);
    // creating a log writes no history row (it is born Submitted); every later move does, newest first
    expect(history.map((h) => `${h.from_status}>${h.to_status}`).reverse()).toEqual(['Submitted>Rejected', 'Rejected>Submitted', 'Submitted>Approved']);
    expect(history.find((h) => h.to_status === 'Rejected')?.reason).toBe('Wrong plate, use v002');
  }, 150000);

  it('nobody approves their own time: the lead is not offered it, and the server refuses it', async () => {
    await signIn('lead');
    const own = await timelogsApi.create({ task_id: fixture.task3, duration_hours: '1', date: '2030-02-02' });
    await expect(timelogsApi.approve(own.id)).rejects.toMatchObject({ status: 403 });
    render(tree(pages, '/timelogs'));
    await screen.findByText(`T3${uid} · Clean plate`, {}, { timeout: 20000 });
    expect(screen.queryByRole('button', { name: /^Approve T3/ })).toBeNull();
  }, 90000);
});

describe('shots: the lead approves from review, the artist cannot', () => {
  it('the artist sees a shot’s status but cannot change it; the lead approves it from Pending Review with the approve action', async () => {
    await signIn('artist');
    render(tree(pages, '/shots'));
    await screen.findByRole('link', { name: new RegExp(`SA${uid}`) }, { timeout: 20000 });
    expect(screen.queryByLabelText(`Status of SA${uid}`)).toBeNull(); // shot.update is not an artist permission
    await expect(shotsApi.approve(fixture.shotReview)).rejects.toMatchObject({ status: 403 });
    cleanup();

    await signIn('lead');
    render(tree(pages, '/shots'));
    const menu = (await screen.findByLabelText(`Status of SA${uid}`, {}, { timeout: 20000 })) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.value)).toContain('Approved');
    const other = screen.getByLabelText(`Status of SB${uid}`) as HTMLSelectElement;
    expect([...other.options].map((o) => o.value)).not.toContain('Approved'); // a shot that is not in review cannot be approved
    fireEvent.change(menu, { target: { value: 'Approved' } });
    await waitFor(async () => expect((await shotsApi.get(fixture.shotReview)).status).toBe('Approved'), { timeout: 15000 });
    const history = await shotsApi.statusHistory(fixture.shotReview);
    expect(history[0]).toMatchObject({ from_status: 'Pending Review', to_status: 'Approved' });
  }, 90000);
});
