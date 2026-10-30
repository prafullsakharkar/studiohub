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
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import type { User } from '@/types/identity';
import { PlaylistWorkspace } from '../PlaylistWorkspace';
import { usePlaylistsListConfig } from '../playlists';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_review_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
/** The seeded lead-artist: playlist.create and playlist.update on top of an artist's reads. */
const lead = { ...artist, permissions: [...artist.permissions, 'playlist.create', 'playlist.update'] } as User;

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
  useNotificationStore.setState({ notifications: [] } as never);
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const detail = flow.playlists_detail.body; // placeholder, v001, v002 (in that order)
const route = <Route path="/playlists/:playlistId" element={<PlaylistWorkspace />} />;
const posts = (calls: MockCall[]) => calls.filter((c) => c.method === 'POST');

function open(user: User, handler?: (c: MockCall) => MockReply | undefined) {
  const mocked = mockFetch((c) => handler?.(c) ?? (c.url.includes('/versions/') ? page([flow.versions_list.body.results[0]]) : { status: 200, body: detail }));
  renderAt(`/playlists/${detail.id}`, user, route);
  return mocked;
}

describe('playlist workspace', () => {
  it('lists the entries in order: a version links to itself, a placeholder says so', async () => {
    open(lead);
    const list = await screen.findByRole('list', { name: 'Playlist entries' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Placeholder');
    expect(within(rows[1]).getByRole('link', { name: 'v001' }).getAttribute('href')).toBe(`/versions/${detail.entries[1].version_id}`);
    expect(within(rows[2]).getByRole('link', { name: 'v002' })).toBeTruthy();
  });

  it('moving an entry down posts the whole new order, and the first/last entries cannot move off the ends', async () => {
    const { calls } = open(lead, (c) => (c.method === 'POST' ? reply(flow.playlists_reorder) : undefined));
    await screen.findByRole('list', { name: 'Playlist entries' });
    expect((screen.getByRole('button', { name: 'Move entry 1 up' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Move entry 3 down' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Move entry 1 down' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    const [a, b, c] = detail.entries.map((e: { id: string }) => e.id);
    expect(path(posts(calls)[0])).toBe(`/api/v1/playlists/${detail.id}/reorder/`);
    expect(posts(calls)[0].body).toEqual({ entries: [{ id: b }, { id: a }, { id: c }] });
  });

  it('adds the chosen version, or a placeholder (no version_id), and removes an entry by id', async () => {
    const { calls } = open(lead, (c) => (c.method === 'POST' ? { status: 200, body: detail } : undefined));
    await screen.findByRole('list', { name: 'Playlist entries' });
    const add = screen.getByRole('button', { name: 'Add version' }) as HTMLButtonElement;
    expect(add.disabled).toBe(true); // nothing chosen
    const versionId = flow.versions_list.body.results[0].id as string;
    const select = await screen.findByLabelText('Add a version');
    await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: versionId } });
    fireEvent.click(add);
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(path(posts(calls)[0])).toBe(`/api/v1/playlists/${detail.id}/add-entry/`);
    expect(posts(calls)[0].body).toEqual({ version_id: versionId });

    fireEvent.click(screen.getByRole('button', { name: 'Add placeholder' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(2));
    expect(posts(calls)[1].body).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: 'Remove entry 2' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(3));
    expect(path(posts(calls)[2])).toBe(`/api/v1/playlists/${detail.id}/remove-entry/`);
    expect(posts(calls)[2].body).toEqual({ entry_id: detail.entries[1].id });
  });

  it('sharing posts only the flags the server stores, and says plainly that nothing else happens', async () => {
    const { calls } = open(lead, (c) => (c.method === 'POST' ? reply(flow.playlists_share) : undefined));
    await screen.findByRole('list', { name: 'Playlist entries' });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/only recorded on the playlist/)).toBeTruthy();
    expect(within(dialog).queryByLabelText('Expires on')).toBeNull(); // nothing enforces an expiry
    fireEvent.click(within(dialog).getByLabelText('Mark as shared outside the studio'));
    fireEvent.click(within(dialog).getByLabelText('Mark as passcode-protected'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save sharing' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(path(posts(calls)[0])).toBe(`/api/v1/playlists/${detail.id}/share/`);
    expect(posts(calls)[0].body).toEqual({ is_public: true, require_passcode: true, allow_client_approval: false });
  });

  it('a refusal from the server is shown, not swallowed', async () => {
    open(lead, (c) => (c.method === 'POST' ? reply(flow.playlists_reorder_unknown) : undefined));
    await screen.findByRole('list', { name: 'Playlist entries' });
    fireEvent.click(screen.getByRole('button', { name: 'Move entry 1 down' }));
    await waitFor(() => expect(useNotificationStore.getState().notifications.map((n) => n.message)).toContain('Unknown entry.'));
  });

  it('an artist reads the playlist and sees none of the controls', async () => {
    open(artist);
    await screen.findByRole('list', { name: 'Playlist entries' });
    expect(screen.queryByRole('button', { name: /^(Share|Add version|Add placeholder|Remove entry|Move entry)/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Edit details' })).toBeNull();
  });
});

describe('playlists list', () => {
  const listRoute = <Route path="/playlists" element={<DirectoryListPage config={usePlaylistsListConfig()} />} />;

  it('shows each playlist with its entry count and what was marked shared; an artist cannot create', async () => {
    mockFetch(() => reply(flow.playlists_list));
    renderAt('/playlists', artist, listRoute);
    const first = flow.playlists_list.body.results[0];
    await screen.findByRole('link', { name: new RegExp(`^${first.code}`) });
    expect(screen.queryByRole('link', { name: /New playlist/i })).toBeNull();
    cleanup();

    mockFetch(() => reply(flow.playlists_list));
    renderAt('/playlists', lead, listRoute);
    await screen.findByRole('link', { name: new RegExp(`^${first.code}`) });
    expect(screen.getByRole('link', { name: /New playlist/i }).getAttribute('href')).toBe('/playlists/new');
  });
});
