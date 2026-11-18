import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { reviewMediaApi, versionsApi } from '@/api/production/review';
import { projectScopedApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { shotsApi, tasksApi } from '@/api/production/work';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { projectsFormConfig } from '@/modules/production/structure/configs';
import { VersionWorkspacePage } from '@/modules/versions';
import { freshTotp, live } from './liveBackend';

/**
 * Review-pipeline RP-18 (WP 18.7) against a REAL backend started with SYNC_LIVE_MEDIA=1: the harness mounts a temporary
 * studio root (code LIVE) holding eight EXR frames and a movie under `shots/live/comp/v001/`. The manager sets the project's
 * review folder on the project's edit page (C-RP-47); the version page makes the copy of a version still in review from
 * the frames, named relative to that folder (C-RP-48); once the folder moves the copy stays shown but can no longer be
 * remade (C-RP-49). Nothing is registered or published. Skipped without SYNC_LIVE_MEDIA.
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();
const fixture = {} as { project: string; version: string };
const studio = live.media?.studio;
const PATTERN = 'comp/v001/live_comp.%04d.exr';

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

async function openMedia(versionId: string) {
  render(tree(<Routes><Route path="/versions/:versionId" element={<VersionWorkspacePage />} /></Routes>, `/versions/${versionId}`));
  fireEvent.click(await screen.findByRole('tab', { name: 'Media' }, { timeout: 20000 }));
  return screen.findByRole('region', { name: 'Review movie' }, { timeout: 20000 });
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe.skipIf(!studio)('review copies before approval against a live backend (SYNC_LIVE_MEDIA=1)', () => {
  beforeAll(async () => {
    const outcome = await authService.login(live.users.manager);
    if (outcome.status !== 'mfa_required') throw new Error('expected an MFA challenge for the manager');
    await authService.completeMfaLogin({ challenge: outcome.challenge, code: await freshTotp(live.manager.secret) });
    const project = await projectsApi.create({ code: `F${uid}`, name: 'Live review folder', workflow_type: 'standard' });
    const artist = await projectScopedApi.addMember(project.id, { email: live.users.artist.email, role: 'Artist' });
    const sequence = await sequencesApi.create({ project: project.id, code: `${project.code}_SQ`, name: 'Sequence' });
    const shot = await shotsApi.create({ project: project.id, code: `${project.code}_SH`, sequence_id: sequence.id, name: 'Folder shot' });
    const task = await tasksApi.create({ project: project.id, code: `${project.code}_T`, title: 'Comp', entity_type: 'Shot', entity_id: shot.id, assignee: artist.user_id });
    const version = await versionsApi.create({ project: project.id, shot: shot.id, task: task.id, department: 'Compositing', artist: artist.user_id });
    Object.assign(fixture, { project: project.id, version: version.id });
  }, 120000);

  it('the manager sets the review folder on the project’s edit page', async () => {
    render(
      tree(
        <Routes>
          <Route path="/projects/:id/edit" element={<DirectoryFormPage config={projectsFormConfig} />} />
          <Route path="/projects/:id" element={<div>opened</div>} />
        </Routes>,
        `/projects/${fixture.project}/edit`,
      ),
    );
    const root = (await screen.findByLabelText(/^Review folder: storage root/, {}, { timeout: 20000 })) as HTMLInputElement;
    // the form fills itself once from the record: type only after that, or the fill would undo it
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe('Live review folder'), { timeout: 20000 });
    fireEvent.change(root, { target: { value: (studio?.root ?? '').toLowerCase() } });
    fireEvent.change(screen.getByLabelText(/^Review folder: folder on the root/), { target: { value: '/shots/live/' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await screen.findByText('opened', {}, { timeout: 20000 });
    expect(await projectsApi.get(fixture.project)).toMatchObject({ review_source_root: studio?.root, review_source_folder: 'shots/live' });
  }, 60000);

  it('the version page makes the copy of a version still in review from the frames, read where they lie', async () => {
    const panel = await openMedia(fixture.version);
    fireEvent.click(await within(panel).findByRole('button', { name: 'From studio storage' }, { timeout: 20000 }));
    const form = await within(panel).findByRole('region', { name: 'Render on studio storage' });
    expect((await within(form).findByTestId('review-folder', {}, { timeout: 20000 })).textContent).toBe(`${studio?.root}:shots/live/`);
    fireEvent.change(within(form).getByLabelText('Path'), { target: { value: PATTERN } });
    fireEvent.change(within(form).getByLabelText('First frame'), { target: { value: '1001' } });
    fireEvent.change(within(form).getByLabelText('Last frame'), { target: { value: '1008' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Make the copy' }));
    await waitFor(
      async () => expect((await reviewMediaApi.list(fixture.version))[0]).toMatchObject({ status: 'ready', source: 'storage_path' }),
      { timeout: 90000, interval: 1000 },
    );
    const [copy] = await reviewMediaApi.list(fixture.version);
    expect(copy).toMatchObject({ kind: 'sequence', storage_readable: true, published_file_id: null, frames_until: null, source_name: 'live_comp.%04d.exr [1001-1008]' });
    expect(copy.probe).toMatchObject({ first_frame: 1001, last_frame: 1008 });
    const version = await versionsApi.get(fixture.version);
    expect(version.is_published).toBe(false);
    cleanup();
    const again = await openMedia(fixture.version);
    await within(again).findByText(/read from studio storage\./, {}, { timeout: 20000 });
    // the controls follow the signed-in user, who arrives after the version
    expect(await within(again).findByRole('button', { name: 'Remake' }, { timeout: 20000 })).toBeTruthy();
  }, 180000);

  it('a path that leaves the folder is refused with the server’s sentence, naming no directory', async () => {
    await expect(reviewMediaApi.fromStorage(fixture.version, { path: '../../etc/passwd.mov' })).rejects.toMatchObject({ status: 400 });
  }, 30000);

  it('once the folder moves the copy stays, but can no longer be remade', async () => {
    await projectsApi.update(fixture.project, { review_source_folder: 'shots/elsewhere' });
    const [shown] = await reviewMediaApi.list(fixture.version);
    expect(shown).toMatchObject({ status: 'ready', storage_readable: false });
    await expect(reviewMediaApi.remake(shown.id)).rejects.toMatchObject({ status: 400 });
    const panel = await openMedia(fixture.version);
    await within(panel).findByText(/Its render is no longer in the project's review folder/, {}, { timeout: 20000 });
    await within(panel).findByRole('button', { name: 'From studio storage' }, { timeout: 20000 }); // the user has arrived
    expect(within(panel).queryByRole('button', { name: 'Remake' })).toBeNull();
  }, 60000);
});
