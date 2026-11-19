import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewCopies, ReviewMedia, Version } from '@/api/production/review';
import type { PublishedFile } from '@/api/publishing/publishing';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { MakeReviewCopy } from '@/modules/publishing/FilePages';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { differingText, remadeText, sequencesText } from '../ReviewCopiesNotice';
import { candidateText, copyCandidates } from '../ReviewFromPublishedFile';
import { canRemake, framesText, ReviewMoviePanel, storageText } from '../ReviewMoviePanel';

/**
 * RP-17 (C-RP-44 to C-RP-46): review copies read from studio storage, against _review_storage_copies_flow.json
 * (captured with a real ffmpeg on a temporary storage root).
 */
type Captured = { status: number; body: unknown };
const flow = loadSample<Record<string, Captured>>('production/_review_storage_copies_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User; // publishing.view and version.create, not version.update
const ids = flow.ids as unknown as Record<string, string>;
const fromMovie = flow.version_from_movie.body as Version;
const revoked = flow.version_after_revoke.body as Version;
const failed = flow.version_escaping_failed.body as Version;
const filesOfVersion = flow.files_of_version.body as { results: PublishedFile[] };
const copy = (v: Version) => v.review_media as ReviewMedia;

const path = (c: MockCall) => new URL(c.url).pathname;
const captured = (key: string): MockReply => ({ status: flow[key].status, body: flow[key].body });

function mount(ui: React.ReactElement, user: User = admin) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>{ui}</AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
const panel = () => screen.getByRole('region', { name: 'Review movie' });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('a copy read from a published file (C-RP-44, C-RP-46)', () => {
  it('names its file with a link, says it can be remade at any time, and remakes from the file', async () => {
    const media = copy(fromMovie);
    expect(canRemake(media)).toBe(true);
    expect(framesText(media)).toBeNull();
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 202, body: media } : { status: 200, body: fromMovie }));
    mount(<ReviewMoviePanel version={fromMovie} />);
    const link = within(panel()).getByRole('link', { name: media.source_name });
    expect(link.getAttribute('href')).toBe(`/publishing/files/${ids.movie_file}`);
    expect(within(panel()).getByLabelText('Review copy').textContent).toContain('it can be remade at any time');
    const remake = within(panel()).getByRole('button', { name: 'Remake' });
    expect(remake.getAttribute('title')).toContain('published file on studio storage');
    fireEvent.click(remake);
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/review-media/${media.id}/remake/`));
  });

  it('once its file is revoked there is no Remake, and the panel says why', () => {
    const media = copy(revoked);
    expect(media.storage_readable).toBe(false);
    expect(canRemake(media)).toBe(false);
    // a movie too: the rule is the file's, not the kind's (a movie upload can always be remade)
    expect(canRemake({ ...copy(fromMovie), storage_readable: false })).toBe(false);
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={revoked} />);
    expect(within(panel()).queryByRole('button', { name: 'Remake' })).toBeNull();
    expect(within(panel()).getByLabelText('Review copy').textContent).toContain('Its published file can no longer be read');
    expect(within(panel()).queryByText(/Frames (kept|no longer)/)).toBeNull();
  });

  it('without publishing.view the file is named, not linked, and there is no picker', () => {
    const noFiles = { ...artist, permissions: (artist.permissions ?? []).filter((p) => p !== 'publishing.view') } as User;
    mockFetch(() => ({ status: 200, body: fromMovie }));
    mount(<ReviewMoviePanel version={{ ...fromMovie, artist_id: noFiles.id }} />, noFiles);
    expect(within(panel()).queryByRole('link', { name: copy(fromMovie).source_name })).toBeNull(); // the one link is Download (RP-23)
    expect(within(panel()).getByText(/made by the server from the published file/).textContent).toContain(copy(fromMovie).source_name);
    expect(within(panel()).getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(within(panel()).queryByRole('button', { name: 'From a published file' })).toBeNull();
  });

  it('an upload says nothing about storage', () => {
    expect(storageText({ ...copy(fromMovie), source: 'upload', published_file_id: null, storage_readable: false })).toBeNull();
    expect(canRemake({ ...copy(fromMovie), source: 'upload', published_file_id: null, storage_readable: false })).toBe(true);
  });

  it('a file the worker could not read fails with the server’s sentence and can be retried', () => {
    mockFetch(() => ({ status: 200, body: failed }));
    mount(<ReviewMoviePanel version={failed} />);
    const alert = within(panel()).getByRole('alert');
    expect(alert.textContent).toContain('The published file could not be read from studio storage.');
    expect(within(alert).getByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});

describe('the picker (C-RP-44)', () => {
  it('lists the version’s main and proxy files, with the server’s refusal or a button', () => {
    const candidates = copyCandidates(filesOfVersion.results);
    expect(candidates.map((f) => f.role)).toEqual(['main', 'main']);
    expect(candidateText(candidates[0])).toBe('shots/sh020/comp/v001/rpt_sh020_comp_v001.mov · checksum not checked yet');
    const sequence = flow.file_sequence.body as PublishedFile;
    expect(candidateText({ ...sequence, checksum_state: 'verified' })).toBe('shots/sh010/comp/v001/rpt_sh010_comp_v001.%04d.exr · frames 1001–1002 (2)');
    expect(copyCandidates([{ ...sequence, status: 'Revoked' }])).toEqual([]);
  });

  it('opens on demand, asks by version_id, and makes the copy from the chosen file with the colour space', async () => {
    const version = { ...fromMovie, review_media: null, review_media_job: null } as Version;
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return captured('copy_movie_202');
      if (path(c) === '/api/v1/publishing/files/') return { status: 200, body: filesOfVersion };
      return { status: 200, body: version };
    });
    mount(<ReviewMoviePanel version={version} />);
    await new Promise((resolve) => setTimeout(resolve, 50)); // time enough for a query that would run on mount
    expect(calls.some((c) => path(c) === '/api/v1/publishing/files/')).toBe(false);
    fireEvent.click(within(panel()).getByRole('button', { name: 'From a published file' }));
    const list = await screen.findByRole('region', { name: 'Published files of this version' });
    await within(list).findByText('The server does not read the storage root ARCHIVE.');
    const asked = calls.find((c) => path(c) === '/api/v1/publishing/files/');
    expect(new URL(asked?.url ?? '').searchParams.get('version_id')).toBe(fromMovie.id);
    expect(list.textContent).not.toContain('.nk');
    const buttons = within(list).getAllByRole('button', { name: 'Make the copy' });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/publishing/files/${ids.movie_file}/review-copy/`));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body ?? {}).toEqual({});
  });

  it('a refusal from the server is shown in the panel', async () => {
    const version = { ...fromMovie, review_media: null, review_media_job: null } as Version;
    mockFetch((c) => {
      if (c.method === 'POST') return captured('copy_busy_409');
      if (path(c) === '/api/v1/publishing/files/') return { status: 200, body: filesOfVersion };
      return { status: 200, body: version };
    });
    mount(<ReviewMoviePanel version={version} />);
    fireEvent.click(within(panel()).getByRole('button', { name: 'From a published file' }));
    const list = await screen.findByRole('region', { name: 'Published files of this version' });
    fireEvent.click(await within(list).findByRole('button', { name: 'Make the copy' }));
    expect(await within(panel()).findByText('This version already has an upload being processed. Wait for it to finish.')).toBeTruthy();
  });
});

