import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewsApi, versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { ReviewWorkspacePage } from '@/modules/reviews';
import { VersionWorkspacePage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Phase 7 against a REAL backend: the version → review → approve round trip with the roles that exist in the
 * studio. An artist makes a version; a lead moves it to review and starts the review; a vfx-supervisor decides it
 * (a lead cannot, and whoever submitted a review cannot approve it); the lead then approves, publishes and promotes
 * the version. Run on a fresh live_backend.py seed; the manager signs in ONCE to build the project.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; shot: string; task: string; artistUser: string; leadUser: string; supervisorUser: string };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const pages = (
  <Routes>
    <Route path="/versions/:versionId" element={<VersionWorkspacePage />} />
    <Route path="/reviews/:reviewId" element={<ReviewWorkspacePage />} />
  </Routes>
);

async function signIn(who: 'artist' | 'lead' | 'supervisor') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}
const toolbar = () => screen.findByRole('toolbar', { name: 'Review actions' }, { timeout: 20000 });
const clickAction = async (name: string) => {
  fireEvent.click(within(await toolbar()).getByRole('button', { name }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name }));
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const project = await projectsApi.create({ code: `V${uid}`, name: 'Review flow', workflow_type: 'standard' });
  const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
  const lead = await projectScopedApi.addMember(project.id, { email: live.users.lead.email, role: 'Lead' });
  const supervisor = await projectScopedApi.addMember(project.id, { email: live.users.supervisor.email, role: 'Supervisor' });
  const shot = await shotsApi.create({ project: project.id, code: `RS${uid}`, name: 'Review shot' });
  const task = await tasksApi.create({ project: project.id, code: `RT${uid}`, title: 'Comp', entity_type: 'Shot', entity_id: shot.id, assignee: artist.user_id });
  Object.assign(fixture, { project: project.id, shot: shot.id, task: task.id, artistUser: artist.user_id, leadUser: lead.user_id, supervisorUser: supervisor.user_id });
  tokenStorage.clearTokens();
}, 120000);

