import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { DirectoryListPage } from '../DirectoryListPage';
import { teamsListConfig } from '../entities/teams';

type Captured = { status: number; body: any };
const teams = loadSample<Record<string, Captured>>('masterdata/teams.json');
const conflicts = loadSample<Record<string, Captured>>('_misc/conflicts_and_pagination.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;
const rows = teams.list_admin.body.results as Array<{ id: string; name: string; code: string }>;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

function renderList(user: User) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={['/teams']}>
          <Routes>
            <Route path="/teams" element={<DirectoryListPage config={teamsListConfig} />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
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

describe('list card view', () => {
  it('starts as the table; Card view shows one card per row, with the other columns as labelled values', async () => {
    mockFetch(() => reply(teams.list_admin));
    renderList(superuser);
    await screen.findByRole('table', { name: 'Teams' });
    expect((screen.getByRole('button', { name: 'Table view' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
    const list = await screen.findByRole('list', { name: 'Teams' });
    expect(screen.queryByRole('table')).toBeNull();
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(rows.length);
    expect(within(cards[0]).getByRole('link', { name: rows[0].name })).toBeTruthy();
    expect(within(cards[0]).getByText('Members')).toBeTruthy();
    expect(within(cards[0]).getByText(rows[0].code)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Card view' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('remembers the choice for this screen, and a page opened later starts in it', async () => {
    mockFetch(() => reply(teams.list_admin));
    renderList(superuser);
    await screen.findByRole('table', { name: 'Teams' });
    fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
    cleanup();

    renderList(superuser);
    expect(await screen.findByRole('list', { name: 'Teams' })).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Table view' }));
    cleanup();
    renderList(superuser);
    expect(await screen.findByRole('table', { name: 'Teams' })).toBeTruthy();
  });

  it('still works when the browser will not store the choice', async () => {
    mockFetch(() => reply(teams.list_admin));
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    renderList(superuser);
    await screen.findByRole('table', { name: 'Teams' });
    fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
    expect(await screen.findByRole('list', { name: 'Teams' })).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('a card has the same Edit and Delete as a table row, and a delete blocked by references says why', async () => {
    mockFetch((c) => (c.method === 'DELETE' ? reply(conflicts.department_delete_referenced) : reply(teams.list_admin)));
    renderList(superuser);
    await screen.findByRole('table', { name: 'Teams' });
    fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
    const card = (await screen.findAllByRole('listitem'))[0];
    expect(within(card).getByRole('link', { name: `Edit ${rows[0].name}` }).getAttribute('href')).toBe(`/teams/${rows[0].id}/edit`);

    fireEvent.click(within(card).getByRole('button', { name: `Delete ${rows[0].name}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText(/Still referenced by/i)).toBeTruthy();
  });

  it('a user without the manage permission sees the cards and no controls', async () => {
    mockFetch(() => reply(teams.list_admin));
    renderList(artist);
    await screen.findByRole('table', { name: 'Teams' });
    fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
    await screen.findByRole('list', { name: 'Teams' });
    expect(screen.queryByRole('link', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
  });

  it('sorting in card view uses the server ordering, ascending then descending', async () => {
    const { calls } = mockFetch(() => reply(teams.list_admin));
    renderList(superuser);
    await screen.findByRole('table', { name: 'Teams' });
    fireEvent.click(screen.getByRole('button', { name: 'Card view' }));
    await screen.findByRole('list', { name: 'Teams' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), { target: { value: 'code' } });
    await waitFor(() => expect(calls.some((c) => q(c).ordering === 'code')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Ascending, switch to descending/ }));
    await waitFor(() => expect(calls.some((c) => q(c).ordering === '-code')).toBe(true));
  });

  it('offers a Board view only to a list that has one; a saved "board" on any other list is the table', async () => {
    localStorage.setItem('studiohub.listView:/teams', 'board');
    mockFetch(() => reply(teams.list_admin));
    renderList(superuser);
    await screen.findByRole('table', { name: 'Teams' });
    expect(screen.queryByRole('button', { name: 'Board view' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Table view' }) as HTMLButtonElement).getAttribute('aria-pressed')).toBe('true');
  });
});
