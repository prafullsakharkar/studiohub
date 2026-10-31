import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { fetchAllRows } from '@/shared/data/listing';
import { projectsApi } from '@/api/production/structure';
import type { Project } from '@/api/production/structure';
import { shotsApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { ProjectWorkspacePage } from '@/modules/production/pages/ProjectWorkspacePage';
import { freshTotp, live } from './liveBackend';

/**
 * The rebuilt project workspace against a REAL backend. Run on a fresh live_backend.py seed.
 * The manager (a superuser) signs in once and drives the real page.
 */
const T = { timeout: 15000 };
const uid = `${Date.now().toString(36)}`.toUpperCase();

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const routes = (
  <Routes>
    <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
    <Route path="/projects" element={<p>Project list</p>} />
  </Routes>
);

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

beforeAll(async () => {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
}, 60000);

const ids = (rows: Project[]) => rows.map((p) => p.id);

describe('project workspace on the wire', () => {
  it('duplicates the settings (not the shots) and opens the new project', async () => {
    const source = await projectsApi.create({ code: `P${uid}`, name: 'Source project', workflow_type: 'standard', type: 'Feature Film', fps: 25, resolution: '1920x1080 (HD)', aspect_ratio: '1.85:1', color_space: 'Rec.709' });
    await shotsApi.create({ project: source.id, code: `SH${uid}`, name: 'A shot' });

    render(tree(routes, `/projects/${source.id}`));
    expect(await screen.findByRole('heading', { name: source.name }, T)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Duplicate/ }, T));
    fireEvent.change(await screen.findByDisplayValue(`${source.name} (Copy)`), { target: { value: 'Duplicated project' } });
    fireEvent.change(screen.getByDisplayValue(`${source.code}_CLONE`), { target: { value: `D${uid}` } });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate Project' }));

    expect(await screen.findByRole('heading', { name: 'Duplicated project' }, T)).toBeTruthy();
    const copy = (await fetchAllRows(projectsApi.list, { search: `D${uid}` })).find((p) => p.code === `D${uid}`);
    expect(copy).toBeTruthy();
    expect(copy?.id).not.toBe(source.id);
    expect({ type: copy?.type, workflow: copy?.workflow_type, resolution: copy?.resolution, aspect: copy?.aspect_ratio, color: copy?.color_space, fps: Number(copy?.fps) }).toEqual({
      type: source.type,
      workflow: source.workflow_type,
      resolution: source.resolution,
      aspect: source.aspect_ratio,
      color: source.color_space,
      fps: 25,
    });
    expect(copy?.total_shots).toBe(0);
  });

  it('archives after a confirmation: the project leaves the lists, can no longer be opened, and is restored from the archived list', async () => {
    const project = await projectsApi.create({ code: `A${uid}`, name: 'To archive', workflow_type: 'standard' });
    render(tree(routes, `/projects/${project.id}`));
    expect(await screen.findByRole('heading', { name: project.name }, T)).toBeTruthy();

    fireEvent.click(await screen.findByTitle('More Actions', {}, T));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Archive/ }, T));
    expect((await projectsApi.get(project.id)).id).toBe(project.id); // not archived before the confirmation
    fireEvent.click(await screen.findByRole('button', { name: 'Archive Project' }, T));

    expect(await screen.findByText('Project list', {}, T)).toBeTruthy();
    await expect(projectsApi.get(project.id)).rejects.toMatchObject({ status: 404 });
    expect(ids(await fetchAllRows(projectsApi.archived, {}))).toContain(project.id);
    expect(ids(await fetchAllRows(projectsApi.list, {}))).not.toContain(project.id);

    await projectsApi.restore(project.id);
    await waitFor(async () => expect((await projectsApi.get(project.id)).id).toBe(project.id), T);
  });
});
