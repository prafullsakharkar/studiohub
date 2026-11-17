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
 * Review-pipeline RP-16 (WP 16.6) against a REAL backend started with SYNC_LIVE_MEDIA=1 (the harness processes queued
 * rows with the host's ffmpeg). A sequence's frames are kept once its copy is ready (C-RP-41): the version page says until
 * when and offers Remake. After the project's view changes, its notice lists the copy, linking to its version (C-RP-42),
 * and "Remake them" remakes the sequence from its kept frames with the new view. Keeping a copy as it is (C-RP-43) needs
 * a sequence whose frames are gone, which the sweep makes after days; it is covered by the backend and jsdom tests.
 * Skipped without SYNC_LIVE_MEDIA.
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

/** The frames by Node's fetch (jsdom's File loses its bytes in Node's Request; see reviewMedia.live). */
async function sendFrames(mediaId: string) {
  const boundary = `----live-sequence-copies-${uid}`;
  const pieces: Buffer[] = [];
  for (let n = 1001; n <= 1008; n += 1) {
    const name = `live_comp.${n}.exr`;
    pieces.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="frames"; filename="${name}"\r\nContent-Type: image/x-exr\r\n\r\n`));
    pieces.push(fs.readFileSync(`${live.media?.sequence}/${name}`), Buffer.from('\r\n'));
  }
  pieces.push(Buffer.from(`--${boundary}--\r\n`));
  const response = await fetch(`${live.url}/api/v1/review-media/${mediaId}/frames/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat(pieces),
  });
  return response.status;
}

const ready = async () => {
  await waitFor(async () => expect((await reviewMediaApi.list(fixture.version))[0]?.status).toBe('ready'), { timeout: 90000, interval: 1000 });
  return (await reviewMediaApi.list(fixture.version))[0];
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!live.media)('sequence copies after a settings change against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `K${uid}`, name: 'Live sequence copies', workflow_type: 'standard' });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Kept shot' });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, department: 'Compositing' });
    Object.assign(fixture, { project: await projectsApi.get(project.id), version: version.id });
  }, 120000);

  it('a ready sequence keeps its frames: the version page says until when and offers Remake', async () => {
    const opened = await reviewMediaApi.openSequence(fixture.version, { name: 'live_comp', extension: 'exr', first_frame: 1001, last_frame: 1008 });
    expect(await sendFrames(opened.id)).toBe(200);
    await reviewMediaApi.complete(opened.id);
    const row = await ready();
    expect(row.frames_until).not.toBeNull();

    render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${fixture.version}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
    const panel = await screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
    await within(panel).findByText(/^Frames kept until /, {}, { timeout: 20000 });
    expect(within(panel).getByRole('button', { name: 'Remake' })).toBeTruthy();
  }, 180000);

  it('after a change of view the notice lists the copy and Remake them remakes it from its frames', async () => {
    const before = (await reviewMediaApi.list(fixture.version))[0];
    await projectsApi.update(fixture.project.id, { review_view: 'Un-tone-mapped' });
    // the PATCH answers the update serializer's fields, without `id`; read the project back
    const project = await projectsApi.get(fixture.project.id);
    const copies = await reviewCopiesApi.get(project.id);
    expect(copies).toMatchObject({ sequences_out_of_date: 1, colour_out_of_date: 1, differing_more: 0 });
    expect(copies.differing).toEqual([
      expect.objectContaining({ review_media_id: before.id, kind: 'sequence', remakable: true, why: ['colour'], version: { id: fixture.version, code: expect.any(String) } }),
    ]);

    render(tree(<ReviewCopiesNotice project={project} />));
    const notice = await screen.findByRole('region', { name: 'Review copies' }, { timeout: 20000 });
    expect(notice.textContent).toContain('1 can be remade while its frames are kept.');
    fireEvent.click(within(notice).getByRole('button', { name: 'Show which' }));
    const link = within(within(notice).getByRole('list')).getByRole('link');
    expect(link.getAttribute('href')).toBe(`/versions/${fixture.version}`);
    fireEvent.click(within(notice).getByRole('button', { name: 'Remake them' }));
    await within(notice).findByText('Remaking 1 review copy. Each one replaces its old copy when it is ready.', {}, { timeout: 20000 });
    cleanup();

    await waitFor(
      async () => {
        const shown = (await reviewMediaApi.list(fixture.version)).find((r) => r.status === 'ready');
        expect(shown?.remake_of).toBe(before.id);
      },
      { timeout: 90000, interval: 1000 },
    );
    const remade = (await reviewMediaApi.list(fixture.version)).find((r) => r.status === 'ready');
    expect(remade).toMatchObject({ kind: 'sequence', frames_until: before.frames_until });
    expect(remade?.probe?.ocio).toMatchObject({ view: 'Un-tone-mapped' });
    expect(await reviewCopiesApi.get(project.id)).toMatchObject({ sequences_out_of_date: 0, differing: [] });
  }, 240000);
});
