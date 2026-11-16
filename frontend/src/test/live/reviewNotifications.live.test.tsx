import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mfaApi } from '@/api/identity/mfa';
import { notificationsApi } from '@/api/notifications/notifications';
import { reviewsApi, versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { NotificationsPage } from '@/modules/notifications';
import { ReviewWorkspacePage } from '@/modules/reviews';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-11 (WP 11.6): review notifications, client-visible comments and preferences against a REAL
 * backend (C-RP-28 to C-RP-30). The manager builds a project whose lead is a CLIENT member; the producer opens a review
 * of the artist's version and asks the supervisor and the client for a verdict. The supervisor's participant verdict
 * tells the producer; the supervisor's approval tells the artist and the client. The client comments (asking for
 * internal, stored client-visible), the supervisor replies internally: the artist is told of both, the client of
 * neither, and the client's review hides the internal reply. The artist mutes review comments from the Notifications
 * page; the next comment writes no row.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; review: string; reviewCode: string; version: string; leadUser: string; clientSecret: string };

const Where: React.FC = () => <output aria-label="Location">{useLocation().pathname}</output>;
const tree = (ui: React.ReactElement, initial = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        {ui}
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function signIn(who: 'artist' | 'lead' | 'supervisor' | 'producer') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status !== 'mfa_required') return;
  // A client member is external, and an external member signs in with a second factor (TPN TM-007).
  if (who !== 'lead' || !fixture.clientSecret) throw new Error(`${who} unexpectedly needs MFA`);
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(fixture.clientSecret) });
}
const ours = async () => (await notificationsApi.list({ page: 1, page_size: 50, project_id: fixture.project })).results;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const project = await projectsApi.create({ code: `RN${uid}`, name: 'Live review notifications', workflow_type: 'standard' });
  const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
  // The add route takes client_id (project_scoped.py), the typed input does not list it: the lead is the client here.
  const lead = await projectScopedApi.addMember(project.id, { email: live.users.lead.email, role: 'Client', client_id: `client-${uid}` } as Parameters<typeof projectScopedApi.addMember>[1]);
  expect(lead.client_id).toBe(`client-${uid}`);
  // An external member owes MFA enrollment before anything else; the client enrolls once here.
  tokenStorage.clearTokens();
  await authService.login(live.users.lead);
  const { secret } = await mfaApi.setup();
  await mfaApi.enable(await freshTotp(secret));
  fixture.clientSecret = secret;
  tokenStorage.clearTokens();
  const again = await authService.login(live.users.manager);
  if (again.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: again.challenge, code: await freshTotp(live.manager.secret) });
  const supervisor = await projectScopedApi.addMember(project.id, { email: live.users.supervisor.email, role: 'Supervisor' });
  await projectScopedApi.addMember(project.id, { email: live.users.producer.email, role: 'Producer' });
  const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
  const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Reviewed shot' });
  const task = await tasksApi.create({ project: project.id, code: `${project.code}_T`, title: 'Comp', entity_type: 'Shot', entity_id: shot.id, assignee: artist.user_id });

  await signIn('artist');
  const version = await versionsApi.create({ project: project.id, shot: shot.id, task: task.id, department: 'Compositing', notes: 'first pass' });

  await signIn('producer');
  const review = await reviewsApi.create({ project: project.id, title: 'Client dailies', code: `${project.code}_DAILIES`, entity_type: 'Shot', entity_id: shot.id });
  await reviewsApi.addVersion(review.id, version.id);
  await reviewsApi.addParticipant(review.id, { user_id: supervisor.user_id, role: 'Supervisor' });
  await reviewsApi.addParticipant(review.id, { user_id: lead.user_id, role: 'Client' });
  await reviewsApi.submit(review.id);
  await reviewsApi.startReview(review.id);
  Object.assign(fixture, { project: project.id, review: review.id, reviewCode: review.code, version: version.id, leadUser: lead.user_id });
  tokenStorage.clearTokens();
}, 240000);

