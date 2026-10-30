import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { useProjects } from '../useProjects';

const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
/** A signed-in user with no role: nothing that starts with `project.`. */
const noRole = { ...artist, permissions: artist.permissions.filter((p) => !p.startsWith('project.')) } as User;

function run(user: User) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
  return renderHook(() => useProjects(), { wrapper });
}

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('useProjects', () => {
  it('asks for the list when the user may view projects', async () => {
    expect(artist.permissions).toContain('project.view');
    const { calls } = mockFetch(() => ({ status: 200, body: { count: 0, next: null, previous: null, results: [] } }));
    run(artist);
    await waitFor(() => expect(calls.some((c) => new URL(c.url).pathname === '/api/v1/projects/')).toBe(true));
  });

  it('does not ask, and so draws no 403 on every page, for a user without project.view', async () => {
    const { calls } = mockFetch(() => ({ status: 403, body: { detail: 'You do not have permission to perform this action.' } }));
    const { result } = run(noRole);
    await new Promise((resolve) => setTimeout(resolve, 50)); // a request, if one is made, is made by now
    expect(calls.filter((c) => new URL(c.url).pathname === '/api/v1/projects/')).toHaveLength(0);
    expect(result.current.fetchStatus).toBe('idle');
  });
});
