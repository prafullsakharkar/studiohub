import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectNote } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { NoteBoard } from '../NoteBoard';

/**
 * The notes board (review pipeline RP-2), served from docs/sync/samples/production/_notes_flow.json. What it offers
 * follows the server's rules (Q-RP-11, Q-RP-12): the author, the task's assignee and the holders of note.update and
 * note.delete see different actions.
 */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_notes_flow.json');
const auth = loadSample<Record<string, Captured>>('identity/_auth_flow.json');
const ids = flow.ids as unknown as Record<string, string>;
const PID = ids.project;
const thread = flow.create_thread.body as ProjectNote; // by the supervisor; the artist is its task's assignee
const base = `/api/organizations/projects/${PID}/notes/`;
const path = (c: MockCall) => new URL(c.url).pathname;
const empty = { count: 0, next: null, previous: null, results: [] };

/** A signed-in member of the project with the given codes (the artist sample, renamed). */
const member = (id: string, ...codes: string[]) =>
  ({ ...auth.me_artist.body, id, is_superuser: false, permissions: ['project.view', 'task.view', ...codes], project_memberships: [{ project_id: PID, status: 'active', role: 'Artist' }] }) as unknown as User;
const artist = member(ids.artist, 'note.create');
const lead = member(ids.lead, 'note.create');
const supervisor = member(ids.supervisor, 'note.create', 'note.update', 'note.delete');

function server(c: MockCall): MockReply {
  const p = path(c);
  if (p === base) return c.method === 'POST' ? { status: 201, body: flow.create_on_project.body } : { body: flow.list.body };
  if (p === `${base}${thread.id}/`) return c.method === 'PATCH' ? { body: flow.patch_by_author.body } : c.method === 'DELETE' ? { status: 204, body: null } : { body: flow.detail.body };
  if (p === `${base}${thread.id}/replies/`) return { status: 201, body: flow.reply_by_artist.body };
  if (p === `${base}${thread.id}/status/`) return { body: flow.status_by_assignee.body };
  if (p === `/api/v1/tasks/${ids.task}/`) return { body: flow.task_detail.body };
  return { body: empty };
}

