import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import type { Version } from '@/api/production/review';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ReviewMoviePanel } from '../ReviewMoviePanel';

/** RP-12 (C-RP-31 to C-RP-33): image sequences in the review movie panel, against _review_sequence_flow.json. */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_sequence_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const before = loadSample<Record<string, Captured>>('production/_review_media_flow.json').version_without_media.body as Version;
const uploading = flow.version_uploading.body as Version;
const ready = flow.version_ready.body as Version;
const burnt = flow.version_ready_with_burn_ins.body as Version;
const opened = flow.open_201.body as { id: string };

const path = (c: MockCall) => new URL(c.url).pathname;
const captured = (key: string): MockReply => ({ status: flow[key].status, body: flow[key].body });
const exr = (name: string) => new File([new Uint8Array([0x76, 0x2f, 0x31, 0x01])], name);
const folder = (from: number, to: number, name = 'rps_sh0010_comp') => Array.from({ length: to - from + 1 }, (_, i) => exr(`${name}.${from + i}.exr`));

function mount(version: Version, user: User = admin) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <ReviewMoviePanel version={version} />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}
const panel = () => screen.getByRole('region', { name: 'Review movie' });
const pickFolder = (files: File[]) => fireEvent.change(screen.getByLabelText('Folder of frames to upload'), { target: { files } });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('uploading a sequence', () => {
  it('the folder picker is a folder picker, and frames can also be chosen one by one', () => {
    mockFetch(() => ({ status: 500 }));
    mount(before);
    const input = screen.getByLabelText('Folder of frames to upload') as HTMLInputElement;
    expect(input.hasAttribute('webkitdirectory')).toBe(true);
    expect(input.multiple).toBe(true);
    const frames = screen.getByLabelText('Frames to upload') as HTMLInputElement;
    expect(frames.multiple).toBe(true);
    expect(frames.accept).toBe('.exr,.dpx,.tif,.tiff,.png,.jpg,.jpeg');
    for (const name of ['Upload a sequence', 'Choose frames']) expect(within(panel()).getByRole('button', { name })).toBeTruthy();
  });

  it('opens the sequence with its range, sends the frames in parts of fifty in order, then completes it', async () => {
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST' && path(c).endsWith('/review-media/sequence/')) return captured('open_201');
      if (c.method === 'POST' && path(c).endsWith('/frames/')) return captured('frames_part1_200');
      if (c.method === 'POST' && path(c).endsWith('/complete/')) return captured('complete_202');
      return { status: 200, body: flow.version_queued.body };
    });
    const sent = vi.spyOn(apiClient, 'upload');
    mount(before);
    pickFolder([...folder(1001, 1120), new File(['x'], '.DS_Store'), new File(['x'], 'notes.txt')].reverse());
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/complete/'))).toBe(true));
    const posts = calls.filter((c) => c.method === 'POST').map(path);
    expect(posts).toEqual([
      `/api/v1/versions/${before.id}/review-media/sequence/`,
      `/api/v1/review-media/${opened.id}/frames/`,
      `/api/v1/review-media/${opened.id}/frames/`,
      `/api/v1/review-media/${opened.id}/frames/`,
      `/api/v1/review-media/${opened.id}/complete/`,
    ]);
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ name: 'rps_sh0010_comp', extension: 'exr', first_frame: 1001, last_frame: 1120 });
    const parts = sent.mock.calls.map(([, form]) => (form.getAll('frames') as File[]).map((f) => f.name));
    expect(parts.map((p) => p.length)).toEqual([50, 50, 20]);
    expect(parts[0][0]).toBe('rps_sh0010_comp.1001.exr');
    expect(parts[2][19]).toBe('rps_sh0010_comp.1120.exr');
    expect(sent.mock.calls.every(([, form]) => [...new Set(form.keys())].join() === 'frames')).toBe(true);
  });

  it('a gap is refused in the browser: nothing is sent', async () => {
    const { calls } = mockFetch(() => ({ status: 500 }));
    mount(before);
    pickFolder([...folder(1001, 1003), ...folder(1006, 1008)]);
    expect((await within(panel()).findByRole('alert')).textContent).toBe('2 frames are missing between 1001 and 1008: 1004, 1005.');
    // only the colour options the upload's colour choice reads (RP-15)
    expect(calls.filter((c) => !path(c).endsWith('/review-media/colour/'))).toHaveLength(0);
  });

  it('two sequences in one folder are refused', async () => {
    mockFetch(() => ({ status: 500 }));
    mount(before);
    pickFolder([...folder(1, 2, 'comp'), ...folder(1, 2, 'plate')]);
    expect((await within(panel()).findByRole('alert')).textContent).toMatch(/^These files hold more than one sequence/);
  });

  it('a refused part shows the server’s sentence and the sequence is not completed', async () => {
    const { calls } = mockFetch((c) => {
      if (path(c).endsWith('/review-media/sequence/')) return captured('open_201');
      if (path(c).endsWith('/frames/')) return captured('frames_not_exr_400');
      return { status: 200, body: uploading };
    });
    mount(before);
    pickFolder(folder(1001, 1008));
    expect((await within(panel()).findByRole('alert')).textContent).toBe('rps_sh0010_comp.1005.exr: the content is not EXR.');
    expect(calls.some((c) => path(c).endsWith('/complete/'))).toBe(false);
  });

  it('a refused opening (switched off) shows the server’s sentence', async () => {
    mockFetch(() => captured('open_disabled_409'));
    mount(before);
    pickFolder(folder(1001, 1008));
    expect((await within(panel()).findByRole('alert')).textContent).toBe('Review media uploads are not switched on for this studio.');
  });

  it('without the right to manage the movie there is no sequence upload either', () => {
    mockFetch(() => ({ status: 500 }));
    mount(before, artist);
    expect(within(panel()).queryByRole('button')).toBeNull();
  });
});

