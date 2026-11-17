import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import type { ReviewCopies, Version } from '@/api/production/review';
import type { Project } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { outOfDateText, ReviewCopiesNotice } from '../ReviewCopiesNotice';
import { colourText, ReviewMoviePanel } from '../ReviewMoviePanel';

/** RP-15 (C-RP-39, C-RP-40): colour management in the review movie panel and the copies notice, against _review_colour_flow.json. */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_colour_flow.json');
const sequences = loadSample<Record<string, Captured>>('production/_review_sequence_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const throughView = flow.version_sequence_ocio.body as Version;
const named = flow.version_movie_ocio.body as Version;
const plain = flow.version_movie_as_stored.body as Version;
const unmanaged = flow.version_sequence_unmanaged.body as Version;
const project = flow.project_default.body as Project;
const SDR = 'sRGB - Display, ACES 2.0 - SDR 100 nits (Rec.709)';

const path = (c: MockCall) => new URL(c.url).pathname;
const captured = (key: string): MockReply => ({ status: flow[key].status, body: flow[key].body });
const isOptions = (c: MockCall) => path(c).endsWith('/review-media/colour/');

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
const choice = () => screen.getByLabelText('Colour space of the upload') as HTMLSelectElement;

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('how a copy’s colour was made (C-RP-40)', () => {
  it('EXR frames through the project’s view', () => {
    mockFetch((c) => (isOptions(c) ? captured('colour_options') : { status: 500 }));
    mount(<ReviewMoviePanel version={throughView} />);
    expect(within(panel()).getByText(`ACEScg → ${SDR}`)).toBeTruthy();
    expect(colourText(throughView.review_media!)).toBe(`ACEScg → ${SDR}`);
  });

  it('a movie that named its colour space, remade with another view', () => {
    mockFetch((c) => (isOptions(c) ? captured('colour_options') : { status: 500 }));
    mount(<ReviewMoviePanel version={flow.version_movie_remade.body as Version} />);
    expect(within(panel()).getByText('ACEScct → sRGB - Display, Un-tone-mapped')).toBeTruthy();
    expect(colourText(named.review_media!)).toBe(`ACEScct → ${SDR}`);
  });

  it('a look is named after the view', () => {
    const media = { ...named.review_media!, probe: { ...named.review_media!.probe!, ocio: { ...named.review_media!.probe!.ocio!, look: 'ACES 1.3 Reference Gamut Compression' } } };
    expect(colourText(media)).toBe(`ACEScct → ${SDR} with ACES 1.3 Reference Gamut Compression`);
  });

  it('a display-ready movie says nothing about colour', () => {
    mockFetch((c) => (isOptions(c) ? captured('colour_options') : { status: 500 }));
    mount(<ReviewMoviePanel version={plain} />);
    expect(within(panel()).queryByText(/→/)).toBeNull();
    expect(within(panel()).queryByText(/colour not managed/)).toBeNull();
    expect(colourText(plain.review_media!)).toBeNull();
  });

  it('a copy made without the config says why, and that it is not for colour approval', () => {
    mockFetch((c) => (isOptions(c) ? captured('colour_options') : { status: 500 }));
    mount(<ReviewMoviePanel version={unmanaged} />);
    expect(
      within(panel()).getByText("colour not managed: the studio's colour config could not be read · EXR shown as sRGB from linear light; not for colour approval"),
    ).toBeTruthy();
  });
});

describe('naming the colour space of an upload (C-RP-40)', () => {
  const before = loadSample<Record<string, Captured>>('production/_review_media_flow.json').version_without_media.body as Version;

  it('a movie is sent with the chosen colour space, grouped by family', async () => {
    mockFetch((c) => (isOptions(c) ? captured('colour_options') : c.method === 'POST' ? captured('movie_named_202') : { status: 200, body: named }));
    const sent = vi.spyOn(apiClient, 'upload');
    mount(<ReviewMoviePanel version={before} />);
    await waitFor(() => expect(choice().options.length).toBeGreaterThan(10));
    expect(choice().options[0].textContent).toBe("Colour: the project's rule");
    expect(within(choice()).getByRole('group', { name: 'ACES' })).toBeTruthy();
    fireEvent.change(choice(), { target: { value: 'ACEScct' } });
    fireEvent.change(screen.getByLabelText('Movie or still to upload'), { target: { files: [new File(['x'], 'log.mp4')] } });
    await waitFor(() => expect(sent).toHaveBeenCalled());
    const form = sent.mock.calls[0][1] as FormData;
    expect(form.get('color_space')).toBe('ACEScct');
    expect((form.get('file') as File).name).toBe('log.mp4');
  });

  it('without a choice nothing is named: the project’s rule applies', async () => {
    mockFetch((c) => (isOptions(c) ? captured('colour_options') : c.method === 'POST' ? captured('movie_named_202') : { status: 200, body: plain }));
    const sent = vi.spyOn(apiClient, 'upload');
    mount(<ReviewMoviePanel version={before} />);
    await waitFor(() => expect(choice().options.length).toBeGreaterThan(10));
    fireEvent.change(screen.getByLabelText('Movie or still to upload'), { target: { files: [new File(['x'], 'plain.mp4')] } });
    await waitFor(() => expect(sent).toHaveBeenCalled());
    expect([...(sent.mock.calls[0][1] as FormData).keys()]).toEqual(['file']);
  });

  it('a sequence is opened with the chosen colour space', async () => {
    const { calls } = mockFetch((c) => {
      if (isOptions(c)) return captured('colour_options');
      if (path(c).endsWith('/review-media/sequence/')) return { status: sequences.open_201.status, body: sequences.open_201.body };
      if (path(c).endsWith('/frames/')) return { status: sequences.frames_part1_200.status, body: sequences.frames_part1_200.body };
      if (path(c).endsWith('/complete/')) return { status: sequences.complete_202.status, body: sequences.complete_202.body };
      return { status: 200, body: sequences.version_queued.body };
    });
    mount(<ReviewMoviePanel version={before} />);
    await waitFor(() => expect(choice().options.length).toBeGreaterThan(10));
    fireEvent.change(choice(), { target: { value: 'ADX10' } });
    const frames = [1001, 1002].map((n) => new File([new Uint8Array([0x53, 0x44, 0x50, 0x58])], `plate.${n}.dpx`));
    fireEvent.change(screen.getByLabelText('Folder of frames to upload'), { target: { files: frames } });
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/complete/'))).toBe(true));
    expect(calls.find((c) => path(c).endsWith('/review-media/sequence/'))?.body).toEqual({ name: 'plate', extension: 'dpx', first_frame: 1001, last_frame: 1002, color_space: 'ADX10' });
  });

  it('no choice when the config cannot be read', async () => {
    const { calls } = mockFetch((c) => (isOptions(c) ? captured('colour_options_unavailable') : { status: 500 }));
    mount(<ReviewMoviePanel version={before} />);
    await waitFor(() => expect(calls.some(isOptions)).toBe(true));
    expect(screen.queryByLabelText('Colour space of the upload')).toBeNull();
    expect(within(panel()).getByRole('button', { name: 'Upload' })).toBeTruthy();
  });

  it('someone who cannot upload does not read the options', async () => {
    const { calls } = mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={plain} />, artist);
    expect(within(panel()).queryByRole('button', { name: 'Upload' })).toBeNull();
    await new Promise((r) => setTimeout(r, 20));
    expect(calls.filter(isOptions)).toHaveLength(0);
  });
});

describe('copies made with other colour settings (Q-RP-72)', () => {
  it('the notice says colour or burn-ins differ, and counts the sequence', async () => {
    mockFetch((c) => (path(c).endsWith('/review-copies/') ? captured('copies_other_view') : { status: 500 }));
    mount(<ReviewCopiesNotice project={project} />);
    const region = await screen.findByRole('region', { name: 'Review copies' });
    expect(region.textContent).toContain('1 review copy was made with other colour or burn-in settings than the project has now.');
    expect(region.textContent).toContain('1 image sequence was made with other settings.');
    expect(within(region).getByRole('button', { name: 'Remake them' })).toBeTruthy();
  });

  it('only burn-ins differing keeps RP-14’s sentence', () => {
    const c: ReviewCopies = { review_burn_ins: true, out_of_date: 2, sequences_out_of_date: 0, colour_out_of_date: 0 };
    expect(outOfDateText(c)).toBe('2 review copies were made without burn-ins; the project now adds them.');
    expect(outOfDateText({ ...c, colour_out_of_date: 1 })).toBe('2 review copies were made with other colour or burn-in settings than the project has now.');
  });
});