describe('review notifications against a live backend (RP-11)', () => {
  it('a verdict request reaches each participant; a participant verdict tells the producer; the decision tells the artist and the client', async () => {
    await signIn('supervisor');
    expect((await ours()).map((n) => n.kind)).toEqual(['review_invited']);
    const detail = await reviewsApi.get(fixture.review);
    const mine = detail.reviewers.find((p) => p.user_id !== fixture.leadUser) as { id: string };
    await reviewsApi.participantVerdict(fixture.review, { participant_id: mine.id, verdict: 'Approved' });
    await reviewsApi.approve(fixture.review, 'Good for the client');
    expect((await reviewsApi.get(fixture.review)).status).toBe('Approved');
    expect((await ours()).map((n) => n.kind)).toEqual(['review_invited']); // whoever acted is never told

    await signIn('producer');
    const producer = await ours();
    expect(producer.map((n) => [n.kind, n.data])).toEqual([['review_verdict', { verdict: 'Approved' }]]);

    await signIn('artist');
    const artist = (await ours()).filter((n) => n.kind.startsWith('review_')); // also told of the task assigned in setup
    expect(artist.map((n) => [n.kind, n.target.type, n.target.id, n.data])).toEqual([['review_decision', 'review', fixture.review, { to_status: 'Approved' }]]);

    await signIn('lead');
    expect((await ours()).map((n) => n.kind).sort()).toEqual(['review_decision', 'review_invited']);
  }, 180000);

  it('the client comment is stored client-visible; an internal reply reaches the artist and not the client, whose review hides it', async () => {
    await signIn('lead');
    const asked = await reviewsApi.addComment(fixture.review, { text: `Slower walk ${uid}`, version_id: fixture.version, is_client_visible: false });
    expect(asked.is_client_visible).toBe(true); // a client's comment is always client-visible

    await signIn('supervisor');
    const internal = await reviewsApi.addComment(fixture.review, { text: `Budget is tight ${uid}`, parent_id: asked.id, is_client_visible: false });
    expect(internal.is_client_visible).toBe(false);
    await reviewsApi.addComment(fixture.review, { text: `In v002 ${uid}`, parent_id: asked.id });

    await signIn('artist');
    expect((await ours()).filter((n) => n.kind === 'review_comment')).toHaveLength(3);

    await signIn('lead');
    const lead = await ours();
    expect(lead.filter((n) => n.kind === 'review_comment')).toHaveLength(1); // the open reply to the client's thread
    await expect(reviewsApi.resolveComment(fixture.review, internal.id)).rejects.toMatchObject({ status: 404 });

    render(tree(<Routes><Route path="/reviews/:reviewId" element={<ReviewWorkspacePage />} /></Routes>, `/reviews/${fixture.review}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Comments' }, { timeout: 20000 }));
    await screen.findByText(`Slower walk ${uid}`, {}, { timeout: 15000 });
    screen.getByText(`In v002 ${uid}`);
    expect(screen.queryByText(`Budget is tight ${uid}`)).toBeNull();
    expect(screen.queryByLabelText('Internal (hidden from the client)')).toBeNull(); // not offered to a client
  }, 180000);

  it('the artist sees the decision on the Notifications page, opens the review, and mutes review comments: the next comment writes nothing', async () => {
    await signIn('artist');
    render(tree(<NotificationsPage />));
    const decided = await screen.findByText(new RegExp(`decided ${fixture.reviewCode}: Approved$`), {}, { timeout: 20000 });
    const tell = (await screen.findByLabelText('Review comments on my work')) as HTMLInputElement;
    expect(tell.checked).toBe(true);
    fireEvent.click(tell);
    await waitFor(async () => expect((await notificationsApi.preferences()).muted_kinds).toEqual(['review_comment']), { timeout: 15000 });
    await waitFor(() => expect((screen.getByLabelText('Review comments on my work') as HTMLInputElement).checked).toBe(false));
    expect((screen.getByLabelText('Review decisions') as HTMLInputElement).checked).toBe(true);

    const row = decided.closest('button') ?? within(decided.parentElement as HTMLElement).getByRole('button');
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByLabelText('Location').textContent).toBe(`/reviews/${fixture.review}`));
    cleanup();

    const before = (await ours()).length;
    await signIn('lead');
    await reviewsApi.addComment(fixture.review, { text: `One more pass ${uid}`, version_id: fixture.version });
    await signIn('artist');
    expect((await ours()).length).toBe(before);
  }, 180000);
});
