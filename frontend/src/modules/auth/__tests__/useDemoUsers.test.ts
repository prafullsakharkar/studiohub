import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/client/ApiClient', () => ({
  apiClient: { get: vi.fn().mockResolvedValue([]) },
}));

describe('demo workspaces (REST-only)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves to an empty list without fetching', async () => {
    const { useDemoUsers } = await import('../hooks/useDemoUsers');

    const { result } = await import('@testing-library/react').then(async ({ renderHook }) => {
      const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');
      const React = await import('react');
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
          QueryClientProvider,
          {
            client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
          },
          children
        );
      return renderHook(() => useDemoUsers(), { wrapper });
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('RESTAuthAdapter.getDemoUsers resolves [] without touching the API layer', async () => {
    const { apiClient } = await import('@/api/client/ApiClient');
    const { RESTAuthAdapter } = await import(
      '@/api/repositories/adapters/rest/RESTAuthAdapter'
    );

    await expect(new RESTAuthAdapter().getDemoUsers()).resolves.toEqual([]);
    expect(vi.mocked(apiClient.get)).not.toHaveBeenCalled();
  });
});
