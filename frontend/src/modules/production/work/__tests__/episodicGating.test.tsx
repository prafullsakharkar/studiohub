import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { ProjectSequencesTab } from '@/modules/production/components/project-tabs/ProjectSequencesTab';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { shotsFormConfig, useShotsListConfig } from '../shots';

/**
 * CR-47: episode UI only for episodic projects. The episodic project is the captured ALPHA (workflow_type "episodic"), the
 * standard one a captured standard project; shot rows are captured rows moved onto ALPHA.
 */
type Captured = { status: number; body: any };
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const projects = loadSample<Record<string, Captured>>('production/projects.json');
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const superuser = loadSample('identity/_auth_flow.json').me_admin.body as unknown as User;

const episodic = structure.projects_detail.body as { id: string; code: string; workflow_type: string };
const standard = projects.detail_admin.body as { id: string; code: string; workflow_type: string };
const episodes = structure.episodes_list.body.results as Array<{ id: string; code: string }>;
const shotRow = { ...work.shots_list.body.results[0], project_id: episodic.id, episode_id: episodes[0].id };

const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const page = (results: unknown[]): MockReply => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function server(c: MockCall): MockReply {
  const p = path(c);
  if (p === '/api/v1/projects/') return page([episodic, standard]);
  if (p === `/api/v1/projects/${episodic.id}/`) return { status: 200, body: episodic };
  if (p === `/api/v1/projects/${standard.id}/`) return { status: 200, body: standard };
  if (p === '/api/v1/episodes/') return page(q(c).project === episodic.id ? episodes : []);
  if (p === '/api/v1/shots/') return page(q(c).project_id === standard.id ? [] : [shotRow]);
  if (p === '/api/v1/sequences/') return { status: 200, body: structure.sequences_list_after_bulk.body };
  return page([]);
}

function renderAt(initial: string, routes: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

function ShotsList() {
  return <DirectoryListPage config={useShotsListConfig()} />;
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

const headers = () => within(screen.getByRole('table', { name: 'Shots' })).getAllByRole('columnheader').map((h) => h.textContent);
const chooseProject = async (id: string) => {
  const select = screen.getByLabelText('Filter by project') as HTMLSelectElement;
  await waitFor(() => expect([...select.options].map((o) => o.value)).toContain(id));
  fireEvent.change(select, { target: { value: id } });
};

describe('shots list: the Episode column and filter', () => {
  it('are not offered across projects', async () => {
    mockFetch(server);
    renderAt('/shots', <Route path="/shots" element={<ShotsList />} />);
    await screen.findByRole('table', { name: 'Shots' });
    expect(headers()).not.toContain('Episode');
    expect(screen.queryByLabelText('Filter by episode')).toBeNull();
  });

  it('appear for an episodic project: the column shows the code, the filter offers that project’s episodes', async () => {
    const { calls } = mockFetch(server);
    renderAt('/shots', <Route path="/shots" element={<ShotsList />} />);
    await screen.findByRole('table', { name: 'Shots' });
    await chooseProject(episodic.id);

    await waitFor(() => expect(headers()).toContain('Episode'));
    expect(await screen.findByText(episodes[0].code, { selector: 'span' })).toBeTruthy();
    const filter = (await screen.findByLabelText('Filter by episode')) as HTMLSelectElement;
    await waitFor(() => expect([...filter.options].map((o) => o.value)).toEqual(['', ...episodes.map((e) => e.id)]));
    expect(calls.some((c) => path(c) === '/api/v1/episodes/' && q(c).project === episodic.id)).toBe(true);
  });

  it('go away for a standard project, and a chosen episode stops narrowing the list', async () => {
    const { calls } = mockFetch(server);
    renderAt('/shots', <Route path="/shots" element={<ShotsList />} />);
    await screen.findByRole('table', { name: 'Shots' });
    await chooseProject(episodic.id);
    const filter = (await screen.findByLabelText('Filter by episode')) as HTMLSelectElement;
    await waitFor(() => expect(filter.options.length).toBe(episodes.length + 1));
    fireEvent.change(filter, { target: { value: episodes[0].id } });
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/shots/' && q(c).episode_id === episodes[0].id)).toBe(true));

    await chooseProject(standard.id);
    await waitFor(() => expect(screen.queryByLabelText('Filter by episode')).toBeNull());
    await waitFor(() => {
      const last = calls.filter((c) => path(c) === '/api/v1/shots/').at(-1) as MockCall;
      expect(q(last).project_id).toBe(standard.id);
      expect(q(last).episode_id).toBeUndefined();
    });
  });
});

describe('shot form: the episode picker', () => {
  const route = <Route path="/shots/new" element={<DirectoryFormPage config={shotsFormConfig} />} />;

  it('is there, and required, for an episodic project', async () => {
    mockFetch(server);
    renderAt(`/shots/new?project=${episodic.id}`, route);
    expect(await screen.findByText('Episode *')).toBeTruthy();
  });

  it('is not offered for a standard project', async () => {
    const { calls } = mockFetch(server);
    renderAt(`/shots/new?project=${standard.id}`, route);
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/projects/${standard.id}/`)).toBe(true));
    await screen.findByText('Sequence *');
    expect(screen.queryByText(/^Episode/)).toBeNull();
  });
});

describe('project sequences tab', () => {
  it('a standard project’s sequence form has no episode picker and its table no Episode column', async () => {
    mockFetch(server);
    renderAt('/x', <Route path="/x" element={<ProjectSequencesTab project={standard} />} />);
    const table = await screen.findByRole('table', { name: 'Sequences' });
    expect(within(table).queryByText('Episode')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add sequence' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByText(/^Episode/)).toBeNull();
  });

  it('an episodic project’s sequence form keeps the episode picker', async () => {
    mockFetch(server);
    renderAt('/x', <Route path="/x" element={<ProjectSequencesTab project={episodic} />} />);
    const table = await screen.findByRole('table', { name: 'Sequences' });
    expect(within(table).getByText('Episode')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add sequence' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/^Episode/).length).toBeGreaterThan(0);
  });
});
