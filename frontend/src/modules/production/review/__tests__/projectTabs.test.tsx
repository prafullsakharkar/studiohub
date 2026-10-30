import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { ProjectMediaTab } from '@/modules/production/components/project-tabs/ProjectMediaTab';
import { ProjectPlaylistsTab } from '@/modules/production/components/project-tabs/ProjectPlaylistsTab';
import { ProjectReviewsTab } from '@/modules/production/components/project-tabs/ProjectReviewsTab';
import { ProjectVersionsTab } from '@/modules/production/components/project-tabs/ProjectVersionsTab';
import { ProjectWorkflowTab } from '@/modules/production/components/project-tabs/ProjectWorkflowTab';
import { mockFetch } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import type { Project } from '@/types/production';

const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const project = { id: 'p-123', code: 'PRJ' } as unknown as Project;

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('project tabs', () => {
  it.each([
    ['versions', ProjectVersionsTab, '/api/v1/versions/', 'Versions'],
    ['reviews', ProjectReviewsTab, '/api/v1/reviews/', 'Reviews'],
    ['playlists', ProjectPlaylistsTab, '/api/v1/playlists/', 'Playlists'],
    ['media', ProjectMediaTab, '/api/v1/media/', 'Media'],
    ['workflow', ProjectWorkflowTab, '/api/v1/workflows/', 'Workflows'],
  ] as const)('the %s tab asks the server for this project only', async (_name, Tab, listPath, title) => {
    const { calls } = mockFetch((c) => (new URL(c.url).pathname === '/api/v1/media/' ? { status: 200, body: [] } : { status: 200, body: { count: 0, next: null, previous: null, results: [] } }));
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user: artist, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter>
            <Tab project={project} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    await screen.findByRole('heading', { name: title });
    await waitFor(() => expect(calls.some((c) => new URL(c.url).pathname === listPath)).toBe(true));
    const list = calls.find((c) => new URL(c.url).pathname === listPath)!;
    expect(new URL(list.url).searchParams.get('project_id')).toBe('p-123');
  });
});
