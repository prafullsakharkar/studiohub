import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Project } from '@/types/production';

// Mocked transport: the ONLY way to exercise REST payload shapes without Django.
vi.mock('@/api/client/ApiClient', () => ({
  // Class stub: masterDataApi (pulled in transitively by the production
  // module barrels) constructs `new ApiClient()` at module load. Its methods
  // are never called by these tests.
  ApiClient: class ApiClientStub {},
  apiClient: {
    get: vi.fn(),
    post: vi.fn(async (_url: string, body: any) => ({ ...body, id: 'new-1' })),
    put: vi.fn(async (_url: string, body: any) => body),
    patch: vi.fn(async (_url: string, body: any) => body),
    delete: vi.fn(async () => ({})),
  },
}));

describe('episodic REST payloads (mocked transport)', () => {
  beforeEach(() => {
    // Clears call history but keeps the async implementations above.
    vi.clearAllMocks();
  });

  it('sends the full id chain on sequence create', async () => {
    const { apiClient } = await import('@/api/client/ApiClient');
    const { SequenceRepository } = await import(
      '@/modules/sequences/repositories/SequenceRepository'
    );
    await new SequenceRepository().create({
      project_id: 'proj-102',
      episode_id: 'ep-101',
      code: 'SQ01',
      name: 'Seq 1',
    } as any);
    expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith(
      expect.stringMatching(/sequences/),
      expect.objectContaining({ project_id: 'proj-102', episode_id: 'ep-101' })
    );
  });

  it('sends the full id chain on shot bulk-create', async () => {
    // Real bulk entry point: ShotService.bulkCreate → RESTShotAdapter.bulkCreate
    // (the registry proxy resolves to the Mock adapter under vitest, and the
    // Mock adapter never touches apiClient — so the REST adapter is injected
    // directly to exercise the real REST shape). BaseRESTAdapter.request()
    // lazily imports the mocked ApiClient and posts (url, body, headers).
    const { apiClient } = await import('@/api/client/ApiClient');
    const { ShotService } = await import('@/modules/shots/services/ShotService');
    const { RESTShotAdapter } = await import(
      '@/api/repositories/adapters/rest/RESTShotAdapter'
    );

    const service = new ShotService(new RESTShotAdapter());
    await service.bulkCreate({
      project_id: 'proj-102',
      items: [
        { code: 'SH010', name: 'Shot 10', episode_id: 'ep-101' },
        { code: 'SH020', name: 'Shot 20', episode_id: 'ep-101' },
      ],
    } as any);

    expect(vi.mocked(apiClient.post)).toHaveBeenCalledWith(
      expect.stringMatching(/bulk-create/),
      expect.objectContaining({
        project_id: 'proj-102',
        items: expect.arrayContaining([
          expect.objectContaining({ code: 'SH010', episode_id: 'ep-101' }),
          expect.objectContaining({ code: 'SH020', episode_id: 'ep-101' }),
        ]),
      }),
      expect.anything() // headers object (undefined headers) — 3-arg post call
    );
  });

  it('tolerates a 404 episodes transport without crashing', async () => {
    // Real hook chain (Task B-1): useProjectEpisodes → ProjectScopedApiService
    // .getEpisodes → apiClient.get('/api/v1/episodes/', { project_id, … }) —
    // the canonical DRF endpoint; the old org-scoped mock route is gone.
    // Point the mocked get at a rejected 404 for that URL and render the
    // episodes tab content → the UI must degrade to EmptyState, never throw.
    const { apiClient } = await import('@/api/client/ApiClient');
    const { ProjectEpisodesTab } = await import(
      '@/modules/production/components/project-tabs/ProjectEpisodesTab'
    );

    const notFound = Object.assign(new Error('Not Found'), {
      name: 'ApiError',
      status: 404,
      statusCode: 404,
    });
    vi.mocked(apiClient.get).mockRejectedValue(notFound);

    const project = {
      id: 'proj-102',
      code: 'SOL03',
      name: 'Solar Odyssey 3000',
      organization_id: 'org-vanguard-02',
      type: 'Episodic Series',
      status: 'In Progress',
    } as unknown as Project;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // createElement (not JSX): the brief mandates a .ts test file, and
    // esbuild does not transform JSX inside .ts.
    render(
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(ProjectEpisodesTab, {
            project,
            onNavigateTab: () => {},
          })
        )
      )
    );

    // The transport was genuinely exercised with the canonical episodic URL.
    await waitFor(() =>
      expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith(
        '/api/v1/episodes/',
        expect.objectContaining({
          params: expect.objectContaining({ project_id: 'proj-102' }),
        })
      )
    );

    // A rejected 404 must degrade to EmptyState, never throw.
    expect(await screen.findByText('No episodes found')).toBeInTheDocument();
  });
});
