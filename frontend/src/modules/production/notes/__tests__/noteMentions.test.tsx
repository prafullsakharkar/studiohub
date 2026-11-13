import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectMember, ProjectNote, ProjectNoteThread } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { MENTION_CAP, MentionPicker, mentionable } from '../MentionPicker';
import { NoteBoard } from '../NoteBoard';

/**
 * Mentions on notes (review pipeline RP-6, C-RP-25), served from docs/sync/samples/notifications/_notifications_flow.json:
 * the lead's thread mentions the supervisor and, after an edit, the artist; the supervisor's reply mentions the artist.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('notifications/_notifications_flow.json');
const auth = loadSample<Record<string, Captured>>('identity/_auth_flow.json');
const thread = flow.note_detail.body as ProjectNoteThread;
const PID = thread.project_id;
const base = `/api/organizations/projects/${PID}/notes/`;
const members = flow.members_list.body.results as ProjectMember[];
const byRole = (role: string) => members.find((m) => m.role === role && m.status === 'active' && !m.department) as ProjectMember;
const artistId = byRole('Artist').user_id;
const leadId = byRole('Lead').user_id;
const supervisorId = byRole('VFX Supervisor').user_id;
const narrowed = members.find((m) => m.department) as ProjectMember;
const former = members.find((m) => m.status === 'inactive') as ProjectMember;
const path = (c: MockCall) => new URL(c.url).pathname;

const member = (id: string, ...codes: string[]) =>
  ({ ...auth.me_artist.body, id, is_superuser: false, permissions: ['project.view', 'task.view', ...codes], project_memberships: [{ project_id: PID, status: 'active', role: 'Artist' }] }) as unknown as User;

function server(c: MockCall): MockReply {
  const p = path(c);
  if (p === `/api/organizations/projects/${PID}/members/`) return { body: flow.members_list.body };
  if (p === base) return c.method === 'POST' ? { status: 201, body: flow.note_create_with_mention.body } : { body: flow.note_list.body };
  if (p === `${base}${thread.id}/`) return c.method === 'PATCH' ? { body: flow.note_patch_adds_mention.body } : { body: flow.note_detail.body };
  if (p === `${base}${thread.id}/replies/`) return { status: 201, body: flow.reply_with_mention.body };
  return { body: { count: 0, next: null, previous: null, results: [] } };
}

function wrap(node: React.ReactNode, user: User = member(leadId, 'note.create')) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user, isAuthenticated: true, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

async function openThread() {
  const card = (await screen.findByText(thread.subject)).closest('li') as HTMLElement;
  fireEvent.click(within(card).getByRole('button', { name: /^\d+ repl(y|ies)$|Open thread/ }));
  await within(card).findByRole('list', { name: 'Replies' });
  return card;
}

const offered = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((o) => (o as HTMLOptionElement).value)
    .filter(Boolean);

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('the mention picker', () => {
  it('offers the active members of the whole project only, and leaves out who is picked', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    wrap(<MentionPicker projectId={PID} value={[supervisorId]} onChange={onChange} />);
    const select = screen.getByLabelText('Mention');
    await waitFor(() => expect(offered(select)).toEqual([artistId, leadId]));
    expect([mentionable(narrowed), mentionable(former)]).toEqual([false, false]);
    fireEvent.change(select, { target: { value: artistId } });
    expect(onChange).toHaveBeenCalledWith([supervisorId, artistId]);
  });

  it('a chip removes its person; a person the list no longer offers keeps the name the note gave', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    wrap(<MentionPicker projectId={PID} value={[narrowed.user_id]} known={[{ id: narrowed.user_id, name: 'Comp artist' }]} onChange={onChange} />);
    const chips = screen.getByRole('list', { name: 'Mentioned' });
    expect(within(chips).getByText('@Comp artist')).toBeTruthy();
    fireEvent.click(within(chips).getByRole('button', { name: 'Remove Comp artist' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it(`stops at ${MENTION_CAP} people`, async () => {
    mockFetch(server);
    wrap(<MentionPicker projectId={PID} value={Array.from({ length: MENTION_CAP }, (_, i) => `picked-${i}`)} onChange={vi.fn()} />);
    const select = screen.getByLabelText('Mention') as HTMLSelectElement;
    await waitFor(() => expect(within(select).getByRole('option', { name: `At most ${MENTION_CAP} people` })).toBeTruthy());
    expect(select.disabled).toBe(true);
  });
});

describe('mentions on the notes board', () => {
  it('a thread and its replies show who they mention', async () => {
    mockFetch(server);
    wrap(<NoteBoard projectId={PID} emptyDescription="none" />);
    const card = await openThread();
    const [onThread] = within(card).getAllByLabelText('Mentions');
    expect(within(onThread).getAllByText(/^@/)).toHaveLength(thread.mentions.length);
    const replies = within(card).getByRole('list', { name: 'Replies' });
    expect(within(within(replies).getByLabelText('Mentions')).getAllByText(/^@/)).toHaveLength(thread.replies[0].mentions.length);
  });

  it('a reply sends the people picked, then clears them', async () => {
    const { calls } = mockFetch(server);
    wrap(<NoteBoard projectId={PID} emptyDescription="none" />, member(supervisorId, 'note.create'));
    const card = await openThread();
    const select = within(card).getByLabelText('Mention');
    await waitFor(() => expect(offered(select)).toContain(artistId));
    fireEvent.change(select, { target: { value: artistId } });
    fireEvent.change(within(card).getByLabelText(`Reply to ${thread.subject}`), { target: { value: 'Agreed, please fix.' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Reply' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c).endsWith('/replies/'))).toBe(true));
    expect(calls.find((c) => path(c).endsWith('/replies/'))?.body).toEqual({ body: 'Agreed, please fix.', mention_ids: [artistId] });
    await waitFor(() => expect(within(card).queryByRole('list', { name: 'Mentioned' })).toBeNull());
  });

  it('a new note sends the people picked', async () => {
    const { calls } = mockFetch(server);
    wrap(<NoteBoard projectId={PID} emptyDescription="none" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Subject/), { target: { value: 'Edge is soft' } });
    const select = within(dialog).getByLabelText('Mention');
    await waitFor(() => expect(offered(select)).toContain(supervisorId));
    fireEvent.change(select, { target: { value: supervisorId } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c) === base)).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && path(c) === base)?.body).toMatchObject({ subject: 'Edge is soft', mention_ids: [supervisorId] });
  });

  it('a new note with no one picked sends no mention_ids', async () => {
    const { calls } = mockFetch(server);
    wrap(<NoteBoard projectId={PID} emptyDescription="none" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Subject/), { target: { value: 'Edge is soft' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c) === base)).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && path(c) === base)?.body).not.toHaveProperty('mention_ids');
  });

  it('an edit leaves the mentions out unless they changed, then sends the whole list', async () => {
    const { calls } = mockFetch(server);
    wrap(<NoteBoard projectId={PID} emptyDescription="none" />);
    const card = await openThread();
    const patches = () => calls.filter((c) => c.method === 'PATCH').map((c) => c.body as Partial<ProjectNote> & { mention_ids?: string[] });

    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Subject/), { target: { value: 'Edge is soft (left)' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patches()).toHaveLength(1));
    expect(patches()[0]).not.toHaveProperty('mention_ids');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    dialog = await screen.findByRole('dialog');
    const chips = within(dialog).getByRole('list', { name: 'Mentioned' });
    expect(within(chips).getAllByRole('listitem')).toHaveLength(thread.mentions.length);
    fireEvent.click(within(chips).getAllByRole('button', { name: /^Remove / })[1]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(patches()).toHaveLength(2));
    expect(patches()[1].mention_ids).toEqual([thread.mentions[0].id]);
  });
});
