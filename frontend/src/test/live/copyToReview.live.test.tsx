import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { notificationsApi } from '@/api/notifications/notifications';
import { reviewMediaApi, versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { NotificationsPage } from '@/modules/notifications';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-19 (WP 19.4) against a REAL backend started with SYNC_LIVE_MEDIA=1. The manager sets up a version
 * still in review whose task names the supervisor as its reviewer, and the project's review folder on the harness's
 * studio root. The producer, standing in for a render-farm account, makes the copy from the movie by path (RP-18).
 * Once the worker has made it, the supervisor reads "<version> is ready for you to review" on the Notifications page
 * and opens the version's Media tab from it (C-RP-50); the artist is told the copy is ready, and the producer, who made
 * it, is told too (C-RP-24). Skipped without SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; version: string; code: string };
const studio = live.media?.studio;

const Where: React.FC = () => <output aria-label="Location">{`${useLocation().pathname}${useLocation().search}`}</output>;
const tree = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/notifications']}>
      <AuthProvider>
        {ui}
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function signIn(who: 'supervisor' | 'producer' | 'artist') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}
const about = async () => (await notificationsApi.list({ page: 1, page_size: 50, project_id: fixture.project })).results.filter((n) => n.target.id === fixture.version);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!studio)('a copy ready to review against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    tokenStorage.clearTokens();
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `R${uid}`, name: 'Live copy to review', workflow_type: 'standard' });
    const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
    const supervisor = await projectScopedApi.addMember(project.id, { email: live.users.supervisor.email, role: 'Supervisor' });
    await projectScopedApi.addMember(project.id, { email: live.users.producer.email, role: 'Producer' });
    await projectsApi.update(project.id, { review_source_root: studio?.root, review_source_folder: 'shots/live' });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Review shot' });
    const task = await tasksApi.create({
      project: project.id,
      code: `${project.code}_T`,
      title: 'Comp',
      entity_type: 'Shot',
      entity_id: shot.id,
      assignee: artist.user_id,
      reviewer: supervisor.user_id,
    });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, task: task.id, department: 'Compositing', artist: artist.user_id });
    Object.assign(fixture, { project: project.id, version: version.id, code: version.code });
  }, 120000);

  it('a copy the farm account makes is told to the task’s reviewer, the artist and the farm account, once each', async () => {
    await signIn('producer');
    const copy = await reviewMediaApi.fromStorage(fixture.version, { path: 'comp/v001/live_comp.mov' });
    await waitFor(async () => expect((await reviewMediaApi.list(fixture.version))[0]).toMatchObject({ id: copy.id, status: 'ready' }), {
      timeout: 90000,
      interval: 1000,
    });
    await waitFor(async () => expect((await about()).map((n) => n.kind)).toEqual(['review_media_ready']), { timeout: 20000, interval: 500 });

    await signIn('artist');
    expect((await about()).map((n) => [n.kind, n.actor])).toEqual([['review_media_ready', null]]);

    await signIn('supervisor');
    const rows = await about();
    expect(rows.map((n) => [n.kind, n.target.type, n.target.code, n.data, n.actor])).toEqual([['review_media_to_review', 'version', fixture.code, {}, null]]);
  }, 180000);

  it('the supervisor reads it on the Notifications page and opens the version’s Media tab from it', async () => {
    await signIn('supervisor');
    render(tree(<NotificationsPage />));
    const row = await screen.findByText(`${fixture.code} is ready for you to review`, {}, { timeout: 20000 });
    fireEvent.click(row);
    await waitFor(() => expect(screen.getByLabelText('Location').textContent).toBe(`/versions/${fixture.version}?tab=media`), { timeout: 20000 });
    const prefs = await notificationsApi.preferences();
    expect(prefs.mutable_kinds).toContain('review_media_to_review');
  }, 60000);
});
