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
import { ShotWorkspacePage } from '../pages/ShotWorkspacePage';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, any>>('production/_workspaces_flow.json');
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;

const ids = flow.ids as { project: string; shot: string; artist: string };
const shot = flow.shot_detail.body as { id: string; code: string; name: string; status: string; project_id: string; assigned_artist_id: string | null };
const members = structure.members_get.body.results as Array<{ user_id: string; name: string; email: string; role: string }>;
const path = (c: MockCall) => new URL(c.url).pathname;
const params = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });
const noteRows = flow.notes_search_shot.body.results as Array<{ id: string; subject: string; entity_id: string; entity_type: string }>;

function mount(route = `/shots/${shot.id}`) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[route]}>
          <Routes>
            <Route path="/shots/:shotId" element={<ShotWorkspacePage />} />
            <Route path="/shots" element={<p>Shots list</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const openMore = async () => fireEvent.click(await screen.findByTitle('More Actions'));

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('shot workspace', () => {
  let detail: Record<string, unknown>;
  const server = (c: MockCall): MockReply => {
    const p = path(c);
    if (p === `/api/v1/shots/${shot.id}/`) return c.method === 'PATCH' ? { body: { ...detail, ...(c.body as object) } } : { body: detail };
    if (p === `/api/v1/shots/${shot.id}/approve/`) return { body: flow.shot_approve.body };
    if (p === `/api/v1/shots/${shot.id}/archive/`) return { body: flow.shot_archive.body };
    if (p === `/api/organizations/projects/${ids.project}/members/`) return { body: structure.members_get.body };
    if (p === `/api/organizations/projects/${ids.project}/notes/`) {
      if (c.method === 'POST') return { status: 201, body: flow.note_on_shot.body };
      return { body: flow.notes_search_shot.body };
    }
    return { body: page([]) };
  };
  beforeEach(() => {
    detail = { ...flow.shot_detail.body };
  });

  it('shows the shot’s own fields and none of the invented ones', async () => {
    mockFetch(server);
    mount();
    expect(await screen.findByRole('heading', { name: shot.name })).toBeTruthy();
    const grid = screen.getByRole('region', { name: 'Shot' });
    expect(within(grid).getByText('Frame range')).toBeTruthy();
    for (const invented of ['Compositing', 'Elena Rostova', 'Medium', 'v001']) expect(screen.queryByText(invented)).toBeNull();
    for (const gone of ['Assignments', 'Activity']) expect(screen.queryByRole('button', { name: gone })).toBeNull();
  });

  it('offers Approve only from Pending Review, the one state the server approves from', async () => {
    mockFetch(server);
    mount();
    await openMore();
    expect(screen.queryByRole('menuitem', { name: /Approve Shot/ })).toBeNull();
    cleanup();

    detail = { ...flow.shot_detail.body, status: 'Pending Review' };
    const { calls } = mockFetch(server);
    mount();
    await openMore();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Approve Shot/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/shots/${shot.id}/approve/` && c.method === 'POST')).toBe(true));
  });

  it('archives with the archive route (there is no permanent delete) and returns to the shot list', async () => {
    const { calls } = mockFetch(server);
    mount();
    await openMore();
    expect(screen.queryByRole('menuitem', { name: /Permanently/ })).toBeNull();
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive Shot/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Shot' }));
    expect(await screen.findByText('Shots list')).toBeTruthy();
    expect(calls.filter((c) => c.method === 'POST' && path(c).endsWith('/archive/')).length).toBe(1);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('assigns a project member as the artist and unassigns with null', async () => {
    const { calls } = mockFetch(server);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Assign Artist' }));
    const select = (await screen.findByLabelText('Artist')) as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: members[0].user_id } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ assigned_artist: members[0].user_id });
  });

  it('unassigns the artist by sending null', async () => {
    detail = { ...flow.shot_detail.body, assigned_artist_id: members[0].user_id, assigned_artist_name: members[0].name };
    const { calls } = mockFetch(server);
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Reassign' }));
    const select = (await screen.findByLabelText('Artist')) as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1));
    fireEvent.change(select, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ assigned_artist: null });
  });

  it('lists only the notes that name this shot, found by searching its code', async () => {
    const { calls } = mockFetch(server);
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Notes' }));
    const own = noteRows.find((n) => n.entity_id === shot.id) as { subject: string };
    const stray = noteRows.find((n) => n.entity_id !== shot.id) as { subject: string };
    expect(await screen.findByText(own.subject)).toBeTruthy();
    expect(screen.queryByText(stray.subject)).toBeNull();
    expect(params(calls.find((c) => path(c).endsWith('/notes/')) as MockCall).search).toBe(shot.code);
  });

  it('adds a note that names the shot', async () => {
    const { calls } = mockFetch(server);
    mount();
    fireEvent.click(await screen.findByRole('tab', { name: 'Notes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }));
    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Match the plate' } });
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c).endsWith('/notes/'))).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ subject: 'Match the plate', entity_type: 'Shot', entity_id: shot.id, entity_code: shot.code, category: 'General' });
  });
});
