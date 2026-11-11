import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { fakeClock } from '@/test/mediaElement';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ReviewViewer } from '../ReviewViewer';
import { VersionMediaTab } from '../VersionMedia';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const review = flow.reviews_start_review.body; // In Review, one version, a comment and an annotation on frame 1040
const twoVersions = flow.reviews_add_version_second.body;
const closed = flow.reviews_close.body;
const sample = flow.versions_detail.body; // a Shot version, 24 fps, first frame 1001
const withVideo = { ...sample, video_url: 'https://cdn.example.com/p/sh0010.mp4', thumbnail_url: 'https://cdn.example.com/p/sh0010.jpg' };

const path = (c: MockCall) => new URL(c.url).pathname;
const reply = (body: unknown): MockReply => ({ status: 200, body });

function mount(ui: React.ReactElement, user: User = admin) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
}
/** Gives the player's video a 3-second clock once it is on screen, then lets it report its length. */
async function startVideo(name: RegExp | string) {
  const video = (await screen.findByLabelText(name)) as HTMLVideoElement;
  fakeClock(video, 3);
  act(() => {
    fireEvent.loadedMetadata(video);
  });
  return video;
}
const frame = () => screen.getByLabelText('Current frame').textContent;

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('review viewer', () => {
  it('shows the first version in the player, on its own first frame and frame rate', async () => {
    const { calls } = mockFetch(() => reply(withVideo));
    mount(<ReviewViewer review={review} />);
    const video = await startVideo(/in review video$/);
    expect(video.getAttribute('src')).toBe(withVideo.video_url);
    expect(path(calls[0])).toBe(`/api/v1/versions/${review.versions[0].id}/`);
    expect(frame()).toBe('1001');
    expect(screen.getByRole('group', { name: `${review.versions[0].code} in review` })).toBeTruthy();
  });

  it('marks the frames that have feedback on the timeline, lists them, and goes to a frame when asked', async () => {
    mockFetch(() => reply(withVideo));
    mount(<ReviewViewer review={review} />);
    await startVideo(/in review video$/);
    const comment = review.comments[0];
    const note = review.annotations[0];
    expect(screen.getAllByRole('button', { name: new RegExp(`^Go to frame ${comment.frame_number}: `) }).length).toBeGreaterThanOrEqual(2); // the marker and the list entry
    const feedback = within(screen.getByRole('complementary', { name: 'Feedback on frames' }));
    expect(feedback.getByText(comment.text)).toBeTruthy();
    expect(feedback.getByText(note.comment)).toBeTruthy();
    fireEvent.click(feedback.getByRole('button', { name: `Go to frame ${comment.frame_number}: ${comment.text}` }));
    expect(frame()).toBe(String(comment.frame_number));
  });

  it('says so when nothing names a frame, and when the review has no version', async () => {
    mockFetch(() => reply(withVideo));
    mount(<ReviewViewer review={{ ...review, comments: [], annotations: [] }} />);
    expect(await screen.findByText('No comment or annotation names a frame yet.')).toBeTruthy();
    cleanup();
    mount(<ReviewViewer review={{ ...review, versions: [] }} />);
    expect(screen.getByText(/This review has no versions yet/)).toBeTruthy();
  });

  it('a comment on the frame being shown is sent with its frame number and timecode', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: {} } : reply(withVideo)));
    mount(<ReviewViewer review={review} />);
    await startVideo(/in review video$/);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Feedback on frames' })).getAllByRole('button')[0]); // go to the first piece of feedback: frame 1040
    expect(frame()).toBe('1040');
    expect(screen.getByText('Comment on frame 1040')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Add comment' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Comment on this frame'), { target: { value: 'Grain is too heavy here' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add comment' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST') as MockCall;
    expect(path(post)).toBe(`/api/v1/reviews/${review.id}/comments/`);
    expect(post.body).toEqual({ text: 'Grain is too heavy here', frame_number: 1040, timecode: '00:00:01:15' }); // 39 frames in at 24 fps
  });

  it('offers no comment box to someone who cannot update reviews, or on a closed review', async () => {
    mockFetch(() => reply(withVideo));
    const readOnly = { ...artist, permissions: artist.permissions.filter((p) => p !== 'review.update') } as User;
    mount(<ReviewViewer review={review} />, readOnly);
    await screen.findByLabelText('Scrub');
    expect(screen.queryByLabelText('Comment on this frame')).toBeNull();
    cleanup();
    mockFetch(() => reply(withVideo));
    mount(<ReviewViewer review={closed} />);
    await screen.findByLabelText('Scrub');
    expect(screen.queryByLabelText('Comment on this frame')).toBeNull();
    expect(screen.getByText(/This review is closed/)).toBeTruthy();
  });

  it('switches between the versions of the review, loading the one chosen', async () => {
    const { calls } = mockFetch(() => reply(withVideo));
    mount(<ReviewViewer review={twoVersions} />);
    await screen.findByLabelText('Scrub');
    const group = screen.getByRole('group', { name: 'Version on show' });
    const [first, second] = twoVersions.versions;
    expect(within(group).getByRole('button', { name: first.code }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: second.code }));
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/versions/${second.id}/`)).toBe(true));
    expect(within(group).getByRole('button', { name: second.code }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: `${second.code} in review` })).toBeTruthy();
  });

  it('a version with no preview linked shows its picture and says nothing can be played', async () => {
    mockFetch(() => reply({ ...sample, video_url: '', thumbnail_url: 'https://cdn.example.com/p/sh0010.jpg' }));
    mount(<ReviewViewer review={review} />);
    expect(await screen.findByText(/Link a preview to the version or media item/)).toBeTruthy();
    expect(screen.getByRole('img', { name: `${review.versions[0].code} in review` })).toBeTruthy(); // its picture stands in
    expect(screen.queryByLabelText('Scrub')).toBeNull();
  });
});

describe('version media tab', () => {
  const sameShot = { ...flow.media_list.body.items[0] };
  const otherShot = { ...flow.media_list.body.items[0], id: 'other-media', entity_id: 'a-different-shot', title: 'Not for this version' };
  const open = (media: unknown[], version = withVideo) => {
    const mock = mockFetch((c) => (path(c).includes('/media/') ? reply(media) : reply(version)));
    mount(<VersionMediaTab version={version as any} />);
    return mock;
  };

  it('plays the version’s own preview from its first frame, with its facts beside it', async () => {
    open([]);
    const video = await startVideo(`${withVideo.code} preview video`);
    expect(video.getAttribute('src')).toBe(withVideo.video_url);
    expect(frame()).toBe(String(withVideo.start_frame));
    const facts = within(screen.getByLabelText('Preview details'));
    expect(facts.getByText(withVideo.resolution)).toBeTruthy();
    expect(facts.getByText(withVideo.color_space)).toBeTruthy();
    expect(await screen.findByText(/No other media is linked/)).toBeTruthy();
  });

  it('lists the media of the same shot only, and puts the one chosen in the same player', async () => {
    open([sameShot, otherShot]);
    await startVideo(`${withVideo.code} preview video`);
    const section = within(await screen.findByRole('region', { name: `Media on ${withVideo.entity_code || 'this record'}` }));
    expect(section.getAllByRole('button')).toHaveLength(2); // "This version" and the one media item
    expect(screen.queryByText('Not for this version')).toBeNull();
    const chosen = section.getAllByRole('button')[1];
    fireEvent.click(chosen);
    const video = await startVideo(/video$/);
    expect(video.getAttribute('src')).toBe(sameShot.preview_url);
    expect(frame()).toBe('1'); // a media item has no first frame of its own
    expect(chosen.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(section.getByRole('button', { name: /This version/ }));
    expect((await startVideo(`${withVideo.code} preview video`)).getAttribute('src')).toBe(withVideo.video_url);
  });

  it('shows the picture and says so when the version has no video', async () => {
    open([], { ...withVideo, video_url: '' });
    expect(await screen.findByText(/Link a preview to the version or media item/)).toBeTruthy();
    expect(screen.getByRole('img', { name: `${withVideo.code} preview` })).toBeTruthy();
    cleanup();
    open([], { ...withVideo, video_url: '', thumbnail_url: '' });
    expect(await screen.findByText('No preview is linked yet.')).toBeTruthy();
  });
});
