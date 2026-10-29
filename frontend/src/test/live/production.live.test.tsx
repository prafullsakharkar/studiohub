import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { episodesApi, projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { EntityHistory } from '@/components/history/EntityHistory';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { ProjectWorkspacePage } from '@/modules/production/pages/ProjectWorkspacePage';
import { projectsFormConfig, projectsListConfig, sequencesConfig } from '@/modules/production/structure/configs';
import { MembersPanel, NotesPanel, OverviewPanel } from '@/modules/production/structure/panels';
import { freshTotp, live } from './liveBackend';

/** Phase 5 against a REAL backend. Run on a fresh live_backend.py seed. */
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
});

const tree = (ui: React.ReactElement, initial = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function signInManager() {
  const outcome = await authService.login(live.users.manager);
  if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
  await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
}
const uid = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();

describe('projects, end to end', () => {
  it('creates an episodic project through the real form, archives it with DELETE and restores it from the Archived view', async () => {
    await signInManager();
    const code = `P${uid()}`;
    render(
      tree(
        <Routes>
          <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />
          <Route path="/projects/:id" element={<div>project saved</div>} />
        </Routes>,
        '/projects/new'
      )
    );
    fireEvent.change(await screen.findByLabelText(/^Name/, {}, { timeout: 15000 }), { target: { value: `Live ${code}` } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: code } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'Episodic Series' } });
    fireEvent.change(screen.getByLabelText('Workflow'), { target: { value: 'episodic' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await screen.findByText('project saved', {}, { timeout: 15000 });

    const created = (await projectsApi.list({ code })).results[0];
    expect(created.workflow_type).toBe('episodic');
    expect((await episodesApi.list({ project: created.id })).results.map((e) => e.code)).toEqual(['EP101']); // bootstrapped
    cleanup();

    render(tree(<Routes><Route path="/projects" element={<DirectoryListPage config={projectsListConfig} />} /></Routes>, '/projects'));
    fireEvent.change(await screen.findByLabelText('Search projects', {}, { timeout: 15000 }), { target: { value: code } });
    fireEvent.click(await screen.findByRole('button', { name: `Archive Live ${code}` }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Archive' }));
    await waitFor(async () => expect((await projectsApi.archived({ search: code })).results.length).toBe(1), { timeout: 15000 });
    await expect(projectsApi.get(created.id)).rejects.toMatchObject({ status: 404 }); // archived: gone from detail

    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'archived' } });
    fireEvent.click(await screen.findByRole('button', { name: `Restore Live ${code}` }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }));
    await waitFor(async () => expect((await projectsApi.get(created.id)).code).toBe(code), { timeout: 15000 });
  }, 90000);

  it('CR-13 on the wire: POST archive/ now archives like DELETE; the existence checks are still refused (not implemented)', async () => {
    await signInManager();
    const project = await projectsApi.create({ code: `C${uid()}`, name: 'CR13' });
    await projectsApi.act(project.id, 'archive');
    await expect(projectsApi.get(project.id)).rejects.toMatchObject({ status: 404 });
    expect((await projectsApi.archived({ search: project.code })).results.map((p) => p.id)).toEqual([project.id]);
    await expect(apiClient.post('/api/v1/projects/check-existence/', { codes: [project.code] })).rejects.toMatchObject({ status: 403 });
  }, 30000);
});

