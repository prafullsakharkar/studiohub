import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVIEW_MEDIA_POLL_MS } from '@/api/production/review';
import type { Version } from '@/api/production/review';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useVersionsListConfig } from '@/modules/production/review/versions';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { DirectoryListPage } from '../DirectoryListPage';
import { teamsListConfig } from '../entities/teams';
import type { DirectoryListConfig } from '../types';

/** RP-10 WP 10.1: a list refreshes itself on a delay its rows decide (version cards keep their signed links fresh). */
type Captured = { status: number; body: any };
const teams = loadSample<Record<string, Captured>>('masterdata/teams.json');
const media = loadSample<Record<string, Captured>>('production/_review_media_flow.json');
const superuser = loadSample('identity/_auth_flow.json').me_admin.body as unknown as User;
const rows = teams.list_admin.body.results as Array<{ id: string }>;

const isList = (c: MockCall) => new URL(c.url).pathname.endsWith('/teams/');
const isBoard = (c: MockCall) => new URL(c.url).searchParams.get('page_size') === '500';

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

function renderList(config: DirectoryListConfig<any>) {
  const { calls } = mockFetch(() => ({ status: teams.list_admin.status, body: teams.list_admin.body }));
  render(
    <Providers>
      <MemoryRouter initialEntries={['/teams']}>
        <Routes>
          <Route path="/teams" element={<DirectoryListPage config={config} />} />
        </Routes>
      </MemoryRouter>
    </Providers>,
  );
  return calls;
}

const withBoard = (refetchInterval?: DirectoryListConfig<any>['refetchInterval']): DirectoryListConfig<any> => ({
  ...(teamsListConfig as DirectoryListConfig<any>),
  board: { render: (shown) => <p>{shown.length} on the board</p>, limit: 500 },
  refetchInterval,
});

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('a list that refreshes itself', () => {
  it('fetches the page again after the delay its rows decide, and hands it the rows on screen', async () => {
    const decide = vi.fn(() => 25);
    const calls = renderList(withBoard(decide));
    await screen.findByRole('table', { name: 'Teams' });
    await waitFor(() => expect(calls.filter(isList).length).toBeGreaterThanOrEqual(3));
    expect(decide).toHaveBeenCalledWith(rows);
  });

  it('does not when the rows say so (false), nor when the list has no rule', async () => {
    const calls = renderList(withBoard(() => false));
    await screen.findByRole('table', { name: 'Teams' });
    await new Promise((r) => setTimeout(r, 120));
    expect(calls.filter(isList)).toHaveLength(1);
    cleanup();

    const plain = renderList(withBoard());
    await screen.findByRole('table', { name: 'Teams' });
    await new Promise((r) => setTimeout(r, 120));
    expect(plain.filter(isList)).toHaveLength(1);
  });

  it('the board refreshes on the same rule', async () => {
    const decide = vi.fn(() => 25);
    const calls = renderList(withBoard(decide));
    await screen.findByRole('table', { name: 'Teams' });
    fireEvent.click(screen.getByRole('button', { name: 'Board view' }));
    await screen.findByText(`${rows.length} on the board`);
    await waitFor(() => expect(calls.filter(isBoard).length).toBeGreaterThanOrEqual(3));
  });
});

describe('the Versions list', () => {
  const version = (key: string) => media[key].body as Version;

  it('refreshes while a review movie is being made, before its signed links expire, and not otherwise', () => {
    const { result } = renderHook(() => useVersionsListConfig(), { wrapper: Providers });
    const refetch = result.current.refetchInterval;
    expect(refetch?.([version('version_with_queued_job')])).toBe(REVIEW_MEDIA_POLL_MS);
    // Ten minutes before the captured links expire: fetched again a minute before they do.
    const ready = version('version_ready');
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(ready.review_media?.links_expire_at ?? '') - 600_000);
    expect(refetch?.([ready])).toBe(540_000);
    expect(refetch?.([version('version_without_media')])).toBe(false);
    vi.restoreAllMocks();
  });
});
