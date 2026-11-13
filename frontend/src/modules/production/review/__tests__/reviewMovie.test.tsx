import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { apiClient } from '@/api/client/ApiClient';
import type { Version } from '@/api/production/review';
import type { CardContext } from '@/modules/directory/types';
import type { User } from '@/types/identity';
import { ReviewMoviePanel } from '../ReviewMoviePanel';
import { ReviewViewer } from '../ReviewViewer';
import { VersionWorkspace } from '../VersionWorkspace';
import { VersionMediaTab } from '../VersionMedia';
import { versionCard } from '../versionCard';

/** RP-5: the version's review movie, against the responses captured with a real ffmpeg (_review_media_flow.json). */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_media_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User; // version.view without version.update

const ready = flow.version_ready.body as Version;
const still = flow.version_with_still.body as Version;
const failed = flow.version_with_failed_job.body as Version;
const queued = flow.version_with_queued_job.body as Version;
const none = flow.version_without_media.body as Version;
const reviewFlow = loadSample<Record<string, Captured>>('production/_review_flow.json');

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
const pick = (name: string, body = 'x') => fireEvent.change(screen.getByLabelText('Movie or still to upload'), { target: { files: [new File([body], name)] } });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('the review movie panel', () => {
  it('a ready movie: what the server read, who uploaded it, Replace and Remove', () => {
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={ready} />);
    const region = panel();
    expect(within(region).getByText(/A movie made by the server from comp_v001\.mov/)).toBeTruthy();
    expect(within(region).getByText('1280×720 · 24 fps · 48 frames · h264 · no sound')).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(within(region).getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('without version.update nothing can be uploaded, retried or removed', () => {
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={failed} />, artist);
    const region = panel();
    expect(within(region).queryByRole('button')).toBeNull();
    expect(within(region).getByRole('alert').textContent).toContain('The file could not be read.');
  });

  it('uploads the chosen file as multipart `file` and refetches the version', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? captured('upload_movie_202') : { status: 200, body: queued }));
    // jsdom's File does not survive Node's Request (the body arrives as an empty "blob"): read the form the client was given.
    const sent = vi.spyOn(apiClient, 'upload');
    mount(<ReviewMoviePanel version={none} />);
    pick('comp_v001.mov', 'movie-bytes');
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST') as MockCall;
    expect(path(post)).toBe(`/api/v1/versions/${none.id}/review-media/`);
    expect(post.headers.get('content-type')).toMatch(/^multipart\/form-data; boundary=/);
    const form = sent.mock.calls[0][1];
    expect([...form.keys()]).toEqual(['file']);
    const file = form.get('file') as File;
    expect(file.name).toBe('comp_v001.mov');
    expect(await file.text()).toBe('movie-bytes');
    expect(sent.mock.calls[0][2]).toMatchObject({ timeout: 60 * 60 * 1000 });
    sent.mockRestore();
  });

  it.each([
    ['switched off', 'upload_disabled_409', 'Review media uploads are not switched on for this studio.'],
    ['busy', 'upload_busy_409', 'This version already has an upload being processed. Wait for it to finish.'],
    ['a refused file', 'upload_mismatch_400', "The file's content does not match its extension."],
  ])('a refusal (%s) shows the server’s sentence', async (_label, key, sentence) => {
    mockFetch(() => captured(key));
    mount(<ReviewMoviePanel version={none} />);
    pick('clip.mov');
    expect((await within(panel()).findByRole('alert')).textContent).toBe(sentence);
  });

  it('a queued job is followed and blocks another upload', () => {
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={queued} />);
    expect(within(panel()).getByRole('status').textContent).toBe('comp_v001.mov: Waiting for the media worker…');
    expect((within(panel()).getByRole('button', { name: 'Upload' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a failed job shows its fixed message and retries', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? captured('retry_202') : { status: 200, body: queued }));
    mount(<ReviewMoviePanel version={failed} />);
    const alert = within(panel()).getByRole('alert');
    expect(alert.textContent).toContain('comp_v002.mov: The file could not be read.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/review-media/${failed.review_media_job?.id}/retry/`));
  });

  it('after three attempts there is no Retry: the file has to be uploaded again', () => {
    mockFetch(() => ({ status: 500 }));
    const spent = { ...failed, review_media_job: { ...(failed.review_media_job as NonNullable<Version['review_media_job']>), attempts: 3 } };
    mount(<ReviewMoviePanel version={spent} />);
    const alert = within(panel()).getByRole('alert');
    expect(alert.textContent).toContain('Upload the file again.');
    expect(within(alert).queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('Remove asks first, then deletes the ready row', async () => {
    const { calls } = mockFetch((c) => (c.method === 'DELETE' ? captured('remove_204') : { status: 200, body: flow.version_after_remove.body }));
    mount(<ReviewMoviePanel version={ready} />);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Remove' }));
    expect(calls).toHaveLength(0);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`DELETE /api/v1/review-media/${ready.review_media?.id}/`));
  });
});

describe('the media tab plays the review copy', () => {
  it('a ready movie: the proxy at the probe’s rate, from the version’s first frame', async () => {
    mockFetch(() => ({ status: 200, body: [] }));
    mount(<VersionMediaTab version={ready} />);
    const video = (await screen.findByLabelText(`${ready.code} preview video`)) as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(`http://api.test${ready.review_media?.proxy_url}`);
    expect(video.getAttribute('poster')).toBe(`http://api.test${ready.review_media?.thumbnail_url}`);
    expect(screen.getByLabelText('Current frame').textContent).toBe(String(ready.start_frame));
    expect(screen.getByText('Review copy made by the server')).toBeTruthy();
  });

  it('a still: the proxy is the picture, no video', async () => {
    mockFetch(() => ({ status: 200, body: [] }));
    mount(<VersionMediaTab version={still} />);
    await screen.findByRole('region', { name: 'Review movie' });
    expect(screen.queryByLabelText(`${still.code} preview video`)).toBeNull();
    expect(document.querySelector(`img[src="http://api.test${still.review_media?.proxy_url}"]`)).toBeTruthy();
  });
});

describe('version cards', () => {
  const ctx = { href: '/versions/x' } as unknown as CardContext;

  it('show the generated thumbnail when the version has none, and scrub the filmstrip under the pointer', () => {
    render(<MemoryRouter>{versionCard({ ...ready, thumbnail_url: '' }, ctx)}</MemoryRouter>);
    expect(screen.getByAltText(`${ready.code} thumbnail`).getAttribute('src')).toBe(`http://api.test${ready.review_media?.thumbnail_url}`);
    const scrub = screen.getByTestId('filmstrip-scrub');
    vi.spyOn(scrub, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 480, top: 0, height: 270, right: 480, bottom: 270, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(scrub, { clientX: 240 });
    const frame = scrub.firstElementChild as HTMLElement;
    expect(frame.style.backgroundImage).toBe(`url("http://api.test${ready.review_media?.filmstrip_url}")`);
    expect(frame.style.backgroundSize).toBe('4800% 100%');
    expect(Number.parseFloat(frame.style.backgroundPosition)).toBeCloseTo((24 / 47) * 100, 2); // tile 25 of 48, under the middle
    fireEvent.pointerLeave(scrub);
    expect(scrub.firstElementChild).toBeNull();
  });

  it('keep the version’s own thumbnail, and have no filmstrip without a ready movie', () => {
    render(<MemoryRouter>{versionCard({ ...none, thumbnail_url: 'https://cdn.example.com/own.jpg' }, ctx)}</MemoryRouter>);
    expect(screen.getByAltText(`${none.code} thumbnail`).getAttribute('src')).toBe('https://cdn.example.com/own.jpg');
    expect(screen.queryByTestId('filmstrip-scrub')).toBeNull();
  });
});

describe('the version page follows the job', () => {
  it('refetches the version every 5 seconds while the job is queued, then shows the movie', async () => {
    const { calls } = mockFetch((c) => {
      const gets = calls.filter((x) => x.method === 'GET' && path(x) === `/api/v1/versions/${ready.id}/`).length;
      return { status: 200, body: gets <= 1 ? queued : ready };
    });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter initialEntries={[`/versions/${ready.id}`]}>
            <Routes>
              <Route path="/versions/:versionId" element={<VersionWorkspace />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole('tab', { name: 'Media' }));
    await screen.findByRole('region', { name: 'Review movie' });
    expect(within(panel()).getByRole('status').textContent).toContain('Waiting for the media worker');
    await waitFor(() => expect(screen.getByText('1280×720 · 24 fps · 48 frames · h264 · no sound')).toBeTruthy(), { timeout: 8000 });
    expect(within(panel()).queryByRole('status')).toBeNull();
  }, 12000);

  it.each([
    ['media', 'Media'],
    ['spaceship', 'Overview'],
  ])('`?tab=%s` opens the %s tab (a notification’s link, RP-6)', async (asked, label) => {
    mockFetch(() => ({ status: 200, body: ready }));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter initialEntries={[`/versions/${ready.id}?tab=${asked}`]}>
            <Routes>
              <Route path="/versions/:versionId" element={<VersionWorkspace />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
    const tab = await screen.findByRole('tab', { name: label });
    await waitFor(() => expect(tab.getAttribute('aria-selected')).toBe('true'));
  });
});

describe('the review viewer plays the review copy', () => {
  it('the proxy, its poster, and the probe frame rate', async () => {
    const review = reviewFlow.reviews_start_review.body;
    mockFetch(() => ({ status: 200, body: { ...ready, id: review.versions[0].id } }));
    mount(<ReviewViewer review={review} />);
    const video = (await screen.findByLabelText(/in review video$/)) as HTMLVideoElement;
    expect(video.getAttribute('src')).toBe(`http://api.test${ready.review_media?.proxy_url}`);
    expect(video.getAttribute('poster')).toBe(`http://api.test${ready.review_media?.thumbnail_url}`);
  });
});