describe("the project's list (C-RP-46)", () => {
  it('the sentences', () => {
    const after = flow.copies_after_revoke.body as ReviewCopies;
    expect(sequencesText(after)).toBe(
      '1 image sequence was made with other settings. 1 can no longer read its published file: keep the copies as they are, or make them from another file.',
    );
    expect(sequencesText(flow.copies_switch_on.body as ReviewCopies)).toBe('1 image sequence was made with other settings. 1 can be remade from its published file.');
    const [sequence, movie] = after.differing;
    expect(differingText(sequence)).toBe('burn-ins differ · its published file can no longer be read');
    expect(differingText(movie)).toBe('burn-ins differ · can be remade from its published file');
    expect(remadeText(flow.remake_after_revoke_200.body as Parameters<typeof remadeText>[0])).toBe(
      // RP-18: copies read by path count here too, so the sentence names studio storage, not published files
      'Remaking 1 review copy. 1 left: their files on studio storage can no longer be read.',
    );
  });
});

describe('Make review copy on the file page (C-RP-44)', () => {
  it('posts for a file that can be used and says so', async () => {
    const { calls } = mockFetch(() => captured('copy_sequence_202'));
    mount(<MakeReviewCopy file={flow.file_sequence.body as PublishedFile} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make review copy' }));
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/publishing/files/${ids.sequence_file}/review-copy/`));
  });

  it('shows the server’s refusal instead of the button, and the 403 when the version is not the caller’s', async () => {
    mockFetch(() => ({ status: 500 }));
    mount(<MakeReviewCopy file={flow.file_sidecar.body as PublishedFile} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/thumbnail or sidecar/)).toBeTruthy();
    cleanup();
    mockFetch(() => captured('copy_by_artist_403'));
    mount(<MakeReviewCopy file={flow.file_sequence.body as PublishedFile} />, artist);
    fireEvent.click(screen.getByRole('button', { name: 'Make review copy' }));
    expect((await screen.findByRole('alert')).textContent).toContain('permission');
  });

  it('is not offered without a version right', () => {
    const reader = { ...artist, permissions: (artist.permissions ?? []).filter((p) => !p.startsWith('version.')) } as User;
    mockFetch(() => ({ status: 500 }));
    mount(<MakeReviewCopy file={flow.file_sequence.body as PublishedFile} />, reader);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/review copy/i)).toBeNull();
  });
});
