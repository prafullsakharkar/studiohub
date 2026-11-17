import fs from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewCopiesApi, reviewMediaApi, versionsApi } from '@/api/production/review';
import { projectsApi, sequencesApi } from '@/api/production/structure';
import type { Project } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { ReviewCopiesNotice } from '@/modules/production/review/ReviewCopiesNotice';
import { VersionWorkspacePage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-14 (WP 14.6) against a REAL backend started with SYNC_LIVE_MEDIA=1 (the harness processes queued
 * rows with the host's ffmpeg). The manager uploads a movie with burn-ins off, then turns the project's switch on: the
 * project's notice counts the copy made without them, "Remake them" remakes it, and the version's copy now has burn-ins
 * (C-RP-37, C-RP-38). The version page's own Remake makes another copy, which replaces the first. Skipped without
 * SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: Project; version: string };

const tree = (ui: React.ReactElement, initial = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

/** The multipart upload by Node's fetch (jsdom's File loses its bytes in Node's Request; see reviewMedia.live). */
async function upload(versionId: string) {
  const movie = fs.readFileSync(live.media?.movie as string);
  const boundary = `----live-remake-${uid}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="live_movie.mov"\r\nContent-Type: video/quicktime\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await fetch(`${live.url}/api/v1/versions/${versionId}/review-media/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([head, movie, tail]),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
const newest = async () => (await reviewMediaApi.list(fixture.version))[0];

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!live.media)('remaking review copies against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `R${uid}`, name: 'Live remakes', workflow_type: 'standard' });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Remake shot' });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, department: 'Compositing' });
    Object.assign(fixture, { project, version: version.id });
  }, 120000);

  it('the switch goes on, the notice offers the remake, and the remade copy has burn-ins', async () => {
    expect((await upload(fixture.version)).status).toBe(202);
    await waitFor(async () => expect((await newest())?.status).toBe('ready'), { timeout: 90000, interval: 1000 });
    const original = await newest();
    expect(original.probe?.burn_ins).toBe(false);
    expect(await reviewCopiesApi.get(fixture.project.id)).toEqual({ review_burn_ins: false, out_of_date: 0, sequences_out_of_date: 0 });

    // the write answer is the write shape (no `id`): the notice gets the project read back, as the workspace has it
    expect((await projectsApi.update(fixture.project.id, { review_burn_ins: true })).review_burn_ins).toBe(true);
    render(tree(<ReviewCopiesNotice project={await projectsApi.get(fixture.project.id)} />));
    const notice = await screen.findByRole('region', { name: 'Review copies' }, { timeout: 20000 });
    expect(notice.textContent).toContain('1 review copy was made without burn-ins; the project now adds them.');
    fireEvent.click(within(notice).getByRole('button', { name: 'Remake them' }));
    await within(notice).findByText('Remaking 1 review copy. Each one replaces its old copy when it is ready.', {}, { timeout: 20000 });

    await waitFor(
      async () => {
        const row = await newest();
        expect(row.status).toBe('ready');
        expect(row.remake_of).toBe(original.id);
      },
      { timeout: 90000, interval: 1000 },
    );
    const remade = await newest();
    expect(remade.probe?.burn_ins).toBe(true);
    const rows = await reviewMediaApi.list(fixture.version);
    expect(rows.find((r) => r.id === original.id)?.status).toBe('superseded');
    // the notice reads the counts again while it remakes, and goes once every copy matches
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Review copies' })).toBeNull(), { timeout: 30000, interval: 1000 });
  }, 240000);

  it('the version page remakes its copy, and the new one replaces it', async () => {
    const before = await newest();
    render(
      tree(
        <Routes>
          <Route path="/versions/:versionId" element={<VersionWorkspacePage />} />
        </Routes>,
        `/versions/${fixture.version}`,
      ),
    );
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
    const panel = await screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
    expect(within(panel).getByText(/With burn-ins/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Remake' }));
    await waitFor(
      async () => {
        const row = await newest();
        expect(row.remake_of).toBe(before.id);
        expect(row.status).toBe('ready');
      },
      { timeout: 90000, interval: 1000 },
    );
    expect((await reviewMediaApi.list(fixture.version)).find((r) => r.id === before.id)?.status).toBe('superseded');
  }, 180000);
});
