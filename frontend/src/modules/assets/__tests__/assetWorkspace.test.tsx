import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { AssetWorkspacePage } from '../pages/AssetWorkspacePage';

type Captured = { status: number; body: any };
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const ws = loadSample<Record<string, any>>('production/_workspaces_flow.json');
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;

const parent = work.assets_detail.body as { id: string; code: string; name: string; project_id: string; assigned_artist_id: string | null };
const rows = work.assets_list.body.results as Array<{ id: string; code: string; name: string; parent_asset_id: string | null }>;
const child = rows.find((r) => r.parent_asset_id === parent.id) as (typeof rows)[number];
const members = structure.members_get.body.results as Array<{ user_id: string }>;
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });
const noteRows = ws.notes_search_asset.body.results as Array<{ subject: string; entity_id: string }>;
const assetId = ws.ids.asset as string;

const Where: React.FC = () => {
  const location = useLocation();
  return <p>{`at ${location.pathname}${location.search}`}</p>;
};

function mount(route: string) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/assets/:assetId" element={<AssetWorkspacePage />} />
            <Route path="/assets" element={<p>Assets list</p>} />
            <Route path="/tasks/new" element={<Where />} />
            <Route path="/versions/new" element={<Where />} />
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

describe('asset workspace', () => {
  const server = (c: MockCall): MockReply => {
    const p = path(c);
    if (p === `/api/v1/assets/${parent.id}/`) return c.method === 'PATCH' ? { body: { ...work.assets_detail.body, ...(c.body as object) } } : { body: work.assets_detail.body };
    if (p === `/api/v1/assets/${child.id}/`) return { body: child };
    if (p === `/api/v1/assets/${parent.id}/archive/`) return { body: ws.asset_archive.body };
    if (p === '/api/v1/assets/') return { body: work.assets_list.body };
    if (p === `/api/organizations/projects/${parent.project_id}/members/`) return { body: structure.members_get.body };
    if (p === `/api/organizations/projects/${parent.project_id}/notes/`) return c.method === 'POST' ? { status: 201, body: ws.note_on_asset.body } : { body: ws.notes_search_asset.body };
    return { body: page([]) };
  };

  it('shows the asset’s own fields, its child assets, and none of the invented ones', async () => {
    mockFetch(server);
    mount(`/assets/${parent.id}`);
    expect(await screen.findByRole('heading', { name: parent.name })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Asset' })).getByText('Category')).toBeTruthy();
    expect(await within(await screen.findByRole('region', { name: 'Hierarchy' })).findByRole('link', { name: new RegExp(child.code) })).toBeTruthy();
    for (const invented of ['Sarah Jenkins', 'Geometry Payload', 'Elena Rostova', 'Spin Turntable']) expect(screen.queryByText(invented)).toBeNull();
    for (const gone of ['Assignments', 'Dependencies', 'Publishing', 'Attachments']) expect(screen.queryByRole('button', { name: gone })).toBeNull();
  });

  it('looks for child assets in the asset’s own project only', async () => {
    const { calls } = mockFetch(server);
    mount(`/assets/${parent.id}`);
    await screen.findByRole('region', { name: 'Hierarchy' });
    expect(params(calls.find((c) => path(c) === '/api/v1/assets/') as MockCall).project).toBe(parent.project_id);
  });

  it('opens the task and version forms already naming this asset', async () => {
    mockFetch(server);
    mount(`/assets/${parent.id}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Add Task' }));
    expect(await screen.findByText(`at /tasks/new?project=${parent.project_id}&entity_type=Asset&entity_id=${parent.id}`)).toBeTruthy();
    cleanup();
    mockFetch(server);
    mount(`/assets/${parent.id}`);
    fireEvent.click(await screen.findByTitle('More Actions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Submit New Version/ }));
    expect(await screen.findByText(`at /versions/new?project=${parent.project_id}&asset=${parent.id}`)).toBeTruthy();
  });

  it('names the parent of a child asset, found by its parent id', async () => {
    mockFetch(server);
    mount(`/assets/${child.id}`);
    const hierarchy = await screen.findByRole('region', { name: 'Hierarchy' });
    expect(await within(hierarchy).findByRole('link', { name: new RegExp(parent.code) })).toBeTruthy();
  });

  it('offers no Approve, USD viewport or permanent delete: none exists on the server', async () => {
    mockFetch(server);
    mount(`/assets/${parent.id}`);
    fireEvent.click(await screen.findByTitle('More Actions'));
    await screen.findByRole('menuitem', { name: /Copy Asset Code/ });
    for (const gone of [/Approve/, /USD Viewport/, /Permanently/]) expect(screen.queryByRole('menuitem', { name: gone })).toBeNull();
  });

  it('archives with the archive route, after asking, and returns to the asset list', async () => {
    const { calls } = mockFetch(server);
    mount(`/assets/${parent.id}`);
    fireEvent.click(await screen.findByTitle('More Actions'));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive Asset/ }));
    expect(calls.some((c) => c.method === 'POST' && path(c).endsWith('/archive/'))).toBe(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Asset' }));
    expect(await screen.findByText('Assets list')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'POST' && path(c).endsWith('/archive/')).length).toBe(1);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('assigns a project member as the artist', async () => {
    const { calls } = mockFetch(server);
    mount(`/assets/${parent.id}`);
    fireEvent.click(await screen.findByRole('button', { name: 'Assign Artist' }));
    const select = (await screen.findByLabelText('Artist')) as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: members[0].user_id } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(path(calls.find((c) => c.method === 'PATCH') as MockCall)).toBe(`/api/v1/assets/${parent.id}/`);
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ assigned_artist: members[0].user_id });
  });

  it('lists the notes that name this asset and adds one that names it', async () => {
    const noted = { ...work.assets_detail.body, id: assetId };
    const { calls } = mockFetch((c) => (path(c) === `/api/v1/assets/${assetId}/` ? { body: noted } : server(c)));
    mount(`/assets/${assetId}`);
    fireEvent.click(await screen.findByRole('tab', { name: 'Notes' }));
    const own = noteRows.find((n) => n.entity_id === assetId) as { subject: string };
    expect(await screen.findByText(own.subject)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Fix the rig' } });
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ subject: 'Fix the rig', entity_type: 'Asset', entity_id: assetId });
    expect(params(calls.find((c) => path(c).endsWith('/notes/')) as MockCall).search).toBe(noted.code);
  });
});
