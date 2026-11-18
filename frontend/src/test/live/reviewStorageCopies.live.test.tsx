import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewMediaApi } from '@/api/production/review';
import { publishedFilesApi, storageRootsApi } from '@/api/publishing/publishing';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { PublishedFilePage } from '@/modules/publishing';
import { VersionWorkspacePage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-17 (WP 17.7) against a REAL backend started with SYNC_LIVE_MEDIA=1: the harness mounts a temporary
 * studio root (code LIVE) holding eight EXR frames and a movie, and processes queued rows with the host's ffmpeg.
 * The frames and the movie are registered as published files of one of the harness's published versions; the version page's picker makes the copy from
 * the frames (C-RP-44, C-RP-45), the file page makes it from the movie, and revoking the movie's file leaves its copy
 * shown but no longer remakable (C-RP-46). Skipped without SYNC_LIVE_MEDIA.
 */
const fixture = {} as { version: string; sequenceFile: string; movieFile: string };
const studio = live.media?.studio;

const tree = (ui: React.ReactElement, initial = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

/** The newest ready copy once the worker made it from `fileId`. */
const readyFrom = async (fileId: string) => {
  await waitFor(
    async () => {
      const rows = await reviewMediaApi.list(fixture.version);
      expect(rows.find((r) => r.status === 'ready' && r.published_file_id === fileId)).toBeTruthy();
      expect(rows.some((r) => r.status === 'queued' || r.status === 'processing')).toBe(false);
    },
    { timeout: 90000, interval: 1000 },
  );
  return (await reviewMediaApi.list(fixture.version)).find((r) => r.status === 'ready' && r.published_file_id === fileId);
};

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!studio)('review copies from studio storage against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    if (!studio) return;
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    // files are registered to published versions only, and publishing needs another user's approval: the harness's own
    const version = live.dlv.versions[3];
    await storageRootsApi.create({ code: studio.root, name: 'Live studio', linux_path: '/mnt/live' });
    const declared = { size_bytes: 1, sha256: '0'.repeat(64) };
    const frames = await publishedFilesApi.create({ version_id: version.id, storage_root: studio.root, relative_path: studio.sequence, frame_start: 1001, frame_end: 1008, ...declared });
    const movie = await publishedFilesApi.create({ version_id: version.id, storage_root: studio.root, relative_path: studio.movie, ...declared });
    Object.assign(fixture, { version: version.id, sequenceFile: frames.id, movieFile: movie.id });
  }, 120000);

  it('the version page lists its published files and makes the copy from the frames, read where they lie', async () => {
    render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${fixture.version}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
    const panel = await screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
    fireEvent.click(within(panel).getByRole('button', { name: 'From a published file' }));
    const list = await within(panel).findByRole('region', { name: 'Published files of this version' }, { timeout: 20000 });
    const row = (await within(list).findByText(new RegExp(studio?.sequence.replace(/[.%]/g, '\\$&') ?? ''), {}, { timeout: 20000 })).closest('li') as HTMLElement;
    expect(row.textContent).toContain('frames 1001–1008 (8)');
    // the harness's own plate is on a root this server does not read: listed with the server's reason, no button
    const plate = (await within(list).findByText(/plate\.exr/)).closest('li') as HTMLElement;
    expect(plate.textContent).toMatch(/The server does not read the storage root /);
    expect(within(plate).queryByRole('button')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Make the copy' }));
    const copy = await readyFrom(fixture.sequenceFile);
    expect(copy).toMatchObject({ kind: 'sequence', storage_readable: true, frames_until: null, source_name: 'live_comp.%04d.exr [1001-1008]' });
    expect(copy?.probe).toMatchObject({ first_frame: 1001, last_frame: 1008 });
    await within(panel).findByRole('link', { name: 'live_comp.%04d.exr [1001-1008]' }, { timeout: 20000 });
    expect(within(panel).getByLabelText('Review copy').textContent).toContain('it can be remade at any time');
    expect(within(panel).getByRole('button', { name: 'Remake' })).toBeTruthy();
  }, 180000);

  it('the file page makes the copy from the movie', async () => {
    render(tree(<Routes><Route path="/publishing/files/:fileId" element={<PublishedFilePage />} /></Routes>, `/publishing/files/${fixture.movieFile}`));
    fireEvent.click(await screen.findByRole('button', { name: 'Make review copy' }, { timeout: 20000 }));
    const copy = await readyFrom(fixture.movieFile);
    expect(copy).toMatchObject({ kind: 'movie', storage_readable: true, source_name: 'live_comp.mov' });
    expect(copy?.probe).toMatchObject({ frames: 48 });
  }, 180000);

  it('revoking the movie’s file keeps its copy, which can no longer be remade', async () => {
    await publishedFilesApi.revoke(fixture.movieFile, 'Live: wrong render');
    const shown = (await reviewMediaApi.list(fixture.version)).find((r) => r.status === 'ready' && r.published_file_id === fixture.movieFile);
    expect(shown?.storage_readable).toBe(false);
    await expect(reviewMediaApi.remake(shown?.id ?? '')).rejects.toMatchObject({ status: 400 });
    expect((await publishedFilesApi.get(fixture.movieFile)).review_copy_refusal).toBe('This file was revoked; a review copy cannot be made from it.');

    render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${fixture.version}`));
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
    const panel = await screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
    await within(panel).findByText(/Its published file can no longer be read/, {}, { timeout: 20000 });
    expect(within(panel).queryByRole('button', { name: 'Remake' })).toBeNull();
  }, 120000);
});
