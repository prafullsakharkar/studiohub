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
 * Review-pipeline RP-23 against a REAL backend started with SYNC_LIVE_MEDIA=1 (C-RP-56, C-RP-57): a studio member opens
 * a version's Media tab, follows the Download link and gets the copy as an attachment named after the version; the
 * download is one audit row; once the project says `nobody` the page offers no link and the one given before is
 * refused. The upload is sent with Node's fetch (jsdom's File loses its bytes in Node's Request; see reviewMedia.live).
 * Skipped without SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; version: string; code: string };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function upload(versionId: string) {
  const movie = fs.readFileSync(live.media?.movie as string);
  const boundary = `----live-download-${uid}`;
  const head = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="live_movie.mov"\r\nContent-Type: video/quicktime\r\n\r\n`);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await fetch(`${live.url}/api/v1/versions/${versionId}/review-media/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: Buffer.concat([head, movie, tail]),
  });
  return response.status;
}
async function openMedia(versionId: string) {
  render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${versionId}`));
  fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
  return screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
}
async function downloads(versionId: string): Promise<number> {
  const response = await fetch(`${live.url}/api/v1/audit/?search=${versionId}&action=EXPORT`, { headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}` } });
  expect(response.status).toBe(200);
  return ((await response.json()) as { count: number }).count;
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!live.media)('downloading a review copy against a live backend (SYNC_LIVE_MEDIA=1, RP-23)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `D${uid}`, name: 'Live review downloads', workflow_type: 'standard' });
    expect(project.review_downloads).toBe('internal');
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Download shot' });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, department: 'Compositing' });
    expect(await upload(version.id)).toBe(202);
    await waitFor(async () => expect((await reviewMediaApi.list(version.id))[0]?.status).toBe('ready'), { timeout: 90000, interval: 1000 });
    Object.assign(fixture, { project: project.id, version: version.id, code: (await versionsApi.get(version.id)).code });
  }, 150000);

  it('the Download link saves the copy as an attachment named after the version, and the download is recorded once', async () => {
    const panel = await openMedia(fixture.version);
    const link = await within(panel).findByRole('link', { name: `Download the review copy of ${fixture.code}` }, { timeout: 20000 });
    const href = link.getAttribute('href') as string;
    expect(href).toMatch(new RegExp(`^${live.url}/api/v1/review-media/[0-9a-f-]+/download/\\?token=`));
    expect(await downloads(fixture.version)).toBe(0);

    const response = await fetch(href); // no session: the signed link is the credential
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('video/mp4');
    expect(response.headers.get('content-disposition')).toBe(`attachment; filename="${fixture.code}.mp4"`);
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    const resumed = await fetch(href, { headers: { Range: 'bytes=100-' } });
    expect(resumed.status).toBe(206);
    await resumed.arrayBuffer();
    expect(await downloads(fixture.version)).toBe(1); // the resumed part is not a second download
  }, 90000);

  it('once the project says nobody the page offers no link and the one given before is refused', async () => {
    const panel = await openMedia(fixture.version);
    const href = (await within(panel).findByRole('link', { name: `Download the review copy of ${fixture.code}` }, { timeout: 20000 })).getAttribute('href') as string;
    cleanup();
    expect((await projectsApi.update(fixture.project, { review_downloads: 'nobody' })).review_downloads).toBe('nobody');
    const again = await openMedia(fixture.version);
    await within(again).findByText(/made by the server from live_movie\.mov/, {}, { timeout: 20000 });
    expect(within(again).queryByRole('link', { name: `Download the review copy of ${fixture.code}` })).toBeNull();
    expect((await fetch(href)).status).toBe(404);
  }, 90000);
});