describe('an unfinished upload', () => {
  it('says how far it got, blocks new uploads, and can be cancelled', async () => {
    const { calls } = mockFetch((c) => (c.method === 'DELETE' ? captured('cancel_204') : { status: 200, body: flow.version_after_cancel.body }));
    const half = { ...uploading, review_media_job: { ...(uploading.review_media_job as NonNullable<Version['review_media_job']>), sequence: { ...(uploading.review_media_job?.sequence as NonNullable<NonNullable<Version['review_media_job']>['sequence']>), frames_received: 4 } } };
    mount(half);
    const alert = within(panel()).getByRole('alert');
    expect(alert.textContent).toContain('rps_sh0010_comp.[1001-1008].exr: 4 of 8 frames arrived and the upload was not finished.');
    for (const name of ['Upload', 'Upload a sequence', 'Choose frames']) expect((within(panel()).getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(alert).getByRole('button', { name: 'Cancel upload' }));
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`DELETE /api/v1/review-media/${uploading.review_media_job?.id}/`));
  });

  it('someone without the right sees it but cannot cancel it', () => {
    mockFetch(() => ({ status: 500 }));
    mount(uploading, artist);
    expect(within(panel()).getByRole('alert').textContent).toContain('0 of 8 frames arrived');
    expect(within(panel()).queryByRole('button', { name: 'Cancel upload' })).toBeNull();
  });
});

describe('a ready sequence', () => {
  it('shows where it came from, its range and the colour rule', () => {
    mockFetch(() => ({ status: 500 }));
    mount(ready);
    const region = panel();
    expect(within(region).getByText(/A movie made by the server from rps_sh0010_comp\.\[1001-1008\]\.exr/)).toBeTruthy();
    expect(within(region).getByText('640×360 · 24 fps · frames 1001–1008 · EXR')).toBeTruthy();
    // RP-15: the project's colour space is ACEScg, so the frames went through the studio's view
    expect(within(region).getByText('ACEScg → sRGB - Display, ACES 2.0 - SDR 100 nits (Rec.709)')).toBeTruthy();
    expect(within(region).queryByText(/With burn-ins/)).toBeNull();
  });

  it('says when the copy has burn-ins', () => {
    mockFetch(() => ({ status: 500 }));
    mount(burnt);
    expect(within(panel()).getByText('ACEScg → sRGB - Display, ACES 2.0 - SDR 100 nits (Rec.709) · With burn-ins')).toBeTruthy();
  });

  it('a movie made before RP-12 (as stored, no burn-ins) shows no notes', () => {
    mockFetch(() => ({ status: 500 }));
    const movie = loadSample<Record<string, Captured>>('production/_review_media_flow.json').version_ready.body as Version;
    mount(movie);
    expect(within(panel()).queryByText(/colour approval|burn-ins/)).toBeNull();
  });
});