function mount(user: User, node: React.ReactNode = <NoteBoard projectId={PID} emptyDescription="none" />) {
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
  fireEvent.click(within(card).getByRole('button', { name: /replies|Open thread/ }));
  await within(card).findByRole('list', { name: 'Replies' });
  return card;
}

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('the notes board', () => {
  it('shows each thread with the records it is about, its task and its reply count', async () => {
    mockFetch(server);
    mount(artist);
    const card = (await screen.findByText(thread.subject)).closest('li') as HTMLElement;
    const about = within(card).getByLabelText('About');
    for (const link of thread.links) expect(within(about).getByText(link.code)).toBeTruthy();
    expect(within(about).getByText(`Task ${thread.task_code}`)).toBeTruthy();
    const listed = (flow.list.body.results as ProjectNote[]).find((n) => n.id === thread.id) as ProjectNote;
    expect(within(card).getByRole('button', { name: `${listed.reply_count} replies` })).toBeTruthy();
  });

  it('on a record’s tab, asks for that record and leaves its own chip out', async () => {
    const shot = thread.links[0];
    const { calls } = mockFetch((c) => (path(c) === base ? { body: flow.list_by_shot.body } : server(c)));
    mount(artist, <NoteBoard projectId={PID} target={{ type: 'Shot', id: shot.entity_id, code: shot.code, name: shot.name, projectId: PID }} emptyDescription="none" />);
    const card = (await screen.findByText(thread.subject)).closest('li') as HTMLElement;
    const about = within(card).getByLabelText('About');
    expect(within(about).queryByText(shot.code)).toBeNull();
    expect(within(about).getByText(thread.links[1].code)).toBeTruthy();
    const asked = new URL((calls.find((c) => path(c) === base) as MockCall).url).searchParams;
    expect([asked.get('entity_type'), asked.get('entity_id')]).toEqual(['Shot', shot.entity_id]);
  });

  it('opening a thread shows its replies and sends a reply', async () => {
    const { calls } = mockFetch(server);
    mount(artist);
    const card = await openThread();
    const replies = within(card).getByRole('list', { name: 'Replies' });
    for (const r of flow.detail.body.replies as ProjectNote[]) expect(within(replies).getByText(r.body)).toBeTruthy();
    fireEvent.change(within(card).getByLabelText(`Reply to ${thread.subject}`), { target: { value: 'On it.' } });
    fireEvent.click(within(card).getByRole('button', { name: 'Reply' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c).endsWith('/replies/'))).toBe(true));
    expect(calls.find((c) => path(c).endsWith('/replies/'))?.body).toEqual({ body: 'On it.' });
  });

  it('the task’s assignee may set the status, and nothing else of someone else’s note', async () => {
    const { calls } = mockFetch(server);
    mount(artist);
    const card = await openThread();
    fireEvent.click(await within(card).findByRole('button', { name: 'Mark addressed' }));
    await waitFor(() => expect(calls.some((c) => path(c).endsWith('/status/'))).toBe(true));
    expect(calls.find((c) => path(c).endsWith('/status/'))?.body).toEqual({ status: 'Addressed' });
    expect(within(card).queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('someone with neither right sees no status, edit or delete, but may delete their own reply', async () => {
    mockFetch(server);
    mount(lead);
    const card = await openThread();
    await waitFor(() => expect(within(card).getAllByRole('button', { name: 'Delete reply' })).toHaveLength(1));
    for (const name of ['Mark addressed', 'Close', 'Edit', 'Delete']) expect(within(card).queryByRole('button', { name })).toBeNull();
  });

  it('someone who may edit and delete notes sees every action', async () => {
    mockFetch(server);
    mount(supervisor);
    const card = await openThread();
    for (const name of ['Mark addressed', 'Close', 'Edit', 'Delete']) expect(within(card).getByRole('button', { name })).toBeTruthy();
    expect(within(card).getAllByRole('button', { name: 'Delete reply' })).toHaveLength((flow.detail.body.replies as unknown[]).length);
  });

  it('the author edits their own thread, but may not delete it once someone else replied', async () => {
    mockFetch(server);
    mount(member(ids.supervisor, 'note.create'));
    const card = await openThread();
    expect(within(card).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Delete' })).toBeNull();
  });

  it('the author may delete their own thread while no one else has replied', async () => {
    const own = flow.detail_on_project.body as ProjectNote;
    mockFetch((c) => (path(c) === `${base}${own.id}/` ? { body: own } : server(c)));
    mount(artist);
    const card = (await screen.findByText(own.subject)).closest('li') as HTMLElement;
    fireEvent.click(within(card).getByRole('button', { name: /replies|Open thread/ }));
    expect(await within(card).findByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('an edit sends only the text when the records and the task were left alone', async () => {
    const { calls } = mockFetch(server);
    mount(supervisor);
    const card = await openThread();
    fireEvent.click(within(card).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Subject/), { target: { value: 'Edge is soft (left)' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ subject: 'Edge is soft (left)', body: thread.body, category: thread.category });
  });

  it('deleting a thread asks first, then sends DELETE', async () => {
    const { calls } = mockFetch(server);
    mount(supervisor);
    const card = await openThread();
    fireEvent.click(within(card).getByRole('button', { name: 'Delete' }));
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText('The note and every reply on it are removed.')).toBeTruthy();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && path(c) === `${base}${thread.id}/`)).toBe(true));
  });

  it('without note.create there is no Add note and no reply box', async () => {
    mockFetch(server);
    mount(member(ids.artist));
    const card = await openThread();
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    expect(within(card).queryByLabelText(`Reply to ${thread.subject}`)).toBeNull();
  });
});
