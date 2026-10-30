import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deliveriesApi } from '@/api/deliveries/deliveries';
import { publishApi, publishedFilesApi } from '@/api/publishing/publishing';
import { AuthProvider } from '@/core/auth/AuthProvider';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { BulkRegisterPage, PublishedFilePage, PublishWorkspacePage } from '@/modules/publishing';
import { live } from './liveBackend';

/**
 * Phase 9 against a REAL backend, with the roles the studio seeds. A producer drives an export job to Exported and
 * republishes it, and takes another through a failure, a retry and a cancellation; files are deprecated, restored,
 * registered in bulk and revoked (by a supervisor, who holds that code); and revoking a file that a signed-off delivery
 * holds sends the delivery back to Ready. An artist only reads. Run on a fresh live_backend.py seed (the project, its
 * published versions and their files are made there).
 */
const uid = `${Date.now().toString(36)}`.toUpperCase();

const tree = (ui: React.ReactElement, initial: string) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);
const pages = (
  <Routes>
    <Route path="/publishing/files/bulk" element={<BulkRegisterPage />} />
    <Route path="/publishing/files/:fileId" element={<PublishedFilePage />} />
    <Route path="/publishing/:publishId" element={<PublishWorkspacePage />} />
  </Routes>
);

async function signIn(who: 'supervisor' | 'producer' | 'artist') {
  tokenStorage.clearTokens();
  const outcome = await authService.login(live.users[who]);
  if (outcome.status === 'mfa_required') throw new Error(`${who} unexpectedly needs MFA`);
}
const bar = (name: string) => screen.findByRole('toolbar', { name }, { timeout: 20000 });
const barNow = (name: string) => (screen.queryByRole('toolbar', { name }) ? within(screen.getByRole('toolbar', { name })).getAllByRole('button').map((b) => b.textContent) : []);
const act = async (toolbar: string, name: string, fill?: (dialog: ReturnType<typeof within>) => void) => {
  fireEvent.click(within(await bar(toolbar)).getByRole('button', { name }));
  const dialog = within(await screen.findByRole('dialog'));
  fill?.(dialog);
  fireEvent.click(dialog.getByRole('button', { name }));
  return dialog;
};
const heading = (text: string | RegExp) => screen.findByRole('heading', { name: text }, { timeout: 20000 });
const jobStatus = async (id: string) => (await publishApi.get(id)).job_status;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
afterAll(() => tokenStorage.clearTokens());

