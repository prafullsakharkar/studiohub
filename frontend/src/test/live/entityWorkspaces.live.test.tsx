import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/shared/data/listing';
import { projectScopedApi, projectsApi } from '@/api/production/structure';
import { assetsApi, shotsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { AssetWorkspacePage } from '@/modules/assets/pages/AssetWorkspacePage';
import { authService } from '@/modules/auth/services/AuthService';
import { ShotWorkspacePage } from '@/modules/shots/pages/ShotWorkspacePage';
import { freshTotp, live } from './liveBackend';

/**
 * The rebuilt shot and asset workspaces against a REAL backend. Run on a fresh live_backend.py seed.
 * The manager (a superuser) signs in once and drives the real pages.
 */
const T = { timeout: 15000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; artistUser: string; shot: string; shotCode: string; asset: string; assetCode: string; child: string; childCode: string };

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const routes = (
  <Routes>
    <Route path="/shots/:shotId" element={<ShotWorkspacePage />} />
    <Route path="/assets/:assetId" element={<AssetWorkspacePage />} />
    <Route path="/shots" element={<p>Shots list</p>} />
    <Route path="/assets" element={<p>Assets list</p>} />
  </Routes>
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
  const project = await projectsApi.create({ code: `E${uid}`, name: 'Entity workspaces', workflow_type: 'standard' });
  const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
  const shot = await shotsApi.create({ project: project.id, code: `SH${uid}`, name: 'Hero walk' });
  const asset = await assetsApi.create({ project: project.id, code: `CH${uid}`, name: 'Hero', category: 'Character' });
  const child = await assetsApi.create({ project: project.id, code: `HT${uid}`, name: 'Hat', category: 'Prop', parent_asset: asset.id });
  Object.assign(fixture, { project: project.id, artistUser: artist.user_id, shot: shot.id, shotCode: shot.code, asset: asset.id, assetCode: asset.code, child: child.id, childCode: child.code });
}, 60000);

const noteCount = async (type: string, id: string, code: string) =>
  (await fetchAllRows(projectScopedApi.notesPage(fixture.project), { search: code })).filter((n) => n.entity_type === type && n.entity_id === id).length;

describe('shot workspace on the wire', () => {
  it('assigns and unassigns an artist, adds a note, approves from Pending Review, then archives', async () => {
    render(tree(routes, `/shots/${fixture.shot}`));
    expect(await screen.findByRole('heading', { name: 'Hero walk' }, T)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Assign Artist' }));
    const select = (await screen.findByLabelText('Artist')) as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1), T);
    fireEvent.change(select, { target: { value: fixture.artistUser } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await shotsApi.get(fixture.shot)).assigned_artist_id).toBe(fixture.artistUser), T);
    fireEvent.click(await screen.findByRole('button', { name: 'Reassign' }, T));
    const again = (await screen.findByLabelText('Artist')) as HTMLSelectElement;
    await waitFor(() => expect(again.querySelectorAll('option').length).toBeGreaterThan(1), T);
    fireEvent.change(again, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await shotsApi.get(fixture.shot)).assigned_artist_id).toBeNull(), T);

    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }, T));
    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Match the plate' } });
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add note' }));
    await waitFor(async () => expect(await noteCount('Shot', fixture.shot, fixture.shotCode)).toBe(1), T);
    expect(await screen.findByText('Match the plate', {}, T)).toBeTruthy();

    // Approve is offered from Pending Review only.
    await shotsApi.update(fixture.shot, { status: 'In Progress' });
    await shotsApi.update(fixture.shot, { status: 'Pending Review' });
    cleanup();
    render(tree(routes, `/shots/${fixture.shot}`));
    fireEvent.click(await screen.findByTitle('More Actions', {}, T));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Approve Shot/ }, T));
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(async () => expect((await shotsApi.get(fixture.shot)).status).toBe('Approved'), T);

    fireEvent.click(await screen.findByTitle('More Actions', {}, T));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive Shot/ }, T));
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Shot' }));
    expect(await screen.findByText('Shots list', {}, T)).toBeTruthy();
    await expect(shotsApi.get(fixture.shot)).rejects.toMatchObject({ status: 404 });
    expect((await shotsApi.archived({ project: fixture.project })).results.map((s) => s.id)).toContain(fixture.shot);
  });
});

describe('asset workspace on the wire', () => {
  it('shows the child asset, assigns an artist, adds a note, then archives', async () => {
    render(tree(routes, `/assets/${fixture.asset}`));
    expect(await screen.findByRole('heading', { name: 'Hero' }, T)).toBeTruthy();
    expect(await within(await screen.findByRole('region', { name: 'Hierarchy' }, T)).findByRole('link', { name: new RegExp(fixture.childCode) }, T)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Assign Artist' }));
    const select = (await screen.findByLabelText('Artist')) as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll('option').length).toBeGreaterThan(1), T);
    fireEvent.change(select, { target: { value: fixture.artistUser } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(async () => expect((await assetsApi.get(fixture.asset)).assigned_artist_id).toBe(fixture.artistUser), T);

    fireEvent.click(screen.getByRole('tab', { name: 'Notes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add note' }, T));
    fireEvent.change(await screen.findByLabelText('Subject'), { target: { value: 'Fix the rig' } });
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Add note' }));
    await waitFor(async () => expect(await noteCount('Asset', fixture.asset, fixture.assetCode)).toBe(1), T);

    fireEvent.click(await screen.findByTitle('More Actions', {}, T));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive Asset/ }, T));
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Asset' }));
    expect(await screen.findByText('Assets list', {}, T)).toBeTruthy();
    await expect(assetsApi.get(fixture.asset)).rejects.toMatchObject({ status: 404 });
  });
});
