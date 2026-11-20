import fs from 'node:fs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewMediaApi, versionsApi } from '@/api/production/review';
import { projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { VersionWorkspacePage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-25 against a REAL backend started with SYNC_LIVE_MEDIA=1 (C-RP-59): on a project that puts a slate
 * before downloaded copies, the version's Media tab says the download has one; the downloaded file is two seconds longer
 * than the copy the player streams, which is unchanged. Durations are read from each MP4's `mvhd` box. The upload is
 * sent with Node's fetch (jsdom's File loses its bytes in Node's Request; see reviewMedia.live). Skipped without
 * SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { version: string; code: string };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

/** The movie's length in seconds, from its `mvhd` box (version 0 or 1). */
function movieSeconds(bytes: ArrayBuffer): number {
  const data = new DataView(bytes);
  const text = new Uint8Array(bytes);
  for (let i = 4; i + 32 < text.length; i += 1) {
    if (text[i] === 0x6d && text[i + 1] === 0x76 && text[i + 2] === 0x68 && text[i + 3] === 0x64) {
      const version = data.getUint8(i + 4);
      if (version === 1) return Number(data.getBigUint64(i + 28)) / data.getUint32(i + 24);
      return data.getUint32(i + 20) / data.getUint32(i + 16);
    }
  }
  throw new Error('no mvhd box');
}

async function upload(versionId: string) {
  const movie = fs.readFileSync(live.media?.movie as string);
  const boundary = `----live-slates-${uid}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="live_movie.mov"\r\nContent-Type: video/quicktime\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await fetch(`${live.url}/api/v1/versions/${versionId}/review-media/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([head, movie, tail]),
  });
  return response.status;
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!live.media)('slates on downloaded copies against a live backend (SYNC_LIVE_MEDIA=1, RP-25)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({
      code: `S${uid}`,
      name: 'Live review slates',
      workflow_type: 'standard',
      review_slates: true,
      review_slate_note: 'Confidential: 100% "internal"',
    });
    expect([project.review_slates, project.review_slate_note]).toEqual([true, 'Confidential: 100% "internal"']);
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Slate shot' });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, department: 'Compositing' });
    expect(await upload(version.id)).toBe(202);
    await waitFor(async () => expect((await reviewMediaApi.list(version.id))[0]?.status).toBe('ready'), { timeout: 90000, interval: 1000 });
    Object.assign(fixture, { version: version.id, code: (await versionsApi.get(version.id)).code });
  }, 150000);

  it('the download is the copy with a two-second slate first; the player streams the copy, unchanged', async () => {
    const copy = (await versionsApi.get(fixture.version)).review_media;
    expect(copy?.probe).toMatchObject({ slate: true, slate_skipped: null });

    render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${fixture.version}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
    const panel = await screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
    const link = await within(panel).findByRole('link', { name: `Download the review copy of ${fixture.code}` }, { timeout: 20000 });
    expect(link.getAttribute('title')).toBe('Save the review copy, with a two-second slate first and its burn-ins and grade. Downloads are recorded.');
    const video = (await screen.findByLabelText(`${fixture.code} preview video`)) as HTMLVideoElement;
    expect(video.getAttribute('src')).toMatch(/\/proxy\/\?token=/);

    const download = await fetch(link.getAttribute('href') as string);
    expect(download.status).toBe(200);
    expect(download.headers.get('content-disposition')).toBe(`attachment; filename="${fixture.code}.mp4"`);
    const played = await fetch(video.getAttribute('src') as string);
    expect(played.status).toBe(200);
    const [withSlate, plain] = [movieSeconds(await download.arrayBuffer()), movieSeconds(await played.arrayBuffer())];
    expect(withSlate - plain).toBeGreaterThan(1.9);
    expect(withSlate - plain).toBeLessThan(2.2);
    expect(plain).toBeCloseTo((copy?.probe?.frames ?? 0) / (copy?.probe?.fps ?? 1), 1);
  }, 90000);
});