describe('an export job', () => {
  it('runs to Exported from the page and is republished; a failed one is retried and then cancelled', async () => {
    const { project, versions } = live.dlv;
    await signIn('producer');
    const job = await publishApi.create({ name: `Comp export ${uid}`, project_id: project, version_id: versions[0].id, dcc_tool: 'Nuke', dcc_version: '15.0' });
    expect(await jobStatus(job.id)).toBe('Pending');

    render(tree(pages, `/publishing/${job.id}`));
    await heading(new RegExp(job.code));
    await waitFor(() => expect(barNow('Job actions')).toEqual(['Validate', 'Cancel job', 'Republish']), { timeout: 15000 });

    // validate: with no rules configured nothing is checked, and the page says so
    await act('Job actions', 'Validate');
    expect(await screen.findByText(/No validation rules are configured, so nothing was checked/, {}, { timeout: 20000 })).toBeTruthy();
    expect(await jobStatus(job.id)).toBe('Validated');
    await waitFor(() => expect(barNow('Job actions')).toEqual(['Validate', 'Start export', 'Cancel job', 'Republish']), { timeout: 15000 });

    await act('Job actions', 'Start export');
    await waitFor(() => expect(barNow('Job actions')).toEqual(['Complete export', 'Mark failed', 'Republish']), { timeout: 15000 });
    await act('Job actions', 'Complete export');
    await waitFor(async () => expect(await jobStatus(job.id)).toBe('Exported'), { timeout: 15000 });
    await waitFor(() => expect(barNow('Job actions')).toEqual(['Republish']), { timeout: 15000 });
    expect((await publishApi.get(job.id)).status).toBe('Published'); // the legacy word; the page shows the real one
    expect(screen.getByText('Exported')).toBeTruthy();

    // republish: a new Pending job; this one is untouched
    await act('Job actions', 'Republish', (dialog) => fireEvent.change(dialog.getByLabelText('Comment'), { target: { value: 'again please' } }));
    await waitFor(async () => {
      const list = await publishApi.list({ search: `Comp export ${uid}` });
      expect(list.results.filter((r) => r.job_status === 'Pending')).toHaveLength(1);
    }, { timeout: 20000 });
    expect(await jobStatus(job.id)).toBe('Exported');
    cleanup();

    // a failure needs a reason; Retry puts it back to Pending; Cancel job is final
    const second = await publishApi.create({ name: `Failing export ${uid}`, project_id: project, version_id: versions[1].id, dcc_tool: 'Maya' });
    await publishApi.validate(second.id);
    await publishApi.startExport(second.id);
    render(tree(pages, `/publishing/${second.id}`));
    await heading(new RegExp(second.code));
    fireEvent.click(within(await bar('Job actions')).getByRole('button', { name: 'Mark failed' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Mark failed' }));
    expect(await dialog.findByText('Reason is required.')).toBeTruthy();
    expect(await jobStatus(second.id)).toBe('Exporting');
    fireEvent.change(dialog.getByLabelText(/^Reason/), { target: { value: 'Render node went away' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Mark failed' }));
    await waitFor(async () => expect(await jobStatus(second.id)).toBe('Failed'), { timeout: 15000 });
    expect(await screen.findByText(/The export failed: Render node went away/, {}, { timeout: 15000 })).toBeTruthy();
    await act('Job actions', 'Retry');
    await waitFor(async () => expect(await jobStatus(second.id)).toBe('Pending'), { timeout: 15000 });
    await waitFor(() => expect(barNow('Job actions')).toEqual(['Validate', 'Cancel job', 'Republish']), { timeout: 15000 });
    await act('Job actions', 'Cancel job', (d) => fireEvent.change(d.getByLabelText('Reason'), { target: { value: 'Not needed' } }));
    await waitFor(async () => expect(await jobStatus(second.id)).toBe('Cancelled'), { timeout: 15000 });
    await waitFor(() => expect(barNow('Job actions')).toEqual(['Republish']), { timeout: 15000 });
  }, 240000);
});

describe('published files', () => {
  it('a file is deprecated and restored by the producer, revoked by a supervisor with a reason only they can read, and registered in bulk', async () => {
    const { versions } = live.dlv;
    await signIn('producer');
    const file = await publishedFilesApi.create({ version_id: versions[1].id, storage_root: 'PROJECTS', relative_path: `live/${uid}/plate.exr`, size_bytes: 4096, sha256: 'c'.repeat(64) });
    expect(file.status).toBe('Registered');
    // an identical retry is the same file; different content under that path is refused for good
    expect((await publishedFilesApi.create({ version_id: versions[1].id, storage_root: 'PROJECTS', relative_path: `live/${uid}/plate.exr`, size_bytes: 4096, sha256: 'c'.repeat(64) })).id).toBe(file.id);
    await expect(publishedFilesApi.create({ version_id: versions[1].id, storage_root: 'PROJECTS', relative_path: `live/${uid}/plate.exr`, size_bytes: 4096, sha256: 'd'.repeat(64) })).rejects.toBeTruthy();

    render(tree(pages, `/publishing/files/${file.id}`));
    await heading(new RegExp(`live/${uid}/plate.exr`.replace(/[.]/g, '\\.')));
    await waitFor(() => expect(barNow('File actions')).toEqual(['Deprecate', 'Revoke']), { timeout: 15000 });
    await act('File actions', 'Deprecate', (d) => fireEvent.change(d.getByLabelText('Note'), { target: { value: 'Superseded' } }));
    await waitFor(() => expect(barNow('File actions')).toEqual(['Restore', 'Revoke']), { timeout: 15000 });
    expect((await publishedFilesApi.get(file.id)).status).toBe('Deprecated');
    await act('File actions', 'Restore');
    await waitFor(() => expect(barNow('File actions')).toEqual(['Deprecate', 'Revoke']), { timeout: 15000 });
    cleanup();

    // a supervisor revokes it: the reason is required, and from then on the file is final
    await signIn('supervisor');
    render(tree(pages, `/publishing/files/${file.id}`));
    await heading(new RegExp(`live/${uid}/plate.exr`.replace(/[.]/g, '\\.')));
    fireEvent.click(within(await bar('File actions')).getByRole('button', { name: 'Revoke' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }));
    expect(await dialog.findByText('Reason is required.')).toBeTruthy();
    fireEvent.change(dialog.getByLabelText(/^Reason/), { target: { value: 'Wrong plate' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }));
    await waitFor(async () => expect((await publishedFilesApi.get(file.id)).status).toBe('Revoked'), { timeout: 15000 });
    expect(await screen.findByText(/This file was revoked: Wrong plate/, {}, { timeout: 15000 })).toBeTruthy();
    await waitFor(() => expect(barNow('File actions')).toEqual([]), { timeout: 15000 });
    cleanup();

    // the artist reads the file and not the reason
    await signIn('artist');
    expect((await publishedFilesApi.get(file.id)).revoke_reason).toBe('');
    render(tree(pages, `/publishing/files/${file.id}`));
    expect(await screen.findByText(/This file was revoked\./, {}, { timeout: 20000 })).toBeTruthy();
    expect(barNow('File actions')).toEqual([]);
    cleanup();

    // register many: each file succeeds or fails on its own
    await signIn('producer');
    render(tree(pages, '/publishing/files/bulk'));
    const items = [
      { version_id: versions[3].id, storage_root: 'PROJECTS', relative_path: `live/${uid}/bulk-a.exr`, size_bytes: 1, sha256: 'e'.repeat(64) },
      { version_id: versions[3].id, storage_root: 'PROJECTS', relative_path: `../live/${uid}/bulk-b.exr`, size_bytes: 1, sha256: 'f'.repeat(64) },
    ];
    fireEvent.change(await screen.findByLabelText('Files (JSON)'), { target: { value: JSON.stringify(items) } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    const result = await screen.findByRole('region', { name: 'Result' }, { timeout: 20000 });
    expect(within(result).getByText(/1 registered, 1 refused/)).toBeTruthy();
    expect(within(result).getByText(/relative_path: A path cannot contain/)).toBeTruthy();
    const registered = await publishedFilesApi.list({ version_id: versions[3].id, role: 'main' });
    expect(registered.results.some((f) => f.relative_path === `live/${uid}/bulk-a.exr`)).toBe(true);
  }, 240000);

  it('revoking a file that a signed-off delivery holds sends the delivery back to Ready', async () => {
    const { project, versions } = live.dlv;
    await signIn('supervisor');
    const delivery = await deliveriesApi.create({ name: `Revocation ${uid}`, project_id: project });
    await deliveriesApi.addVersion(delivery.id, versions[2].id);
    await deliveriesApi.prepare(delivery.id);
    tokenStorage.clearTokens();
    await signIn('producer');
    await deliveriesApi.signOff(delivery.id);
    expect((await deliveriesApi.get(delivery.id)).status).toBe('Signed Off');

    tokenStorage.clearTokens();
    await signIn('supervisor');
    const files = await publishedFilesApi.list({ version_id: versions[2].id, status: 'Registered' });
    expect(files.results.length).toBeGreaterThan(0);
    for (const f of files.results) await publishedFilesApi.revoke(f.id, 'Content withdrawn');

    // the delivery cannot be sent with revoked content: it is back at Ready, by the system, with a reason
    await waitFor(async () => expect((await deliveriesApi.get(delivery.id)).status).toBe('Ready'), { timeout: 20000 });
    const history = await deliveriesApi.history(delivery.id);
    const last = history[history.length - 1];
    expect(last).toMatchObject({ to_status: 'Prepared', actor: null, override_kind: 'system' });
    expect(last.reason).toMatch(/revoked/);
  }, 240000);
});