describe('members, structure and notes, end to end', () => {
  it('adds a member by e-mail, who then sees the project while a stranger is refused; unknown e-mails say "User not found."', async () => {
    await signInManager();
    const project = await projectsApi.create({ code: `M${uid()}`, name: 'Members', workflow_type: 'standard' });

    render(tree(<MembersPanel projectId={project.id} />));
    fireEvent.change(await screen.findByLabelText('Add a member by email', {}, { timeout: 15000 }), { target: { value: 'nobody-here@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    expect(await screen.findByText('User not found.', {}, { timeout: 15000 })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Add a member by email'), { target: { value: live.users.artist.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));
    await waitFor(async () => expect((await projectScopedApi.members(project.id)).results.map((m) => m.email)).toContain(live.users.artist.email), { timeout: 15000 });
    cleanup();
    tokenStorage.clearTokens();

    await authService.login(live.users.artist);
    expect((await projectsApi.list({})).results.map((p) => p.id)).toContain(project.id);
    await expect(projectsApi.update(project.id, { description: 'nope' })).rejects.toMatchObject({ status: 403 });
    tokenStorage.clearTokens();

    await authService.login(live.users.mfa).catch(() => undefined); // an MFA user stops at the challenge: no tokens, so the next call is refused
    await expect(projectScopedApi.summary(project.id)).rejects.toMatchObject({ status: 401 });
  }, 90000);

  it('sequences on an episodic project: the server says an episode is required; picking the project’s episode saves; archive and restore work', async () => {
    await signInManager();
    const project = await projectsApi.create({ code: `S${uid()}`, name: 'Sequences', type: 'Episodic Series', workflow_type: 'episodic' });
    const episode = (await episodesApi.list({ project: project.id })).results[0];

    render(tree(<RelatedRecords config={sequencesConfig} parentId={project.id} />));
    fireEvent.click(await screen.findByRole('button', { name: 'Add sequence' }, { timeout: 15000 }));
    let dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/^Code/), { target: { value: 'SQ010' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add sequence' }));
    expect(await within(dialog).findByText(/An episode is required for sequences on episodic projects/, {}, { timeout: 15000 })).toBeTruthy();

    await within(dialog).findByRole('option', { name: new RegExp(episode.code) }, { timeout: 15000 });
    fireEvent.change(within(dialog).getByLabelText(/^Episode/), { target: { value: episode.id } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add sequence' }));
    await waitFor(async () => expect((await sequencesApi.list({ project: project.id })).results.map((s) => s.code)).toEqual(['SQ010']), { timeout: 15000 });

    fireEvent.click(await screen.findByRole('button', { name: /^Archive SQ010/ }, { timeout: 15000 }));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(async () => expect((await sequencesApi.list({ project: project.id })).results).toHaveLength(0), { timeout: 15000 });
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'archived' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Restore SQ010/ }, { timeout: 15000 }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Restore' }));
    await waitFor(async () => expect((await sequencesApi.list({ project: project.id })).results).toHaveLength(1), { timeout: 15000 });
  }, 90000);

  it('notes, overview counts and the project History', async () => {
    await signInManager();
    const project = await projectsApi.create({ code: `N${uid()}`, name: 'Notes' });
    await projectsApi.update(project.id, { description: 'edited' });

    render(tree(<NotesPanel projectId={project.id} />));
    fireEvent.change(await screen.findByLabelText('Subject', {}, { timeout: 15000 }), { target: { value: 'Plates arrived' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Plates arrived', {}, { timeout: 15000 })).toBeTruthy();
    cleanup();

    render(tree(<OverviewPanel projectId={project.id} />));
    const counts = await screen.findByLabelText('Project counts', {}, { timeout: 15000 });
    expect(within(counts).getByText('notes').nextSibling?.textContent).toBe('1');
    cleanup();

    render(tree(<EntityHistory targetType="Project" targetId={project.id} />));
    expect(await screen.findByText(/changed description/, {}, { timeout: 15000 })).toBeTruthy();
  }, 90000);

  it('the project workspace opens for a real project and shows its tabs', async () => {
    await signInManager();
    const project = await projectsApi.create({ code: `W${uid()}`, name: 'Workspace' });
    render(
      tree(
        <Routes>
          <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
        </Routes>,
        `/projects/${project.id}?tab=members`
      )
    );
    expect((await screen.findAllByText('Workspace', {}, { timeout: 20000 })).length).toBeGreaterThan(0);
    expect(await screen.findByLabelText('Add a member by email', {}, { timeout: 15000 })).toBeTruthy();
  }, 60000);
});
