import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { CatalogAdminPage } from '../CatalogAdminPage';

type Captured = { status: number; body: any };
const statuses = loadSample<Record<string, Captured>>('masterdata/platform__master-data__statuses.json');
const taskTypes = loadSample<Record<string, Captured>>('masterdata/platform__master-data__task-types.json');
const software = loadSample<Record<string, Captured>>('masterdata/platform__master-data__software.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

function renderAt(initial: string, user: User) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/platform/catalog/:kind" element={<CatalogAdminPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
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

describe('catalog', () => {
  const tasks = taskTypes.list_admin.body.items as Array<{ id: string; name: string; code: string; is_system: boolean }>;

  it('reads the unpaginated list from the slash-less route with the status filter', async () => {
    const { calls } = mockFetch(() => bare(taskTypes.list_admin));
    renderAt('/platform/catalog/task-types', superuser);
    expect(await screen.findByText(tasks[0].name)).toBeTruthy();
    expect(path(calls[0])).toBe('/api/v1/platform/master-data/task-types'); // a trailing slash would be a 404
    expect(q(calls[0])).toEqual({ status: 'active' });
  });

  it('searches on the server and can show archived rows', async () => {
    const { calls } = mockFetch(() => bare(taskTypes.list_admin));
    renderAt('/platform/catalog/task-types', superuser);
    await screen.findByText(tasks[0].name);

    fireEvent.change(screen.getByLabelText('Search task types'), { target: { value: 'comp' } });
    await waitFor(() => expect(calls.some((c) => q(c).search === 'comp')).toBe(true));
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'archived' } });
    await waitFor(() => expect(calls.some((c) => q(c).status === 'archived')).toBe(true));
  });

  it('archives with a POST to the archive route; system rows cannot be deleted', async () => {
    const system = (statuses.list_admin.body.items as Array<{ id: string; name: string; is_system: boolean }>).find((s) => s.is_system)!;
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { body: system } : bare(statuses.list_admin)));
    renderAt('/platform/catalog/statuses', superuser);
    await screen.findAllByText(system.name);

    expect(screen.queryByRole('button', { name: `Delete ${system.name}` })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: `Archive ${system.name}` })[0]);
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/platform/master-data/statuses/${system.id}/archive`);
  });

  it('moving a row sends the whole visible order to /reorder', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { body: [] } : bare(taskTypes.list_admin)));
    renderAt('/platform/catalog/task-types', superuser);
    await screen.findByText(tasks[0].name);

    fireEvent.click(screen.getByRole('button', { name: `Move ${tasks[1].name} up` }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe('/api/v1/platform/master-data/task-types/reorder');
    expect(post.body).toEqual({ ids: [tasks[1].id, tasks[0].id] });
  });

  it('offers no reordering while a search narrows the list (the API renumbers exactly the ids it gets)', async () => {
    mockFetch(() => bare(taskTypes.list_admin));
    renderAt('/platform/catalog/task-types', superuser);
    await screen.findByText(tasks[0].name);
    fireEvent.change(screen.getByLabelText('Search task types'), { target: { value: 'x' } });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Move / })).toBeNull());
  });

  it('read-only for a user without masterdata.catalog.manage', async () => {
    mockFetch(() => bare(taskTypes.list_admin));
    renderAt('/platform/catalog/task-types', artist);
    await screen.findByText(tasks[0].name);
    for (const name of [/^New task type/, /^Edit /, /^Archive /, /^Delete /, /^Move /]) expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('create sends only filled fields to the collection route', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: tasks[0] } : bare(taskTypes.list_admin)));
    renderAt('/platform/catalog/task-types', superuser);
    await screen.findByText(tasks[0].name);

    fireEvent.click(screen.getByRole('button', { name: /new task type/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Name/), { target: { value: 'Matchmove' } });
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: 'mm' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create task type' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe('/api/v1/platform/master-data/task-types');
    expect(post.body).toEqual({ name: 'Matchmove', code: 'mm' });
  });

  it('software rows open their versions list from the nested route', async () => {
    const sw = (software.list_admin.body.items as Array<{ id: string; name: string }>)[0];
    const { calls } = mockFetch((c) => (path(c).endsWith('/versions') ? { body: [] } : bare(software.list_admin)));
    renderAt('/platform/catalog/software', superuser);
    await screen.findByText(sw.name);

    fireEvent.click(screen.getByRole('button', { name: `Versions of ${sw.name}` }));
    await screen.findByRole('dialog');
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/platform/master-data/software/${sw.id}/versions`)).toBe(true));
  });
});
