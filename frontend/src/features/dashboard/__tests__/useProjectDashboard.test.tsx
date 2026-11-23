import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { useProjectDashboard } from '../hooks/useProjectDashboard';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('dashboards/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const projectId: string = flow.dashboard.body.project.id;

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: artist, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );

beforeEach(() => {
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  useProductionStore.setState({ activeProjectId: projectId });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  useProductionStore.setState({ activeProjectId: null });
  vi.unstubAllGlobals();
});

describe('useProjectDashboard', () => {
  it('a page unmounted while the dashboard loads aborts its request, so a remount does not send a second one', async () => {
    const { stub } = mockFetch(() => ({ status: 200, body: flow.dashboard.body, delayMs: 20 }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // Unmount while the first request is in flight, then mount again on the same cache: React Query
    // cancels the first fetch (the query function reads the signal) and starts a new one.
    renderHook(() => useProjectDashboard({ refetchInterval: false }), { wrapper: wrapper(client) }).unmount();
    const { result } = renderHook(() => useProjectDashboard({ refetchInterval: false }), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.project.id).toBe(projectId);
    // Requests the browser actually sends: an aborted signal makes fetch reject before anything goes out.
    const sent = stub.mock.calls.filter(([input]) => {
      const request = input as Request;
      return new URL(request.url).pathname === `/api/v1/projects/${projectId}/dashboard/` && !request.signal.aborted;
    });
    expect(sent).toHaveLength(1);
  });
});
