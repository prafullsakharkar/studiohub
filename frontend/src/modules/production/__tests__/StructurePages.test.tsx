import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { Sidebar } from '@/layouts/Sidebar';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { EpisodesPage, SequencesPage } from '../pages/StructurePages';

/**
 * Phase 2: the Episodes and Sequences entries of the Production section. Episodes only while the chosen project is episodic
 * (CR-47), Sequences always. The episodic project is the captured ALPHA, the standard one a captured standard project.
 */
type Captured = { status: number; body: any };
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const projects = loadSample<Record<string, Captured>>('production/projects.json');
const superuser = loadSample('identity/_auth_flow.json').me_admin.body as unknown as User;

const episodic = structure.projects_detail.body as { id: string; code: string };
const standard = projects.detail_admin.body as { id: string; code: string };
const episodes = structure.episodes_list.body.results as Array<{ code: string }>;

const path = (c: MockCall) => new URL(c.url).pathname;
const page = (results: unknown[]): MockReply => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function server(c: MockCall): MockReply {
  const p = path(c);
  if (p === '/api/v1/projects/') return page([episodic, standard]);
  if (p === `/api/v1/projects/${episodic.id}/`) return { status: 200, body: episodic };
  if (p === `/api/v1/projects/${standard.id}/`) return { status: 200, body: standard };
  if (p === '/api/v1/episodes/') return structure.episodes_list;
  if (p === '/api/v1/sequences/') return structure.sequences_list_after_bulk;
  return page([]);
}

function renderUi(ui: React.ReactNode, initial = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
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

describe('sidebar: Production section', () => {
  it('offers Episodes while the chosen project is episodic, next to Sequences', async () => {
    mockFetch(server);
    choose(episodic.id);
    renderUi(<Sidebar />);
    expect((await screen.findByRole('link', { name: /^Episodes$/ })).getAttribute('href')).toBe('/episodes');
    expect(screen.getByRole('link', { name: /^Sequences$/ }).getAttribute('href')).toBe('/sequences');
  });

  it('offers no Episodes for a standard project, and none with no project chosen; Sequences stay', async () => {
    const { calls } = mockFetch(server);
    choose(standard.id);
    renderUi(<Sidebar />);
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/projects/${standard.id}/`)).toBe(true));
    expect(screen.getByRole('link', { name: /^Sequences$/ })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('link', { name: /^Episodes$/ })).toBeNull();

    cleanup();
    choose(null);
    renderUi(<Sidebar />);
    expect(screen.getByRole('link', { name: /^Sequences$/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^Episodes$/ })).toBeNull();
  });
});

describe('Episodes page', () => {
  it('answers not-found by direct link while a standard project is chosen, and lists no episodes', async () => {
    const { calls } = mockFetch(server);
    choose(standard.id);
    renderUi(<EpisodesPage />, '/episodes');
    expect(await screen.findByText(/404 NOT FOUND/)).toBeTruthy();
    expect(calls.some((c) => path(c) === '/api/v1/episodes/')).toBe(false);
  });

  it('answers not-found with no project chosen', async () => {
    mockFetch(server);
    renderUi(<EpisodesPage />, '/episodes');
    expect(await screen.findByText(/404 NOT FOUND/)).toBeTruthy();
  });

  it('lists the episodes for an episodic project; its Project filter offers episodic projects only', async () => {
    mockFetch(server);
    choose(episodic.id);
    renderUi(<EpisodesPage />, '/episodes');
    const table = await screen.findByRole('table', { name: 'Episodes' });
    expect(await within(table).findByText(new RegExp(`^${episodes[0].code}`))).toBeTruthy();
    const filter = screen.getByLabelText('Filter by project') as HTMLSelectElement;
    await waitFor(() => expect([...filter.options].map((o) => o.value)).toEqual(['', episodic.id]));
  });
});

describe('Sequences page', () => {
  it('lists sequences across projects with no project chosen', async () => {
    mockFetch(server);
    renderUi(<SequencesPage />, '/sequences');
    const table = await screen.findByRole('table', { name: 'Sequences' });
    const first = structure.sequences_list_after_bulk.body.results[0] as { code: string };
    expect(await within(table).findByText(new RegExp(`^${first.code}`))).toBeTruthy();
    expect(within(table).queryByText('Episode')).toBeNull();
  });
});
