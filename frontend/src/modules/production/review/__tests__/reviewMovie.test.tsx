import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { apiClient } from '@/api/client/ApiClient';
import { versionsApi } from '@/api/production/review';
import type { Version } from '@/api/production/review';
import { fakeClock } from '@/test/mediaElement';
import type { CardContext } from '@/modules/directory/types';
import type { User } from '@/types/identity';
import { ReviewMoviePanel } from '../ReviewMoviePanel';
import { ReviewViewer } from '../ReviewViewer';
import { VersionWorkspace } from '../VersionWorkspace';
import { VersionCompareTab } from '../VersionExtras';
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

  describe('C-RP-26: the version’s artist (RP-10)', () => {
    const ids = flow.ids as unknown as Record<string, string>;
    const own = flow.rp10_own_version.body as Version;
    const ownReady = flow.rp10_own_version_ready.body as Version;
    // the artist sample (version.view and version.create, no version.update), as the captured artist and colleague
    const asUser = (id: string) => ({ ...artist, id }) as User;

    it('the captured version names the artist, and the artist sample holds version.create without version.update', () => {
      expect(own.artist_id).toBe(ids.artist);
      expect(artist.permissions).toContain('version.create');
      expect(artist.permissions).not.toContain('version.update');
    });

    it('may upload to their own version, and remove its movie', () => {
      mockFetch(() => ({ status: 500 }));
      mount(<ReviewMoviePanel version={own} />, asUser(ids.artist));
      expect(within(panel()).getByRole('button', { name: 'Upload' })).toBeTruthy();
      cleanup();
      mount(<ReviewMoviePanel version={ownReady} />, asUser(ids.artist));
      for (const name of ['Replace', 'Remove']) expect(within(panel()).getByRole('button', { name })).toBeTruthy();
    });

    it('their own version, without version.create, gives no action', () => {
      mockFetch(() => ({ status: 500 }));
      const viewer = { ...artist, id: ids.artist, permissions: artist.permissions.filter((code) => code !== 'version.create') } as User;
      mount(<ReviewMoviePanel version={ownReady} />, viewer);
      expect(within(panel()).queryByRole('button')).toBeNull();
    });

    it('another artist sees the movie but no action', () => {
      mockFetch(() => ({ status: 500 }));
      mount(<ReviewMoviePanel version={ownReady} />, asUser(ids.colleague));
      expect(within(panel()).queryByRole('button')).toBeNull();
    });

    it('when the server refuses the upload (its captured 403), the panel says so', async () => {
      mockFetch((c) => (c.method === 'POST' ? captured('rp10_upload_by_colleague_403') : captured('rp10_own_version')));
      const withRight = { ...artist, id: ids.colleague, permissions: [...artist.permissions, 'version.update'] } as User;
      mount(<ReviewMoviePanel version={own} />, withRight);
      pick('comp_v002.mov');
      await waitFor(() => expect(within(panel()).getByRole('alert').textContent).toBeTruthy());
    });
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

/** A version as served after its links were signed again: the same movie, a new token. */
const renewedLinks = (v: Version): Version => {
  const media = v.review_media as NonNullable<Version['review_media']>;
  const again = (link: string | null) => (link ? `${link}${link.includes('?') ? '&' : '?'}renewed=1` : link);
  return { ...v, review_media: { ...media, proxy_url: again(media.proxy_url), thumbnail_url: again(media.thumbnail_url), filmstrip_url: again(media.filmstrip_url) } };
};
/** The video tells its length (3 s) and the scrub goes to a frame. */
function loadAndGoTo(video: HTMLVideoElement, target: number) {
  fakeClock(video, 3);
  act(() => {
    fireEvent.loadedMetadata(video);
  });
  fireEvent.change(screen.getAllByLabelText('Scrub')[0], { target: { value: String(target) } });
}
function mountWith(client: QueryClient, ui: React.ReactElement) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>{ui}</AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
const newClient = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: Number.POSITIVE_INFINITY } } });

