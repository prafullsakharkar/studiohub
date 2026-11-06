import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { useShotsListConfig } from '../shots';

/** CR-50: the Shots list can show only the shots that belong to no sequence (`has_sequence=false`). */
type Captured = { status: number; body: any };
const shots = loadSample<Record<string, Captured>>('production/shots.json');
const superuser = loadSample('identity/_auth_flow.json').me_admin.body as unknown as User;

const path = (c: MockCall) => new URL(c.url).pathname;
const server = (c: MockCall): MockReply => (path(c) === '/api/v1/shots/' ? shots.list_admin : { status: 200, body: { count: 0, next: null, previous: null, results: [] } });

function List() {
  return <DirectoryListPage config={useShotsListConfig()} />;
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
});

const shotCalls = (calls: MockCall[]) => calls.filter((c) => path(c) === '/api/v1/shots/');
const lastQuery = (calls: MockCall[]) => new URL(shotCalls(calls).at(-1)?.url as string).searchParams;

describe('the Shots list: Without a sequence', () => {
  it('asks the server for has_sequence=false, then true, and stops asking when it is cleared', async () => {
    const { calls } = mockFetch(server);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter>
            <List />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    const select = (await screen.findByLabelText('Filter by sequences')) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['All sequences', 'Without a sequence', 'In a sequence']);
    await waitFor(() => expect(shotCalls(calls).length).toBeGreaterThan(0));
    expect(lastQuery(calls).has('has_sequence')).toBe(false);

    fireEvent.change(select, { target: { value: 'false' } });
    await waitFor(() => expect(lastQuery(calls).get('has_sequence')).toBe('false'));

    fireEvent.change(select, { target: { value: 'true' } });
    await waitFor(() => expect(lastQuery(calls).get('has_sequence')).toBe('true'));

    fireEvent.change(select, { target: { value: '' } });
    await waitFor(() => expect(lastQuery(calls).has('has_sequence')).toBe(false));
  });
});
