import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewCopies, Version } from '@/api/production/review';
import type { Project } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { differingText, remadeText, ReviewCopiesNotice, sequencesText } from '../ReviewCopiesNotice';
import { canRemake, framesText, ReviewMoviePanel } from '../ReviewMoviePanel';

/**
 * RP-16 (C-RP-41 to C-RP-43): sequence copies after a settings change, against _review_sequence_copies_flow.json
 * (captured with a real ffmpeg).
 */
type Captured = { status: number; body: unknown };
const flow = loadSample<Record<string, Captured>>('production/_review_sequence_copies_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User; // project.view without project.update
const ids = flow.ids as unknown as Record<string, string>;
const project = { id: ids.project } as Project;
const kept = flow.version_frames_kept.body as Version;
const gone = flow.version_frames_gone.body as Version;
const switchedOn = flow.copies_switch_on.body as ReviewCopies;

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
const notice = () => screen.findByRole('region', { name: 'Review copies' });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('a sequence on its version (C-RP-41)', () => {
  it('while its frames are kept it offers Remake, says until when, and posts to the copy', async () => {
    const media = kept.review_media as NonNullable<Version['review_media']>;
    expect(canRemake(media)).toBe(true);
    expect(framesText(media)).toMatch(/^Frames kept until /);
    const { calls } = mockFetch((c) => (c.method === 'POST' ? captured('remake_kept_202') : { status: 200, body: kept }));
    mount(<ReviewMoviePanel version={kept} />);
    expect(within(panel()).getByLabelText('Review copy').textContent).toContain('Frames kept until');
    const remake = within(panel()).getByRole('button', { name: 'Remake' });
    expect(remake.getAttribute('title')).toContain('kept frames');
    fireEvent.click(remake);
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/review-media/${media.id}/remake/`));
  });

  it('once its frames are gone there is no Remake, and the panel says so', () => {
    const media = gone.review_media as NonNullable<Version['review_media']>;
    expect(media.frames_until).toBeNull();
    expect(canRemake(media)).toBe(false);
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={gone} />);
    expect(within(panel()).queryByRole('button', { name: 'Remake' })).toBeNull();
    expect(within(panel()).getByLabelText('Review copy').textContent).toContain('Frames no longer kept');
  });

  it('a movie says nothing about frames', () => {
    const remade = flow.version_sequence_remade.body as Version;
    expect(framesText({ ...(remade.review_media as NonNullable<Version['review_media']>), kind: 'movie', frames_until: null })).toBeNull();
  });
});

describe("the project's list (C-RP-42)", () => {
  it('the sentences', () => {
    expect(sequencesText(switchedOn)).toBe(
      '2 image sequences were made with other settings. 1 can be remade while its frames are kept. 1 no longer has its frames: upload them again, or keep the copies as they are.',
    );
    const [first, second, third] = switchedOn.differing;
    expect(differingText(first)).toBe('burn-ins differ · frames no longer kept');
    expect(differingText(second)).toMatch(/^burn-ins differ · frames kept until /);
    expect(differingText(third)).toBe('burn-ins differ · can be remade');
    expect(remadeText({ queued: 1, skipped_busy: 0, skipped_sequence: 1, skipped_missing: 0 })).toBe(
      'Remaking 1 review copy. 1 left: the frames of those sequences are no longer kept.',
    );
  });

  it('Show which lists each copy, linking to its version, and how many more', async () => {
    mockFetch(() => ({ status: 200, body: { ...switchedOn, differing_more: 4 } }));
    mount(<ReviewCopiesNotice project={project} />);
    const region = await notice();
    expect(within(region).queryByRole('list')).toBeNull();
    fireEvent.click(within(region).getByRole('button', { name: 'Show which' }));
    const list = within(region).getByRole('list', { name: 'Copies made with other settings' });
    const links = within(list).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(switchedOn.differing.map((row) => `/versions/${row.version.id}`));
    expect(links[0].textContent).toBe(switchedOn.differing[0].version.code);
    expect(list.textContent).toContain(switchedOn.differing[0].record_code);
    expect(list.textContent).toContain('and 4 more');
  });

  it('Remake them shows when only kept sequences can be remade', async () => {
    const onlySequence = {
      ...switchedOn,
      out_of_date: 0,
      sequences_out_of_date: 1,
      differing: switchedOn.differing.filter((row) => row.kind === 'sequence' && row.remakable),
    };
    mockFetch(() => ({ status: 200, body: onlySequence }));
    mount(<ReviewCopiesNotice project={project} />);
    const region = await notice();
    expect(within(region).getByRole('button', { name: 'Remake them' })).toBeTruthy();
    expect(within(region).queryByRole('button', { name: 'Keep as they are' })).toBeNull();
  });
});

describe('keeping copies as they are (C-RP-43)', () => {
  it('asks first, then posts the copies that cannot be remade and reads the counts again', async () => {
    let keptYet = false;
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') {
        keptYet = true;
        return captured('keep_200');
      }
      return keptYet ? captured('copies_after_keep') : captured('copies_switch_on');
    });
    mount(<ReviewCopiesNotice project={project} />);
    const region = await notice();
    fireEvent.click(within(region).getByRole('button', { name: 'Keep as they are' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain("1 review copy cannot be remade. Keep it as it is? It will count again if the project's burn-ins, colour space, view or look change.");
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep as they are' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST') as MockCall;
    expect(path(post)).toBe(`/api/v1/projects/${project.id}/review-copies/keep/`);
    expect(post.body).toEqual({ review_media_ids: [ids.gone] });
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET').length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Review copies' }).textContent).not.toContain('no longer has its frames'));
  });

  it('without project.update there is no Keep and no Remake; the list still shows', async () => {
    mockFetch(() => captured('copies_by_artist'));
    mount(<ReviewCopiesNotice project={project} />, artist);
    const region = await notice();
    expect(within(region).queryByRole('button', { name: 'Keep as they are' })).toBeNull();
    expect(within(region).queryByRole('button', { name: 'Remake them' })).toBeNull();
    expect(within(region).getByRole('button', { name: 'Show which' })).toBeTruthy();
  });
});