describe('version → review → approve', () => {
  it('the artist makes a version; the lead sends it to review and starts the review; the supervisor decides it; the lead approves, publishes and promotes the version', async () => {
    await signIn('artist');
    const version = await versionsApi.create({ project: fixture.project, shot: fixture.shot, task: fixture.task, department: 'Compositing', notes: 'first pass' });
    expect(version).toMatchObject({ version_number: 'v001' });

    // the lead: Not Started → In Progress → Pending Review from the version's own status menu
    await signIn('lead');
    render(tree(pages, `/versions/${version.id}`));
    const menu = (await screen.findByLabelText(`Status of ${version.code}`, {}, { timeout: 20000 })) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.value)).not.toContain('Approved'); // not from Not Started
    fireEvent.change(menu, { target: { value: 'In Progress' } });
    await waitFor(async () => expect((await versionsApi.get(version.id)).status).toBe('In Progress'), { timeout: 15000 });
    fireEvent.change(screen.getByLabelText(`Status of ${version.code}`), { target: { value: 'Pending Review' } });
    await waitFor(async () => expect((await versionsApi.get(version.id)).status).toBe('Pending Review'), { timeout: 15000 });

    // the lead starts a review of it, from the version's Reviews tab, and lands on the review
    fireEvent.click(screen.getByRole('tab', { name: 'Reviews' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start a review' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start review' }));
    await screen.findByRole('tab', { name: 'Participants' }, { timeout: 20000 }); // the review workspace
    const [review] = (await reviewsApi.list({ project_id: fixture.project, entity_id: fixture.shot })).results;
    expect(review.versions.map((v) => v.id)).toEqual([version.id]);

    // the lead holds review.update: they can submit, but not decide
    await waitFor(async () => expect([...within(await toolbar()).getAllByRole('button')].map((b) => b.textContent)).toEqual(['Submit', 'Start review', 'Close']), { timeout: 15000 });
    await clickAction('Submit');
    await waitFor(async () => expect((await reviewsApi.get(review.id)).status).toBe('Submitted'), { timeout: 15000 });
    cleanup();

    // the supervisor starts the review and decides it
    await signIn('supervisor');
    render(tree(pages, `/reviews/${review.id}`));
    await clickAction('Start review');
    await waitFor(async () => expect((await reviewsApi.get(review.id)).status).toBe('In Review'), { timeout: 15000 });
    await waitFor(async () => expect([...within(await toolbar()).getAllByRole('button')].map((b) => b.textContent)).toEqual(['Approve', 'Request changes', 'Reject', 'Retake', 'Close']), { timeout: 15000 });
    fireEvent.click(within(await toolbar()).getByRole('button', { name: 'Approve' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'Approved for publishing' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(async () => expect((await reviewsApi.get(review.id)).status).toBe('Approved'), { timeout: 15000 });
    const history = await reviewsApi.statusHistory(review.id);
    expect(history.map((h) => `${h.from_status}>${h.to_status}`).reverse()).toEqual(['Pending Review>Submitted', 'Submitted>In Review', 'In Review>Approved']);
    cleanup();

    // the lead (not a producer of this version) approves, publishes and promotes it
    await signIn('lead');
    render(tree(pages, `/versions/${version.id}`));
    fireEvent.change(await screen.findByLabelText(`Status of ${version.code}`, {}, { timeout: 20000 }), { target: { value: 'Approved' } });
    await waitFor(async () => expect((await versionsApi.get(version.id)).status).toBe('Approved'), { timeout: 15000 });
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }));
    await waitFor(async () => expect((await versionsApi.get(version.id)).is_published).toBe(true), { timeout: 15000 });
    fireEvent.click(await screen.findByRole('button', { name: 'Make hero' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Make hero' }));
    await waitFor(async () => expect((await versionsApi.get(version.id)).is_hero).toBe(true), { timeout: 15000 });
    const done = await versionsApi.get(version.id);
    expect(done).toMatchObject({ status: 'Approved', is_published: true, is_hero: true });
    expect(screen.queryByLabelText(`Status of ${version.code}`)).toBeNull(); // a published version's status is frozen
  }, 240000);

  it('nobody approves what they produced: a lead cannot approve their own version, and the screen says why', async () => {
    await signIn('lead');
    const own = await versionsApi.create({ project: fixture.project, shot: fixture.shot, notes: 'lead made' });
    await versionsApi.update(own.id, { status: 'In Progress' });
    await versionsApi.update(own.id, { status: 'Pending Review' });
    await expect(versionsApi.update(own.id, { status: 'Approved' })).rejects.toMatchObject({ status: 403, code: 'separation_of_duties' });

    render(tree(pages, `/versions/${own.id}`));
    fireEvent.change(await screen.findByLabelText(`Status of ${own.code}`, {}, { timeout: 20000 }), { target: { value: 'Approved' } });
    await waitFor(async () => expect((await versionsApi.get(own.id)).status).toBe('Pending Review'), { timeout: 15000 });
    expect((await versionsApi.get(own.id)).status).toBe('Pending Review'); // refused, so unchanged
  }, 90000);
});

describe('review parts', () => {
  it('participants give a verdict that does not decide the review; comments are threaded and resolved; a decision can be Retake', async () => {
    await signIn('supervisor');
    const created = await reviewsApi.create({ project: fixture.project, title: 'Parts', code: `RP${uid}`, entity_type: 'Shot', entity_id: fixture.shot });
    const version = (await versionsApi.list({ project_id: fixture.project })).results[0];
    await reviewsApi.addVersion(created.id, version.id);
    await reviewsApi.addParticipant(created.id, { user_id: fixture.leadUser, role: 'Lead' });
    await reviewsApi.submit(created.id);
    await reviewsApi.startReview(created.id);

    // the supervisor comments and replies, then resolves, from the real panel
    render(tree(pages, `/reviews/${created.id}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Comments' }, { timeout: 20000 }));
    fireEvent.change(await screen.findByLabelText('Comment'), { target: { value: 'Edge flicker at 1040' } });
    fireEvent.change(screen.getByLabelText('Frame'), { target: { value: '1040' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await screen.findByText('Edge flicker at 1040', {}, { timeout: 15000 });
    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'Fixed in v2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    await screen.findByText('Fixed in v2', {}, { timeout: 15000 });
    fireEvent.click(screen.getAllByRole('button', { name: 'Resolve' })[0]);
    await waitFor(async () => expect((await reviewsApi.get(created.id)).comments[0].is_resolved).toBe(true), { timeout: 15000 });
    cleanup();

    // the lead (a participant who did not submit this review) gives a verdict from the Participants tab
    await signIn('lead');
    render(tree(pages, `/reviews/${created.id}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Participants' }, { timeout: 20000 }));
    await screen.findByRole('region', { name: 'Your verdict' }, { timeout: 15000 });
    fireEvent.change(screen.getByLabelText('Verdict'), { target: { value: 'Changes Requested' } });
    fireEvent.change(screen.getByLabelText('Verdict notes'), { target: { value: 'tighten the edge' } });
    fireEvent.click(screen.getByRole('button', { name: 'Give verdict' }));
    await waitFor(async () => expect((await reviewsApi.get(created.id)).reviewers[0]).toMatchObject({ verdict: 'Changes Requested', verdict_notes: 'tighten the edge' }), { timeout: 15000 });
    expect((await reviewsApi.get(created.id)).status).toBe('In Review'); // a participant's verdict does not decide the review
    cleanup();

    // the supervisor decides Retake, which only the verdict route can do
    await signIn('supervisor');
    render(tree(pages, `/reviews/${created.id}`));
    await clickAction('Retake');
    await waitFor(async () => expect((await reviewsApi.get(created.id)).status).toBe('Retake'), { timeout: 15000 });
  }, 150000);
});
