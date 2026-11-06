import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { ProjectShotsTab } from '@/modules/production/components/project-tabs/ProjectShotsTab';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { ShotsPage } from '../pages/ShotsPage';

/**
 * Shots keep the staged "Bulk add shots" manager (grid → validate → resolve → preview → result), not the CR-48 Bulk
 * menu: on a project's Shots tab, and on the Shots page for the Project filter or else the active project.
 */
type Captured = { status: number; body: unknown };
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const shots = loadSample<Record<string, Captured>>('production/shots.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const project = work.setup_project.body as Project;

const path = (c: MockCall) => new URL(c.url).pathname;
const server = (c: MockCall): MockReply => {
  if (path(c) === `/api/v1/projects/${project.id}/`) return work.setup_project;
  if (path(c) === '/api/v1/shots/') return shots.list_admin;
  return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
};

const artist = auth.me_artist.body as unknown as User;

function renderIt(node: React.ReactNode, user: User = superuser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{node}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  useProductionStore.setState({ activeProjectId: null });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
});

const bulkMenu = () => screen.queryByRole('button', { name: /^Bulk$/ });

describe('bulk shots', () => {
  it('a project\'s Shots tab has "Bulk add shots" and no Bulk menu', async () => {
    mockFetch(server);
    renderIt(<ProjectShotsTab project={project} />);
    const button = await screen.findByRole('button', { name: 'Bulk add shots' });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(bulkMenu()).toBeNull();
  });

  it('the Shots page opens it on the active project', async () => {
    mockFetch(server);
    useProductionStore.setState({ activeProjectId: project.id });
    renderIt(<ShotsPage />);
    expect(await screen.findByRole('button', { name: 'Bulk add shots' })).toBeTruthy();
    expect(bulkMenu()).toBeNull();
  });

  it('the Shots page offers nothing without a project filter or an active project', async () => {
    mockFetch(server);
    renderIt(<ShotsPage />);
    await screen.findByRole('table', { name: 'Shots' });
    expect(screen.queryByRole('button', { name: 'Bulk add shots' })).toBeNull();
    expect(bulkMenu()).toBeNull();
  });

  it('is not offered to someone without shot.create (the server would refuse the create)', async () => {
    mockFetch(server);
    useProductionStore.setState({ activeProjectId: project.id });
    renderIt(<ShotsPage />, artist);
    await screen.findByRole('table', { name: 'Shots' });
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByRole('button', { name: 'Bulk add shots' })).toBeNull();

    cleanup();
    renderIt(<ProjectShotsTab project={project} />, artist);
    await screen.findByRole('table', { name: 'Shots' });
    expect(screen.queryByRole('button', { name: 'Bulk add shots' })).toBeNull();
  });
});
