import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { AssetsPage } from '@/modules/assets';
import { DeliveriesPage } from '@/modules/deliveries';
import { MediaPage } from '@/modules/media';
import { PlaylistsPage } from '@/modules/playlists';
import { PublishedFilesPage, PublishingPage } from '@/modules/publishing';
import { ReviewsPage } from '@/modules/reviews';
import { MilestonesPage } from '@/modules/scheduling';
import { ShotsPage } from '@/modules/shots';
import { TasksPage, TimelogsPage } from '@/modules/tasks';
import { VersionsListPage } from '@/modules/versions';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { EpisodesPage, SequencesPage } from '../pages/StructurePages';

/**
 * The sidebar's lists of project records show the project chosen in the project switcher, and follow it when it changes:
 * every list request after a switch names the new project, none the old one. With no project chosen they list every
 * project, as before. Deliveries of one project come from the project's own route, the others take `project_id`.
 */
type Captured = { status: number; body: any };
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const projects = loadSample<Record<string, Captured>>('production/projects.json');
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const superuser = loadSample('identity/_auth_flow.json').me_admin.body as unknown as User;

const episodic = structure.projects_detail.body as { id: string; code: string };
const standard = projects.detail_admin.body as { id: string; code: string };
// A second episodic project, so Episodes can be switched between two (the captured project under another id and code).
const episodicTwo = { ...episodic, id: '7d1c2a4e-0b7f-4f61-9a43-3f0e2b8a5c11', code: 'BETA' };

const path = (c: MockCall) => new URL(c.url).pathname;
/** The project a list request names (`null`: none, every project), or `undefined` when it is not a request of `list`. */
type Reader = (c: MockCall) => string | null | undefined;
const byParam = (list: string): Reader => (c) => (path(c) === list ? new URL(c.url).searchParams.get('project_id') : undefined);
const deliveries: Reader = (c) => {
  if (path(c) === '/api/v1/deliveries/') return new URL(c.url).searchParams.get('project_id');
  return /^\/api\/organizations\/projects\/([^/]+)\/deliveries\/$/.exec(path(c))?.[1];
};
const page = (results: unknown[]): MockReply => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function server(c: MockCall): MockReply {
  const p = path(c);
  if (p === '/api/v1/projects/') return page([episodic, episodicTwo, standard]);
  for (const project of [episodic, episodicTwo, standard]) {
    if (p === `/api/v1/projects/${project.id}/`) return { status: 200, body: project };
  }
  if (p === '/api/v1/episodes/') return structure.episodes_list;
  if (p === '/api/v1/sequences/') return structure.sequences_list_after_bulk;
  if (p === '/api/v1/shots/') return work.shots_list;
  if (p === '/api/v1/assets/') return work.assets_list;
  return page([]);
}

function renderUi(ui: React.ReactNode, initial: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const choose = (projectId: string | null) => useProductionStore.setState({ activeProjectId: projectId });

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  choose(null);
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const cases: Array<{ name: string; ui: React.ReactNode; route: string; read: Reader; first: string; second: string }> = [
  { name: 'Episodes', ui: <EpisodesPage />, route: '/episodes', read: byParam('/api/v1/episodes/'), first: episodic.id, second: episodicTwo.id },
  { name: 'Sequences', ui: <SequencesPage />, route: '/sequences', read: byParam('/api/v1/sequences/'), first: episodic.id, second: standard.id },
  { name: 'Shots', ui: <ShotsPage />, route: '/shots', read: byParam('/api/v1/shots/'), first: episodic.id, second: standard.id },
  { name: 'Assets', ui: <AssetsPage />, route: '/assets', read: byParam('/api/v1/assets/'), first: episodic.id, second: standard.id },
  { name: 'Tasks', ui: <TasksPage />, route: '/tasks', read: byParam('/api/v1/tasks/'), first: episodic.id, second: standard.id },
  { name: 'Timelogs', ui: <TimelogsPage />, route: '/timelogs', read: byParam('/api/v1/timelogs/'), first: episodic.id, second: standard.id },
  { name: 'Versions', ui: <VersionsListPage />, route: '/versions', read: byParam('/api/v1/versions/'), first: episodic.id, second: standard.id },
  { name: 'Reviews', ui: <ReviewsPage />, route: '/reviews', read: byParam('/api/v1/reviews/'), first: episodic.id, second: standard.id },
  { name: 'Playlists', ui: <PlaylistsPage />, route: '/playlists', read: byParam('/api/v1/playlists/'), first: episodic.id, second: standard.id },
  { name: 'Media', ui: <MediaPage />, route: '/media', read: byParam('/api/v1/media/'), first: episodic.id, second: standard.id },
  { name: 'Deliveries', ui: <DeliveriesPage />, route: '/deliveries', read: deliveries, first: episodic.id, second: standard.id },
  { name: 'Export jobs', ui: <PublishingPage />, route: '/publishing', read: byParam('/api/v1/publishing/'), first: episodic.id, second: standard.id },
  { name: 'Published files', ui: <PublishedFilesPage />, route: '/publishing/files', read: byParam('/api/v1/publishing/files/'), first: episodic.id, second: standard.id },
  { name: 'Milestones', ui: <MilestonesPage />, route: '/scheduling/milestones', read: byParam('/api/v1/scheduling/milestones/'), first: episodic.id, second: standard.id },
];

const listed = (calls: MockCall[], read: Reader) => calls.map(read).filter((project) => project !== undefined);

describe.each(cases)('$name page and the project switcher', ({ ui, route, read, first, second }) => {
  it('lists the chosen project only, and follows a switch to another project', async () => {
    const { calls } = mockFetch(server);
    choose(first);
    renderUi(ui, route);
    await waitFor(() => expect(listed(calls, read).length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 20));
    expect(listed(calls, read)).toEqual(listed(calls, read).map(() => first));

    const before = listed(calls, read).length;
    act(() => choose(second));
    await waitFor(() => expect(listed(calls, read).length).toBeGreaterThan(before));
    await new Promise((r) => setTimeout(r, 20));
    const after = listed(calls, read).slice(before);
    expect(after).toEqual(after.map(() => second));
  });
});

describe.each(cases.filter((c) => c.name !== 'Episodes'))('$name page with no project chosen', ({ ui, route, read }) => {
  it('lists every project', async () => {
    const { calls } = mockFetch(server);
    renderUi(ui, route);
    await waitFor(() => expect(listed(calls, read).length).toBeGreaterThan(0));
    await new Promise((r) => setTimeout(r, 20));
    expect(listed(calls, read)).toEqual(listed(calls, read).map(() => null));
  });
});
