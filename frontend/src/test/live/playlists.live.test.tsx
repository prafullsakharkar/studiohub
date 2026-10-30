import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { playlistsApi, versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { PlaylistWorkspacePage } from '@/modules/playlists';
import { freshTotp, live } from './liveBackend';

/**
 * Phase 7 against a REAL backend: a playlist is built and shared. An artist makes two versions; a lead creates the
 * playlist, adds a version, a placeholder and the second version from the workspace, reorders them and records the
 * sharing flags; an artist can read it but is offered no controls. Run on a fresh live_backend.py seed.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; versions: { id: string; code: string; version_number: string }[] };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const pages = (
  <Routes>
    <Route path="/playlists/:playlistId" element={<PlaylistWorkspacePage />} />
  </Routes>
);

async function signIn(who: 'artist' | 'lead') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}
const entriesList = () => screen.findByRole('list', { name: 'Playlist entries' }, { timeout: 20000 });

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const project = await projectsApi.create({ code: `L${uid}`, name: 'Playlist flow', workflow_type: 'standard' });
  const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
  await projectScopedApi.addMember(project.id, { email: live.users.lead.email, role: 'Lead' });
  const shot = await shotsApi.create({ project: project.id, code: `PS${uid}`, name: 'Playlist shot' });
  const task = await tasksApi.create({ project: project.id, code: `PT${uid}`, title: 'Comp', entity_type: 'Shot', entity_id: shot.id, assignee: artist.user_id });
  tokenStorage.clearTokens();

  await signIn('artist');
  const versions = [];
  for (const notes of ['first', 'second']) versions.push(await versionsApi.create({ project: project.id, shot: shot.id, task: task.id, department: 'Compositing', notes }));
  Object.assign(fixture, { project: project.id, versions });
  tokenStorage.clearTokens();
}, 180000);

describe('playlist built and shared', () => {
  it('the lead adds versions and a placeholder, reorders them and records the sharing flags; an artist only reads it', async () => {
    await signIn('lead');
    const [v1, v2] = fixture.versions;
    const playlist = await playlistsApi.create({ project: fixture.project, code: `DAILY${uid}`, name: 'Monday dailies' });
    expect(playlist.entries).toEqual([]);

    render(tree(pages, `/playlists/${playlist.id}`));
    await entriesList().catch(() => screen.findByText(/No entries yet/, {}, { timeout: 20000 }));

    const addVersion = async (id: string) => {
      const select = await screen.findByLabelText('Add a version', {}, { timeout: 20000 });
      await waitFor(() => expect([...(select as HTMLSelectElement).options].some((o) => o.value === id)).toBe(true), { timeout: 15000 });
      fireEvent.change(select, { target: { value: id } });
      fireEvent.click(screen.getByRole('button', { name: 'Add version' }));
    };
    await addVersion(v1.id);
    await waitFor(async () => expect((await playlistsApi.get(playlist.id)).entries).toHaveLength(1), { timeout: 15000 });
    fireEvent.click(screen.getByRole('button', { name: 'Add placeholder' }));
    await waitFor(async () => expect((await playlistsApi.get(playlist.id)).entries).toHaveLength(2), { timeout: 15000 });
    await addVersion(v2.id);
    await waitFor(async () => expect((await playlistsApi.get(playlist.id)).entries).toHaveLength(3), { timeout: 15000 });

    // order: v1, placeholder, v2 → move the last one up
    const list = await entriesList();
    await waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Move entry 3 up' }));
    await waitFor(
      async () => {
        const entries = [...(await playlistsApi.get(playlist.id)).entries].sort((a, b) => a.item_order - b.item_order);
        expect(entries.map((e) => e.version_id)).toEqual([v1.id, v2.id, null]);
      },
      { timeout: 15000 }
    );

    // remove the placeholder (now entry 3); wait until the page shows it last, or the click can land on the old order
    await waitFor(async () => expect(within(await entriesList()).getAllByRole('listitem')[2].textContent).toContain('Placeholder'), { timeout: 15000 });
    fireEvent.click(await screen.findByRole('button', { name: 'Remove entry 3' }));
    await waitFor(async () => expect((await playlistsApi.get(playlist.id)).entries.map((e) => e.version_id).sort()).toEqual([v1.id, v2.id].sort()), { timeout: 15000 });

    // share
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText('Mark as shared outside the studio'));
    fireEvent.click(within(dialog).getByLabelText('Mark as passcode-protected'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save sharing' }));
    await waitFor(async () => expect((await playlistsApi.get(playlist.id)).share_settings).toMatchObject({ is_public: true, require_passcode: true, allow_client_approval: false }), { timeout: 15000 });
    await screen.findByText(/Marked shared/, {}, { timeout: 15000 });

    // an artist reads it, with no controls
    cleanup();
    await signIn('artist');
    render(tree(pages, `/playlists/${playlist.id}`));
    await entriesList();
    expect(screen.queryByRole('button', { name: /^(Share|Add version|Add placeholder|Remove entry|Move entry)/ })).toBeNull();
  }, 180000);
});
