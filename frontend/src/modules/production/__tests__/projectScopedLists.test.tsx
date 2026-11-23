import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { AssetsPage } from '@/modules/assets';
import { ShotsPage } from '@/modules/shots';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { EpisodesPage, SequencesPage } from '../pages/StructurePages';

/**
 * The Production lists of the sidebar (Episodes, Sequences, Shots, Assets) show the project chosen in the project switcher,
 * and follow it when it changes: every list request after a switch names the new project, none the old one. With no
 * project chosen they list every project, as before.
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
const projectOf = (c: MockCall) => new URL(c.url).searchParams.get('project_id');
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

const cases: Array<{ name: string; ui: React.ReactNode; route: string; list: string; first: string; second: string }> = [
  { name: 'Episodes', ui: <EpisodesPage />, route: '/episodes', list: '/api/v1/episodes/', first: episodic.id, second: episodicTwo.id },
  { name: 'Sequences', ui: <SequencesPage />, route: '/sequences', list: '/api/v1/sequences/', first: episodic.id, second: standard.id },
  { name: 'Shots', ui: <ShotsPage />, route: '/shots', list: '/api/v1/shots/', first: episodic.id, second: standard.id },
  { name: 'Assets', ui: <AssetsPage />, route: '/assets', list: '/api/v1/assets/', first: episodic.id, second: standard.id },
];

describe.each(cases)('$name page and the project switcher', ({ name, ui, route, list, first, second }) => {
  it('lists the chosen project only, and follows a switch to another project', async () => {
    const { calls } = mockFetch(server);
    choose(first);
    renderUi(ui, route);
    await screen.findByRole('table', { name });
    const lists = () => calls.filter((c) => path(c) === list);
    await waitFor(() => expect(lists().length).toBeGreaterThan(0));
    expect(lists().map(projectOf)).toEqual(lists().map(() => first));

    const before = lists().length;
    act(() => choose(second));
    await waitFor(() => expect(lists().length).toBeGreaterThan(before));
    await screen.findByRole('table', { name });
    expect(lists().slice(before).map(projectOf)).toEqual(lists().slice(before).map(() => second));
  });
});

describe.each(cases.filter((c) => c.name !== 'Episodes'))('$name page with no project chosen', ({ name, ui, route, list }) => {
  it('lists every project', async () => {
    const { calls } = mockFetch(server);
    renderUi(ui, route);
    await screen.findByRole('table', { name });
    const lists = calls.filter((c) => path(c) === list);
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.map(projectOf)).toEqual(lists.map(() => null));
  });
});
