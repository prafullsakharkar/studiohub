import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { PROJECT_WORKSPACE_SECTIONS } from '../components/ProjectWorkspace';
import { ProjectWorkspacePage } from '../pages/ProjectWorkspacePage';

type Captured = { status: number; body: any; request?: { method: string; path: string; body: any } };
const flow = loadSample<Record<string, Captured>>('production/_workspaces_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;

const project = flow.project_detail.body as { id: string; code: string; name: string };
const cloned = flow.project_clone_settings.body as { id: string; code: string; name: string };
const path = (c: MockCall) => new URL(c.url).pathname;
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

const Where: React.FC = () => {
  const location = useLocation();
  return <p>{`at ${location.pathname}${location.search}`}</p>;
};

function mount() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[`/projects/${project.id}`]}>
          <Routes>
            <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
            <Route path="/projects" element={<Where />} />
            <Route path="/projects/:id/edit" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const openMore = async () => fireEvent.click(await screen.findByTitle('More Actions'));

let calls: MockCall[];
const server = (c: MockCall): MockReply => {
  calls.push(c);
  const p = path(c);
  if (p === `/api/v1/projects/${project.id}/`) return c.method === 'DELETE' ? { status: 204, body: null } : { body: flow.project_detail.body };
  if (p === '/api/v1/projects/' && c.method === 'POST') return { status: 201, body: flow.project_clone_settings.body };
  if (p === '/api/v1/projects/') return { body: page([flow.project_detail.body]) };
  return { body: page([]) };
};

beforeEach(() => {
  calls = [];
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('project workspace', () => {
  it('has no Attachments tab: the project has no attachment route, the old tab listed made-up files', () => {
    const tabs = PROJECT_WORKSPACE_SECTIONS.flatMap((section) => section.tabs);
    expect(tabs.map((t) => t.id)).not.toContain('attachments');
    expect(tabs.map((t) => t.label)).not.toContain('Attachments');
    expect(tabs.length).toBeGreaterThan(15);
  });

  it('reads the project from the typed route, and lists projects with a page size', async () => {
    mockFetch(server);
    mount();
    expect(await screen.findByRole('heading', { name: project.name })).toBeTruthy();
    const list = calls.find((c) => path(c) === '/api/v1/projects/' && c.method === 'GET');
    expect(list && new URL(list.url).searchParams.get('page_size')).toBe('100');
    expect(calls.some((c) => path(c) === `/api/v1/projects/${project.id}/` && c.method === 'GET')).toBe(true);
  });

  it('offers only the actions the server supports: no Close, Reopen, Delete or Restore, and no Attachments tab', async () => {
    mockFetch(server);
    mount();
    await screen.findByRole('heading', { name: project.name });
    await openMore();
    expect(await screen.findByRole('menuitem', { name: /Archive/ })).toBeTruthy();
    for (const gone of [/Close/, /Reopen/, /Delete/, /Restore/]) {
      expect(screen.queryByRole('menuitem', { name: gone })).toBeNull();
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
    }
    expect(screen.queryByText('Alex Chen')).toBeNull();
  });

  it('archives after a confirmation with a soft delete, and returns to the project list', async () => {
    mockFetch(server);
    mount();
    await screen.findByRole('heading', { name: project.name });
    await openMore();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive/ }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Project' }));
    await waitFor(() => expect(screen.getByText('at /projects')).toBeTruthy());
    const del = calls.find((c) => c.method === 'DELETE');
    expect(del && path(del)).toBe(`/api/v1/projects/${project.id}/`);
  });

  it('duplicates with the settings only (the request the server accepted) and opens the new project', async () => {
    mockFetch(server);
    mount();
    await screen.findByRole('heading', { name: project.name });
    fireEvent.click(await screen.findByRole('button', { name: /Duplicate/ }));
    fireEvent.change(await screen.findByDisplayValue(`${project.name} (Copy)`), { target: { value: cloned.name } });
    fireEvent.change(screen.getByDisplayValue(`${project.code}_CLONE`), { target: { value: cloned.code } });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Project' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    const captured = flow.project_clone_settings.request!.body as Record<string, unknown>;
    const sent = post.body as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(Object.keys(captured).sort());
    expect(sent.name).toBe(cloned.name);
    expect(sent.code).toBe(cloned.code);
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/projects/${cloned.id}/`)).toBe(true));
  });
});
