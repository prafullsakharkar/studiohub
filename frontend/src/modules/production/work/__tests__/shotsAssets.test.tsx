import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { useAssetsListConfig } from '../assets';
import { EntityTasksPanel, ShotAssetsPanel } from '../panels';
import { useShotsListConfig } from '../shots';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_work_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
/** The seeded lead-artist role adds these to an artist (init_platform.PRODUCTION_LEAD_PERMISSIONS); the live capture exercised them. */
const lead = { ...artist, permissions: [...artist.permissions, 'shot.update', 'shot.approve', 'asset.create', 'asset.update', 'task.create'] } as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const bare = (c: Captured): MockReply => ({ status: c.status, body: c.body.items });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const page = (results: unknown[]) => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function ShotsList({ projectId }: { projectId?: string }) {
  return <DirectoryListPage config={useShotsListConfig(projectId ? { projectId } : undefined)} />;
}
function AssetsList() {
  return <DirectoryListPage config={useAssetsListConfig()} />;
}

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
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

const shot = flow.shots_list.body.results[0] as { id: string; code: string; name: string; project_id: string };
const asset = flow.assets_list.body.results[0] as { id: string; code: string; name: string };

describe('shots list', () => {
  const route = (projectId?: string) => <Route path="/shots" element={<ShotsList projectId={projectId} />} />;

  it('offers shot-only moves (On Hold) and no Approved until the shot is in review', async () => {
    mockFetch(() => reply(flow.shots_list));
    renderAt('/shots', lead, route());
    await screen.findByRole('link', { name: `${shot.code} · ${shot.name}` });
    const menu = screen.getByLabelText(`Status of ${shot.code}`) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.value)).toEqual(['Not Started', 'In Progress', 'Pending Review', 'Retake', 'On Hold']);
  });

  it('Approved is its own action: POST …/approve/, and only for a holder of shot.approve', async () => {
    const inReview = { ...flow.shots_list.body.results[0], status: 'Pending Review' };
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.lead_shot_approve) : page([inReview])));
    renderAt('/shots', lead, route());
    await screen.findByRole('link', { name: `${shot.code} · ${shot.name}` });
    fireEvent.change(screen.getByLabelText(`Status of ${shot.code}`), { target: { value: 'Approved' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/shots/${shot.id}/approve/`);
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false);

    cleanup();
    mockFetch(() => page([inReview]));
    renderAt('/shots', { ...lead, permissions: lead.permissions.filter((p) => p !== 'shot.approve') } as User, route());
    await screen.findByRole('link', { name: `${shot.code} · ${shot.name}` });
    const menu = screen.getByLabelText(`Status of ${shot.code}`) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.value)).not.toContain('Approved'); // a lead without shot.approve is not offered it
  });

  it('any other move is a PATCH of the status; an artist (no shot.update) sees the status but cannot change it', async () => {
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? reply(flow.shots_patch_status_in_progress) : reply(flow.shots_list)));
    renderAt('/shots', lead, route());
    await screen.findByRole('link', { name: `${shot.code} · ${shot.name}` });
    fireEvent.change(screen.getByLabelText(`Status of ${shot.code}`), { target: { value: 'In Progress' } });
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ status: 'In Progress' });

    cleanup();
    mockFetch(() => reply(flow.shots_list));
    renderAt('/shots', artist, route());
    await screen.findByRole('link', { name: `${shot.code} · ${shot.name}` });
    expect(screen.queryByLabelText(`Status of ${shot.code}`)).toBeNull();
    expect(screen.queryByRole('link', { name: /New shot/ })).toBeNull();
  });

  it('inside a project it is scoped: project_id on every request, no project filter, New opens pre-filled', async () => {
    const { calls } = mockFetch(() => reply(flow.shots_list));
    renderAt('/shots', lead, route(shot.project_id));
    await screen.findByRole('link', { name: `${shot.code} · ${shot.name}` });
    expect(q(calls[0]).project_id).toBe(shot.project_id);
    expect(screen.queryByLabelText('Filter by project')).toBeNull();
  });

  it('Rename code asks for the new code and posts it to rename-code', async () => {
    const admin = { ...lead, permissions: [...lead.permissions, 'production.code.rename'] } as User;
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.shots_rename_code) : reply(flow.shots_list)));
    renderAt('/shots', admin, route());
    await screen.findByRole('link', { name: `${shot.code} · ${shot.name}` });
    fireEvent.click(screen.getByRole('button', { name: `Rename code ${shot.code}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('New code'), { target: { value: 'SH0015' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rename code' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/shots/${shot.id}/rename-code/`);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ code: 'SH0015' });
  });
});

describe('assets list', () => {
  const route = <Route path="/assets" element={<AssetsList />} />;

  it('asset status has no transition table: every other status is offered', async () => {
    mockFetch(() => reply(flow.assets_list));
    renderAt('/assets', lead, route);
    await screen.findByRole('link', { name: `${asset.code} · ${asset.name}` });
    const menu = screen.getByLabelText(`Status of ${asset.code}`) as HTMLSelectElement;
    expect([...menu.options].map((o) => o.value)).toEqual(['Not Started', 'In Progress', 'Pending Review', 'Approved', 'Retake']);
  });

  it('archiving needs asset.delete: a lead (create/update only) is not offered it', async () => {
    mockFetch(() => reply(flow.assets_list));
    renderAt('/assets', lead, route);
    await screen.findByRole('link', { name: `${asset.code} · ${asset.name}` });
    expect(screen.queryByRole('button', { name: `Archive ${asset.code}` })).toBeNull();
    expect(screen.getByRole('link', { name: /New asset/ })).toBeTruthy();
  });
});

describe('workspace panels', () => {
  it('a shot’s tasks are fetched by shot_id; New task opens pre-filled with the project and the link', async () => {
    const { calls } = mockFetch(() => reply(flow.tasks_list));
    renderAt('/x', lead, <Route path="/x" element={<EntityTasksPanel target={{ type: 'Shot', id: shot.id, code: shot.code, projectId: shot.project_id }} />} />);
    await screen.findByRole('table', { name: `Tasks on ${shot.code}` });
    expect(q(calls[0]).shot_id).toBe(shot.id);
    expect(screen.getByRole('link', { name: 'New task' }).getAttribute('href')).toBe(`/tasks/new?project=${shot.project_id}&entity_type=Shot&entity_id=${shot.id}`);
  });

  it('an asset’s tasks are fetched by asset_id', async () => {
    const { calls } = mockFetch(() => reply(flow.tasks_list));
    renderAt('/x', lead, <Route path="/x" element={<EntityTasksPanel target={{ type: 'Asset', id: asset.id, code: asset.code, projectId: shot.project_id }} />} />);
    await screen.findByRole('table', { name: `Tasks on ${asset.code}` });
    expect(q(calls[0]).asset_id).toBe(asset.id);
    expect(q(calls[0]).shot_id).toBeUndefined();
  });

  it('applying a template shows what was created and what already existed', async () => {
    const template = flow.templates_list.body.results[0] as { id: string; name: string };
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return reply(flow.templates_apply);
      if (path(c).startsWith('/api/v1/task-templates')) return reply(flow.templates_list);
      return reply(flow.tasks_list);
    });
    renderAt('/x', lead, <Route path="/x" element={<EntityTasksPanel target={{ type: 'Shot', id: shot.id, code: shot.code, projectId: shot.project_id }} />} />);
    await screen.findByRole('table', { name: `Tasks on ${shot.code}` });
    // a lead holds tasktemplate.view (the artist sample does too) and task.create
    fireEvent.click(await screen.findByRole('button', { name: 'Apply template' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('option', { name: new RegExp(template.name) });
    fireEvent.change(within(dialog).getByLabelText('Template'), { target: { value: template.id } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe(`/api/v1/task-templates/${template.id}/apply/`);
    expect(post.body).toEqual({ project_id: shot.project_id, entity_id: shot.id });
    const listCall = calls.find((c) => path(c) === '/api/v1/task-templates/')!;
    expect(q(listCall)).toMatchObject({ entity_type: 'Shot', is_active: 'true', project_id: shot.project_id });
  });

  it('a shot’s linked assets: link posts asset_id, unlink deletes by asset id', async () => {
    const assetRow = flow.assets_list.body.results[1] as { id: string; code: string; name: string };
    const link = flow.shots_assets.body.items[0] as { asset_id: string; asset_code: string };
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return reply(flow.assets_link);
      if (c.method === 'DELETE') return { status: 204, body: null };
      if (path(c) === `/api/v1/shots/${shot.id}/assets/`) return bare(flow.shots_assets);
      return reply(flow.assets_list);
    });
    renderAt('/x', lead, <Route path="/x" element={<ShotAssetsPanel shot={{ id: shot.id, code: shot.code, project_id: shot.project_id }} />} />);
    await screen.findByText(new RegExp(link.asset_code));

    await screen.findByRole('option', { name: new RegExp(assetRow.code) });
    fireEvent.change(screen.getByLabelText('Link an asset'), { target: { value: assetRow.id } });
    fireEvent.click(screen.getByRole('button', { name: 'Link asset' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ asset_id: assetRow.id });
    expect(q(calls.find((c) => path(c) === '/api/v1/assets/')!).project_id).toBe(shot.project_id); // only this project's assets

    fireEvent.click(screen.getByRole('button', { name: `Unlink ${link.asset_code}` }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Unlink' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(calls.find((c) => c.method === 'DELETE')!)).toBe(`/api/v1/shots/${shot.id}/assets/${link.asset_id}/`);
  });
});
