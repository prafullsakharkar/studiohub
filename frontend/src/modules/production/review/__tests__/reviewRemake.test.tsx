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
import { outOfDateText, remadeText, ReviewCopiesNotice } from '../ReviewCopiesNotice';
import { ReviewMoviePanel } from '../ReviewMoviePanel';

/** RP-14 (C-RP-37, C-RP-38): remaking review copies, against _review_remake_flow.json (captured with a real ffmpeg). */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_remake_flow.json');
const sequenceFlow = loadSample<Record<string, Captured>>('production/_review_sequence_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User; // project.view without project.update

const ready = (loadSample<Record<string, Captured>>('production/_review_media_flow.json').version_ready.body as Version);
const remaking = flow.version_remaking.body as Version;
const sequence = sequenceFlow.version_ready.body as Version;
const project = { id: (flow.ids as unknown as Record<string, string>).project } as Project;

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

describe('remaking one copy (C-RP-37)', () => {
  it('a ready movie offers Remake, which posts to the copy and refetches the version', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? captured('remake_202') : { status: 200, body: remaking }));
    mount(<ReviewMoviePanel version={ready} />);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Remake' }));
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/review-media/${ready.review_media?.id}/remake/`));
  });

  it('a sequence whose frames are kept offers Remake (RP-16; one whose frames are gone: reviewSequenceCopies.test)', () => {
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={sequence} />);
    expect(within(panel()).getByRole('button', { name: 'Remake' })).toBeTruthy();
    expect(within(panel()).getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('without the right to manage the copy there is no Remake', () => {
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={ready} />, artist);
    expect(within(panel()).queryByRole('button', { name: 'Remake' })).toBeNull();
  });

  it('while remaking, the current copy stays and the job says so; another remake waits', () => {
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={remaking} />);
    expect(within(panel()).getByRole('status').textContent).toBe(
      'rpr_comp_v001.mp4: Waiting for the media worker to remake the copy. The current copy stays until then.',
    );
    expect(within(panel()).getByLabelText('Review copy')).toBeTruthy();
    expect((within(panel()).getByRole('button', { name: 'Remake' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a remake that failed says the current copy stays', () => {
    mockFetch(() => ({ status: 500 }));
    const job = remaking.review_media_job as NonNullable<Version['review_media_job']>;
    const failed = { ...remaking, review_media_job: { ...job, status: 'failed' as const, error_message: 'The review copy could not be made.', attempts: 1 } };
    mount(<ReviewMoviePanel version={failed} />);
    expect(within(panel()).getByRole('alert').textContent).toContain('The review copy could not be made. The remake failed; the current copy stays.');
  });

  it('a refusal (the captured 400 for a sequence) is shown', async () => {
    mockFetch((c) => (c.method === 'POST' ? captured('remake_sequence_400') : { status: 200, body: ready }));
    mount(<ReviewMoviePanel version={ready} />);
    fireEvent.click(within(panel()).getByRole('button', { name: 'Remake' }));
    expect((await within(panel()).findByRole('alert')).textContent).toContain('Upload the frames again.');
  });
});

describe("a project's copies (C-RP-38)", () => {
  const notice = () => screen.findByRole('region', { name: 'Review copies' });

  it('the sentences', () => {
    expect(outOfDateText(flow.copies_switch_on.body as ReviewCopies)).toBe('2 review copies were made without burn-ins; the project now adds them.');
    expect(outOfDateText({ review_burn_ins: false, out_of_date: 1, sequences_out_of_date: 0, colour_out_of_date: 0, differing: [], differing_more: 0 })).toBe(
      '1 review copy was made with burn-ins; the project now leaves them off.',
    );
    expect(remadeText(flow.remake_all_200.body)).toBe('Remaking 1 review copy. 1 left: the frames of those sequences are no longer kept.');
    expect(remadeText({ queued: 3, skipped_busy: 1, skipped_sequence: 0, skipped_missing: 2 })).toBe(
      'Remaking 3 review copies. 1 left: their version already has a copy being made. 2 left: the uploaded file is gone; upload it again.',
    );
  });

  it('says how many differ, and Remake them posts to the project and then says what is being remade', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? captured('remake_all_200') : captured('copies_switch_on')));
    mount(<ReviewCopiesNotice project={project} />);
    const region = await notice();
    expect(region.textContent).toContain('2 review copies were made without burn-ins; the project now adds them.');
    expect(region.textContent).toContain('1 image sequence was made with other settings.');
    expect(calls[0].url).toContain(`/api/v1/projects/${project.id}/review-copies/`);
    fireEvent.click(within(region).getByRole('button', { name: 'Remake them' }));
    await waitFor(() => expect(calls.map((c) => `${c.method} ${path(c)}`)).toContain(`POST /api/v1/projects/${project.id}/review-copies/remake/`));
    expect(await within(region).findByText('Remaking 1 review copy. Each one replaces its old copy when it is ready.')).toBeTruthy();
    expect(within(region).queryByRole('button', { name: 'Remake them' })).toBeNull();
  });

  it('without project.update the counts show and the button does not', async () => {
    mockFetch(() => captured('copies_by_artist'));
    mount(<ReviewCopiesNotice project={project} />, artist);
    const region = await notice();
    expect(region.textContent).toContain('2 review copies were made without burn-ins');
    expect(within(region).queryByRole('button', { name: 'Remake them' })).toBeNull();
  });

  it('nothing shows when every copy matches; only the sequence sentence when only sequences differ', async () => {
    const { calls } = mockFetch(() => captured('copies_switch_off'));
    mount(<ReviewCopiesNotice project={project} />);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(screen.queryByRole('region', { name: 'Review copies' })).toBeNull();
    cleanup();
    mockFetch(() => captured('copies_after_all'));
    mount(<ReviewCopiesNotice project={project} />);
    const region = await notice();
    expect(region.textContent).not.toContain('review copies were made');
    expect(within(region).queryByRole('button', { name: 'Remake them' })).toBeNull();
    expect(region.textContent).toContain('1 no longer has its frames: upload them again, or keep the copies as they are.');
  });
});