describe('RP-10 WP 10.3: compare plays the review copy', () => {
  // B: another version of the same shot, with only a link of its own (no review copy).
  const own = { ...none, id: 'own-link', code: 'RP5_SH010_V009', video_url: 'https://cdn.example.com/p/own.mp4', thumbnail_url: 'https://cdn.example.com/p/own.jpg', created_at: '2026-11-14T00:00:00Z' } as Version;

  it('the compare tab: A plays its proxy with its thumbnail as poster and the probe’s rate; B, without a ready movie, keeps video_url', async () => {
    const a = { ...ready, fps: '25.000' } as Version; // the probe (24) wins over the version’s own rate
    mockFetch(() => ({ status: 200, body: [a, own] }));
    mount(<VersionCompareTab version={a} />);
    const videoA = (await screen.findByLabelText(`${a.code} video`)) as HTMLVideoElement;
    expect(videoA.getAttribute('src')).toBe(`http://api.test${ready.review_media?.proxy_url}`);
    expect(videoA.getAttribute('poster')).toBe(`http://api.test${ready.review_media?.thumbnail_url}`);
    const videoB = screen.getByLabelText(`${own.code} video`) as HTMLVideoElement;
    expect(videoB.getAttribute('src')).toBe(own.video_url);
    expect(videoB.getAttribute('poster')).toBe(own.thumbnail_url);
    expect(screen.getByText('24 FPS lock')).toBeTruthy();
  });

  it('the review viewer’s compare mode: each side plays what it has', async () => {
    const review = reviewFlow.reviews_start_review.body;
    const first = review.versions[0];
    const second = { ...first, id: own.id, code: own.code, order: first.order + 1 };
    mockFetch((c) => ({ status: 200, body: path(c).includes(own.id) ? own : { ...ready, id: first.id, code: first.code } }));
    mount(<ReviewViewer review={{ ...review, versions: [first, second] }} compareWith={own.id} />);
    const videoA = (await screen.findByLabelText(`${first.code} video`)) as HTMLVideoElement;
    expect(videoA.getAttribute('src')).toBe(`http://api.test${ready.review_media?.proxy_url}`);
    expect(videoA.getAttribute('poster')).toBe(`http://api.test${ready.review_media?.thumbnail_url}`);
    expect((screen.getByLabelText(`${own.code} video`) as HTMLVideoElement).getAttribute('src')).toBe(own.video_url);
    expect(screen.getByText('24 FPS lock')).toBeTruthy();
  });
});

describe('RP-10 WP 10.2: a renewed link does not restart the player', () => {
  it('the media tab: the same video goes on at the frame it was on', async () => {
    mockFetch(() => ({ status: 200, body: [] }));
    const client = newClient();
    const tab = (version: Version) => (
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>
            <VersionMediaTab version={version} />
          </AuthContext.Provider>
        </QueryClientProvider>
      </MemoryRouter>
    );
    const { rerender } = render(tab(ready));
    const video = (await screen.findByLabelText(`${ready.code} preview video`)) as HTMLVideoElement;
    const target = (ready.start_frame ?? 1) + 10;
    loadAndGoTo(video, target);
    const renewed = renewedLinks(ready);
    rerender(tab(renewed));
    const after = screen.getByLabelText(`${ready.code} preview video`) as HTMLVideoElement;
    expect(after).toBe(video);
    expect(after.getAttribute('src')).toBe(`http://api.test${renewed.review_media?.proxy_url}`);
    fakeClock(after, 3);
    act(() => {
      fireEvent.loadedMetadata(after);
    });
    expect(screen.getByLabelText('Current frame').textContent).toBe(String(target));
  });

  it('the review viewer: a refetched version with a new token keeps the frame', async () => {
    const review = reviewFlow.reviews_start_review.body;
    const first = review.versions[0];
    const served = { ...ready, id: first.id, code: first.code } as Version;
    mockFetch(() => ({ status: 200, body: served }));
    const client = newClient();
    mountWith(client, <ReviewViewer review={review} />);
    const video = (await screen.findByLabelText(/in review video$/)) as HTMLVideoElement;
    const target = (ready.start_frame ?? 1) + 10;
    loadAndGoTo(video, target);
    act(() => {
      client.setQueryData([...versionsApi.keys.detail(first.id), 'for-viewer'], renewedLinks(served));
    });
    // React Query tells its observers on a timer.
    await waitFor(() => expect(video.getAttribute('src')).toBe(`http://api.test${renewedLinks(served).review_media?.proxy_url}`));
    const after = screen.getByLabelText(/in review video$/) as HTMLVideoElement;
    expect(after).toBe(video);
    fakeClock(after, 3);
    act(() => {
      fireEvent.loadedMetadata(after);
    });
    expect(screen.getByLabelText('Current frame').textContent).toBe(String(target));
  });

  it('the compare tab: a renewed link on B keeps the frame', async () => {
    const b = { ...ready, id: 'second-ready', code: 'RP5_SH010_V008', created_at: '2026-11-14T00:00:00Z' } as Version;
    mockFetch(() => ({ status: 200, body: [ready, b] }));
    const client = newClient();
    mountWith(client, <VersionCompareTab version={ready} />);
    const videoA = (await screen.findByLabelText(`${ready.code} video`)) as HTMLVideoElement;
    const videoB = screen.getByLabelText(`${b.code} video`) as HTMLVideoElement;
    fakeClock(videoB, 3);
    act(() => {
      fireEvent.loadedMetadata(videoB);
    });
    const target = (ready.start_frame ?? 1) + 10;
    loadAndGoTo(videoA, target);
    act(() => {
      client.setQueryData([...versionsApi.keys.all, 'to-compare', ready.id], [ready, renewedLinks(b)]);
    });
    await waitFor(() => expect(videoB.getAttribute('src')).toBe(`http://api.test${renewedLinks(b).review_media?.proxy_url}`));
    const afterB = screen.getByLabelText(`${b.code} video`) as HTMLVideoElement;
    expect(afterB).toBe(videoB);
    fakeClock(afterB, 3);
    act(() => {
      fireEvent.loadedMetadata(afterB);
    });
    expect(screen.getByLabelText('Current frame').textContent).toBe(String(target));
  });
});

