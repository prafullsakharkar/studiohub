import fs from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewMediaApi, versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { VersionWorkspacePage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-10 (WP 10.6) against a REAL backend started with SYNC_LIVE_MEDIA=1: the harness processes queued
 * rows with the host's ffmpeg in place of the media worker. An artist uploads a movie to their own version (C-RP-26),
 * the version page follows the job to `ready` and plays the proxy through its signed link; on a version that is not
 * theirs the panel offers nothing and the server answers 403. RP-12 (WP 12.7): an EXR sequence sent in two parts.
 * Skipped without SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { own: string; ownCode: string; others: string; othersCode: string; frames: string; framesCode: string };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const page = (
  <Routes>
    <Route path="/versions/:versionId" element={<VersionWorkspacePage />} />
  </Routes>
);

/**
 * The multipart upload, sent by Node's own fetch: jsdom's File does not survive Node's Request (its bytes arrive empty),
 * so the panel's own upload cannot carry a real movie here. Same route, same token, same field as the panel.
 */
async function upload(versionId: string) {
  const movie = fs.readFileSync(live.media?.movie as string);
  const boundary = `----live-${uid}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="live_movie.mov"\r\nContent-Type: video/quicktime\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await fetch(`${live.url}/api/v1/versions/${versionId}/review-media/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([head, movie, tail]),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}
/** RP-12: one part of a sequence's frames, as the panel sends it (field `frames`), by Node's fetch for the same reason. */
async function sendFrames(mediaId: string, numbers: number[]) {
  const boundary = `----live-frames-${uid}`;
  const pieces: Buffer[] = [];
  for (const n of numbers) {
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
  return { status: response.status, body: await response.json().catch(() => null) };
}
const reviewPanel = () => screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
async function openMedia(versionId: string) {
  render(tree(page, `/versions/${versionId}`));
  fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
  return reviewPanel();
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!live.media)('review movies against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `M${uid}`, name: 'Live review movies', workflow_type: 'standard' });
    const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
    const lead = await projectScopedApi.addMember(project.id, { email: live.users.lead.email, role: 'Lead' });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Movie shot' });
    const task = await tasksApi.create({ project: project.id, code: `${project.code}_T`, title: 'Comp', entity_type: 'Shot', entity_id: shot.id, assignee: artist.user_id });
    const own = await versionsApi.create({ project: project.id, shot: shot.id, task: task.id, department: 'Compositing', artist: artist.user_id });
    const others = await versionsApi.create({ project: project.id, shot: shot.id, task: task.id, department: 'Compositing', artist: lead.user_id });
    const frames = await versionsApi.create({ project: project.id, shot: shot.id, task: task.id, department: 'Compositing', artist: artist.user_id });
    // The create answer is the write shape (no `artist_id`): read the version back.
    expect((await versionsApi.get(own.id)).artist_id).toBe(artist.user_id);
    expect((await versionsApi.get(others.id)).artist_id).toBe(lead.user_id);
    Object.assign(fixture, { own: own.id, ownCode: own.code, others: others.id, othersCode: others.code, frames: frames.id, framesCode: frames.code });
    tokenStorage.clearTokens();
    const signed = await authService.login(live.users.artist);
    if (signed.status === 'mfa_required') throw new Error('the artist unexpectedly needs MFA');
  }, 120000);

  it('the artist uploads to their own version; the harness worker makes it ready, and the page plays the proxy through its signed link', async () => {
    const panel = await openMedia(fixture.own);
    expect(within(panel).getByRole('button', { name: 'Upload' })).toBeTruthy(); // C-RP-26, from the real /auth/me

    const sent = await upload(fixture.own);
    expect(sent.status).toBe(202);
    expect(sent.body).toMatchObject({ status: 'queued', kind: 'movie' });

    // The upload went around the panel, so the open page saw no job and does not poll (the panel's own upload refetches;
    // the unit tests cover the polling). The worker takes about a second: wait on the API, then open the page again.
    await waitFor(async () => expect((await reviewMediaApi.list(fixture.own))[0]?.status).toBe('ready'), { timeout: 90000, interval: 1000 });
    cleanup();
    await openMedia(fixture.own);
    await screen.findByText('640×360 · 24 fps · 48 frames · h264 · no sound', {}, { timeout: 20000 });
    const video = (await screen.findByLabelText(`${fixture.ownCode} preview video`)) as HTMLVideoElement;
    const proxy = video.getAttribute('src') as string;
    expect(proxy).toMatch(new RegExp(`^${live.url}/api/v1/review-media/[0-9a-f-]+/proxy/\\?token=`));
    expect(video.getAttribute('poster')).toMatch(/\/thumbnail\/\?token=/);

    // The signed link plays without a session, and answers a range request as a player asks.
    const whole = await fetch(proxy);
    expect(whole.status).toBe(200);
    expect(whole.headers.get('content-type')).toBe('video/mp4');
    const head = await fetch(proxy, { headers: { Range: 'bytes=0-99' } });
    expect(head.status).toBe(206);
    expect((await head.arrayBuffer()).byteLength).toBe(100);
    expect(within(await reviewPanel()).getByRole('button', { name: 'Replace' })).toBeTruthy();
  }, 150000);

  it('on a version that is not theirs the panel offers nothing, and the server answers 403', async () => {
    const panel = await openMedia(fixture.others);
    expect(within(panel).getByText(/^Upload a movie, a still or an image sequence/)).toBeTruthy();
    expect(within(panel).queryByRole('button')).toBeNull();
    expect((await upload(fixture.others)).status).toBe(403);
  }, 60000);

  it('RP-12: a sequence sent in two parts shows as unfinished in between, then plays from its first frame', async () => {
    const opened = await reviewMediaApi.openSequence(fixture.frames, { name: 'live_comp', extension: 'exr', first_frame: 1001, last_frame: 1008 });
    expect(opened).toMatchObject({ kind: 'sequence', status: 'uploading', source_name: 'live_comp.[1001-1008].exr' });
    const first = await sendFrames(opened.id, [1001, 1002, 1003, 1004]);
    expect(first).toEqual({ status: 200, body: { frames_received: 4, frames_expected: 8, missing_frames: [1005, 1006, 1007, 1008] } });

    // Between the parts the page shows how far it got, and blocks another upload.
    const panel = await openMedia(fixture.frames);
    expect(within(panel).getByRole('alert').textContent).toContain('live_comp.[1001-1008].exr: 4 of 8 frames arrived and the upload was not finished.');
    expect((within(panel).getByRole('button', { name: 'Upload a sequence' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByRole('button', { name: 'Cancel upload' })).toBeTruthy();
    cleanup();

    expect((await sendFrames(opened.id, [1005, 1006, 1007, 1008])).body).toEqual({ frames_received: 8, frames_expected: 8, missing_frames: [] });
    expect(await reviewMediaApi.complete(opened.id)).toMatchObject({ status: 'queued' });
    await waitFor(async () => expect((await reviewMediaApi.list(fixture.frames))[0]?.status).toBe('ready'), { timeout: 90000, interval: 1000 });

    // The version's empty range was filled from the frames, and the player counts from 1001.
    const version = await versionsApi.get(fixture.frames);
    expect([version.start_frame, version.end_frame]).toEqual([1001, 1008]);
    await openMedia(fixture.frames);
    await screen.findByText('640×360 · 24 fps · frames 1001–1008 · EXR', {}, { timeout: 20000 });
    // RP-15: a new project's colour space is ACEScg, so the frames go through the studio's view
    expect(screen.getByText('ACEScg → sRGB - Display, ACES 2.0 - SDR 100 nits (Rec.709)')).toBeTruthy();
    const video = (await screen.findByLabelText(`${fixture.framesCode} preview video`)) as HTMLVideoElement;
    expect(screen.getByLabelText('Current frame').textContent).toBe('1001');
    const proxy = await fetch(video.getAttribute('src') as string);
    expect(proxy.status).toBe(200);
    expect(proxy.headers.get('content-type')).toBe('video/mp4');
  }, 180000);
});
