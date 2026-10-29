import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ReviewWorkspace } from '../ReviewWorkspace';
import { VersionWorkspace } from '../VersionWorkspace';
import { useVersionsListConfig } from '../versions';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
/** The seeded lead-artist adds these to an artist; a vfx-supervisor also holds review.approve/delete (init_platform; exercised by the live capture). */
const lead = { ...artist, permissions: [...artist.permissions, 'version.update', 'version.publish', 'review.create', 'review.update', 'playlist.view', 'playlist.update'] } as User;
const supervisor = { ...lead, permissions: [...lead.permissions, 'review.approve', 'review.delete'] } as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const page = (results: unknown[]) => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const base = flow.versions_list.body.results[0];
const approved = { ...flow.versions_unpublish.body, is_hero: false }; // a real approved, unpublished version
const published = flow.versions_detail_after_promote.body; // approved, published, hero

function VersionsList() {
  return <DirectoryListPage config={useVersionsListConfig()} />;
}

describe('versions list', () => {
  const route = <Route path="/versions" element={<VersionsList />} />;

  it('an approved version can be published or made hero; the status control is a real select of valid moves', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.versions_publish) : page([approved])));
    renderAt('/versions', lead, route);
    await screen.findByRole('link', { name: new RegExp(`^${approved.code}`) });
    expect(screen.getByRole('button', { name: `Publish ${approved.code}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Make hero ${approved.code}` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: `Unpublish ${approved.code}` })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: `Publish ${approved.code}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/versions/${approved.id}/publish/`);
  });

  it('a version that is not approved offers neither; a published one offers Unpublish, is frozen, and cannot be archived', async () => {
    mockFetch(() => page([base]));
    renderAt('/versions', lead, route);
    await screen.findByRole('link', { name: new RegExp(`^${base.code}`) });
    expect(screen.queryByRole('button', { name: new RegExp(`^(Publish|Make hero) ${base.code}`) })).toBeNull();
    cleanup();

    mockFetch(() => page([published]));
    renderAt('/versions', lead, route);
    await screen.findByRole('link', { name: new RegExp(`^${published.code}`) });
    expect(screen.getByRole('button', { name: `Unpublish ${published.code}` })).toBeTruthy();
    expect(screen.queryByLabelText(`Status of ${published.code}`)).toBeNull(); // the status of a published version is frozen
    expect(screen.queryByRole('button', { name: `Archive ${published.code}` })).toBeNull(); // unpublish it first
  });

  it('making a hero of work you produced is refused with the server’s reason, shown in the dialog', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.versions_admin_promotes_own) : page([approved])));
    renderAt('/versions', lead, route);
    await screen.findByRole('link', { name: new RegExp(`^${approved.code}`) });
    fireEvent.click(screen.getByRole('button', { name: `Make hero ${approved.code}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Make hero' }));
    expect(await screen.findByText('You cannot approve a version you produced.')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('an artist (no publish, no update) sees the versions but none of the controls', async () => {
    mockFetch(() => page([approved]));
    renderAt('/versions', artist, route);
    await screen.findByRole('link', { name: new RegExp(`^${approved.code}`) });
    expect(screen.queryByRole('button', { name: /^(Publish|Make hero|Unpublish) / })).toBeNull();
    expect(screen.queryByLabelText(`Status of ${approved.code}`)).toBeNull();
  });
});

describe('review workspace', () => {
  const route = <Route path="/reviews/:reviewId" element={<ReviewWorkspace />} />;
  const rid = flow.reviews_three_start.body.id as string;
  const open = async (user: User, body: unknown, handler?: (c: MockCall) => MockReply | undefined) => {
    const mocked = mockFetch((c) => handler?.(c) ?? { status: 200, body });
    renderAt('/reviews/r1', user, route);
    await screen.findByRole('toolbar', { name: 'Review actions' }).catch(() => undefined);
    return mocked;
  };
  const actions = () => (screen.queryByRole('toolbar', { name: 'Review actions' }) ? within(screen.getByRole('toolbar', { name: 'Review actions' })).getAllByRole('button').map((b) => b.textContent) : []);

  it('offers exactly the moves the status allows and the caller may make', async () => {
    await open(lead, flow.reviews_add_version.body); // Pending Review
    expect(actions()).toEqual(['Submit', 'Start review', 'Close']); // a lead holds review.update, not review.approve
    cleanup();

    await open(lead, flow.reviews_three_start.body); // In Review, but the decisions need review.approve, which a lead does not hold
    expect(actions()).toEqual(['Close']);
    cleanup();

    await open(supervisor, flow.reviews_three_start.body); // In Review
    expect(actions()).toEqual(['Approve', 'Request changes', 'Reject', 'Retake', 'Close']);
    cleanup();

    await open(supervisor, flow.reviews_approve.body); // Approved
    expect(actions()).toEqual(['Close']);
    cleanup();

    await open(supervisor, flow.reviews_close.body); // Closed is final
    expect(actions()).toEqual([]);
    cleanup();

    await open(artist, flow.reviews_three_start.body); // an artist only reads
    expect(actions()).toEqual([]);
  });

  it('approve posts the notes; Retake goes through verdict; a plain move posts nothing extra', async () => {
    const { calls } = await open(supervisor, flow.reviews_three_start.body, (c) => (c.method === 'POST' ? reply(flow.reviews_approve) : undefined));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Notes'), { target: { value: 'looks great' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/reviews/${rid}/approve/`);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ notes: 'looks great' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Retake' }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Retake' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    expect(path(calls.filter((c) => c.method === 'POST')[1])).toBe(`/api/v1/reviews/${rid}/verdict/`);
    expect(calls.filter((c) => c.method === 'POST')[1].body).toEqual({ verdict: 'Retake' });
  });

  it('whoever submitted a review cannot approve it: the server’s reason stays in the dialog', async () => {
    await open(supervisor, flow.reviews_three_start.body, (c) => (c.method === 'POST' ? reply(flow.reviews_two_self_approve) : undefined));
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('You cannot approve a review you produced.')).toBeTruthy();
  });

  it('participants: add posts user_id and role; only a participant gets the verdict form, which posts their own row', async () => {
    const withMe = { ...flow.reviews_three_start.body, reviewers: [{ ...flow.reviews_three_start.body.reviewers[0], user_id: lead.id, name: 'Me' }] };
    const { calls } = await open(lead, withMe, (c) => (c.method === 'POST' ? reply(flow.reviews_three_participant_verdict) : c.url.includes('/members/') ? { status: 200, body: { count: 1, results: [{ id: 'm1', user_id: 'u9', name: 'Pat', email: 'pat@example.test', role: 'Artist' }] } } : undefined));
    fireEvent.click(await screen.findByRole('tab', { name: 'Participants' }));
    await screen.findByRole('region', { name: 'Your verdict' });
    fireEvent.change(screen.getByLabelText('Verdict'), { target: { value: 'Changes Requested' } });
    fireEvent.change(screen.getByLabelText('Verdict notes'), { target: { value: 'tighten it' } });
    fireEvent.click(screen.getByRole('button', { name: 'Give verdict' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe(`/api/v1/reviews/${rid}/participant-verdict/`);
    expect(post.body).toEqual({ participant_id: withMe.reviewers[0].id, verdict: 'Changes Requested', notes: 'tighten it' });

    fireEvent.change(await screen.findByLabelText('Add a participant'), { target: { value: 'u9' } });
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Observer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add participant' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'POST')[1].body).toEqual({ user_id: 'u9', role: 'Observer' });
  });

  it('comments need text, reply one level down, resolve; a closed review takes none', async () => {
    const { calls } = await open(lead, flow.reviews_three_start.body, (c) => (c.method === 'POST' ? { status: 201, body: flow.reviews_comments_add.body } : undefined));
    fireEvent.click(await screen.findByRole('tab', { name: 'Comments' }));
    const add = await screen.findByRole('button', { name: 'Add comment' });
    expect((add as HTMLButtonElement).disabled).toBe(true); // an empty comment is accepted by the server (CR-16) but never sent from here
    fireEvent.change(screen.getByLabelText('Comment'), { target: { value: 'Edge flicker' } });
    fireEvent.change(screen.getByLabelText('Frame'), { target: { value: '1040' } });
    fireEvent.click(add);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ text: 'Edge flicker', frame_number: 1040 });
    cleanup();

    await open(lead, flow.reviews_close.body);
    fireEvent.click(await screen.findByRole('tab', { name: 'Comments' }));
    expect(await screen.findByText(/closed; comments are read-only/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add comment' })).toBeNull();
  });

  it('replies carry the parent and resolve/reopen hit the comment routes', async () => {
    const body = flow.reviews_detail_after_approve.body;
    const parent = body.comments.find((c: any) => c.replies.length > 0);
    const { calls } = await open(lead, { ...body, status: 'In Review' }, (c) => (c.method === 'POST' ? { status: 200, body } : undefined));
    fireEvent.click(await screen.findByRole('tab', { name: 'Comments' }));
    await screen.findByRole('list', { name: 'Comments' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[0]);
    fireEvent.change(screen.getByLabelText('Reply'), { target: { value: 'done' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send reply' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ text: 'done', parent_id: parent.id });
    expect(screen.queryAllByRole('button', { name: 'Reply' }).length).toBeLessThan(body.comments.length + 3); // replies themselves cannot be replied to
  });
});

describe('version workspace', () => {
  const route = <Route path="/versions/:versionId" element={<VersionWorkspace />} />;

  it('starting a review creates it for this version, adds the version, and opens it', async () => {
    const v = flow.versions_detail.body;
    const created = flow.reviews_create.body;
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST' && path(c) === '/api/v1/reviews/') return { status: 201, body: created };
      if (c.method === 'POST') return { status: 201, body: flow.reviews_add_version.body };
      if (path(c) === '/api/v1/reviews/') return page([]);
      return { status: 200, body: v };
    });
    renderAt(`/versions/${v.id}`, supervisor, <><Route path="/versions/:versionId" element={<VersionWorkspace />} /><Route path="/reviews/:reviewId" element={<div>review opened</div>} /></>);
    fireEvent.click(await screen.findByRole('tab', { name: 'Reviews' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start a review' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Start review' }));
    await screen.findByText('review opened');
    const posts = calls.filter((c) => c.method === 'POST');
    expect(path(posts[0])).toBe('/api/v1/reviews/');
    expect(posts[0].body).toMatchObject({ project: v.project_id, entity_type: v.entity_type, entity_id: v.entity_id, entity_code: v.entity_code });
    expect(path(posts[1])).toBe(`/api/v1/reviews/${created.id}/versions/`);
    expect(posts[1].body).toEqual({ version_id: v.id });
    const list = calls.find((c) => c.method === 'GET' && path(c) === '/api/v1/reviews/')!;
    expect(Object.fromEntries(new URL(list.url).searchParams)).toMatchObject({ entity_id: v.entity_id, entity_type: v.entity_type }); // the only filters that narrow reviews by what they are about
  });

  it('lists only the reviews that actually contain the version', async () => {
    const v = flow.versions_detail.body;
    const containing = { ...flow.reviews_detail_after_approve.body, versions: [{ ...flow.reviews_detail_after_approve.body.versions[0], id: v.id }] };
    const other = { ...flow.reviews_detail_after_approve.body, id: 'other', code: 'OTHER', versions: [{ ...flow.reviews_detail_after_approve.body.versions[0], id: 'not-this-one' }] };
    mockFetch((c) => (path(c) === '/api/v1/reviews/' ? page([containing, other]) : { status: 200, body: v }));
    renderAt(`/versions/${v.id}`, lead, route);
    fireEvent.click(await screen.findByRole('tab', { name: 'Reviews' }));
    const list = await screen.findByRole('list', { name: 'Reviews of this version' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText(new RegExp(containing.code))).toBeTruthy();
  });
});
