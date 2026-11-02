import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { ProjectPublishingTab } from '@/modules/production/components/project-tabs/ProjectPublishingTab';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import type { Project } from '@/api/production/structure';
import { BulkRegisterPage, PublishedFilePage } from '../FilePages';
import { filesFormConfig, useFilesListConfig } from '../files';
import { publishFormConfig, usePublishListConfig } from '../jobs';
import { PublishWorkspace } from '../PublishWorkspace';
import { rootsFormConfig } from '../registry';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('publishing/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
/** The seeded production-admin: everything but the storage roots. A supervisor also revokes; an artist only reads. */
const producer = withCodes('publishing.create', 'publishing.update', 'publishing.delete', 'publishing.deprecate', 'publishing.revoke');
const deprecator = withCodes('publishing.deprecate');

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const writes = (calls: MockCall[]) => calls.filter((c) => c.method !== 'GET');
const emptyPage = { status: 200, body: { count: 0, next: null, previous: null, results: [] } };

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
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

describe('export job workspace', () => {
  const route = <Route path="/publishing/:publishId" element={<PublishWorkspace />} />;
  const open = (user: User, job: any, extra?: (c: MockCall) => MockReply | undefined) => {
    const mocked = mockFetch((c) => extra?.(c) ?? { status: 200, body: job });
    renderAt(`/publishing/${job.id}`, user, route);
    return mocked;
  };
  const toolbar = () => screen.queryByRole('toolbar', { name: 'Job actions' });
  const actions = () => (toolbar() ? within(toolbar()!).getAllByRole('button').map((b) => b.textContent) : []);
  const ready = (code: string) => screen.findByRole('heading', { name: new RegExp(code) });

  it('offers exactly the actions the job’s real status allows', async () => {
    const cases: Array<[any, string[]]> = [
      [flow.jobs_detail_pending.body, ['Validate', 'Cancel job', 'Republish']],
      [flow.jobs_detail_validated.body, ['Validate', 'Start export', 'Cancel job', 'Republish']],
      [flow.jobs_start_export.body, ['Complete export', 'Mark failed', 'Republish']],
      [flow.jobs2_detail_failed.body, ['Retry', 'Cancel job', 'Republish']],
      [flow.jobs_detail_exported.body, ['Republish']],
      [flow.jobs2_detail_unpublished.body, ['Republish']],
    ];
    for (const [job, expected] of cases) {
      open(producer, job);
      await ready(job.code);
      expect(actions()).toEqual(expected);
      cleanup();
    }
  });

  it('shows the real status, not the legacy word that calls a validated job “Published”', async () => {
    const job = flow.jobs_detail_validated.body;
    open(producer, job);
    await ready(job.code);
    expect(screen.getByText('Validated')).toBeTruthy();
    expect(screen.queryByText('Published')).toBeNull();
  });

  it('an artist reads the job and is offered nothing', async () => {
    const job = flow.jobs_detail_pending.body;
    open(artist, job);
    await ready(job.code);
    expect(actions()).toEqual([]);
    expect(screen.queryByRole('link', { name: 'Edit details' })).toBeNull();
  });

  it('the Files tab lists the registered files of the job’s version, or says there is none (CR-22)', async () => {
    const job = flow.jobs4_detail.body;
    expect(job.version_id).toBeTruthy();
    const { calls } = open(producer, job, (c) => (path(c) === '/api/v1/publishing/files/' ? emptyPage : undefined));
    await ready(job.code);
    fireEvent.click(screen.getByRole('tab', { name: 'Files' }));
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/publishing/files/' && new URL(c.url).searchParams.get('version_id') === job.version_id)).toBe(true));
    expect(screen.queryByLabelText('Filter by project')).toBeNull();
    cleanup();

    open(producer, { ...job, version_id: null });
    await ready(job.code);
    fireEvent.click(screen.getByRole('tab', { name: 'Files' }));
    expect(await screen.findByText(/made without a version/)).toBeTruthy();
  });

  it('only a job that has not run, or that failed, can be edited', async () => {
    open(producer, flow.jobs_detail_pending.body);
    await ready(flow.jobs_detail_pending.body.code);
    expect(screen.getByRole('link', { name: 'Edit details' })).toBeTruthy();
    cleanup();
    open(producer, flow.jobs_detail_exported.body);
    await ready(flow.jobs_detail_exported.body.code);
    expect(screen.queryByRole('link', { name: 'Edit details' })).toBeNull();
  });

  it('a failure needs a reason before anything is sent, then posts it', async () => {
    const job = flow.jobs_start_export.body;
    const { calls } = open(producer, job, (c) => (c.method === 'POST' ? reply(flow.jobs2_fail) : undefined));
    await ready(job.code);
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Mark failed' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Mark failed' }));
    expect(await dialog.findByText('Reason is required.')).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(dialog.getByLabelText(/^Reason/), { target: { value: 'Render node went away' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Mark failed' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/publishing/${job.id}/fail/`);
    expect(writes(calls)[0].body).toEqual({ reason: 'Render node went away' });
  });

  it('validating opens the Validation tab, and says plainly when no rules were configured', async () => {
    const job = flow.jobs_detail_pending.body;
    open(producer, job, (c) => (c.method === 'POST' ? reply(flow.jobs_validate) : path(c) === `/api/v1/publishing/${job.id}/` ? { status: 200, body: flow.jobs_detail_validated.body } : undefined));
    await ready(job.code);
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Validate' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Validate' }));
    const result = await screen.findByRole('region', { name: 'Validation result' });
    expect(within(result).getByText(/No validation rules are configured, so nothing was checked/)).toBeTruthy();
  });

  it('a move the status no longer allows says from where to where', async () => {
    const job = flow.jobs_detail_validated.body;
    open(producer, job, (c) => (c.method === 'POST' ? reply(flow.jobs_start_export_again) : undefined));
    await ready(job.code);
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Start export' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start export' }));
    expect(await screen.findByText(/That cannot be done from Exporting to/)).toBeTruthy();
  });

  it('a failed job shows why it failed', async () => {
    const job = flow.jobs2_detail_failed.body;
    open(producer, job);
    await ready(job.code);
    expect(await screen.findByText(/The export failed: Render node went away/)).toBeTruthy();
  });

  it('republishing posts the comment and the job is not changed', async () => {
    const job = flow.jobs_detail_exported.body;
    const { calls } = open(producer, job, (c) => (c.method === 'POST' ? reply(flow.jobs_republish) : undefined));
    await ready(job.code);
    fireEvent.click(within(toolbar()!).getByRole('button', { name: 'Republish' }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Comment'), { target: { value: 'again please' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Republish' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/publishing/${job.id}/republish/`);
    expect(writes(calls)[0].body).toEqual({ comment: 'again please' });
  });
});

describe('export job list and form', () => {
  const List = () => <DirectoryListPage config={usePublishListConfig()} />;
  const rows = flow.jobs_list.body.results as any[];

  it('lists the jobs by their real status; Delete only for a job that never ran or was cancelled', async () => {
    const template = rows[0];
    const list = [
      { ...template, id: 'j-pending', code: 'PUB-X-1', job_status: 'Pending', status: 'Queued' },
      { ...template, id: 'j-exported', code: 'PUB-X-2', job_status: 'Exported', status: 'Published' },
      { ...template, id: 'j-cancelled', code: 'PUB-X-3', job_status: 'Cancelled', status: 'Unpublished' },
    ];
    mockFetch(() => ({ status: 200, body: { count: 3, next: null, previous: null, results: list } }));
    renderAt('/publishing', producer, <Route path="/publishing" element={<List />} />);
    await screen.findByRole('link', { name: /^PUB-X-1/ });
    expect(screen.getByRole('button', { name: /^Delete PUB-X-1/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Delete PUB-X-3/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Delete PUB-X-2/ })).toBeNull();
  });

  it('choosing a status or a tool asks the server (CR-22); a project’s list has no project filter, column or link of its own', async () => {
    const { calls } = mockFetch(() => emptyPage);
    renderAt('/publishing', producer, <Route path="/publishing" element={<List />} />);
    fireEvent.change(await screen.findByLabelText('Filter by status'), { target: { value: 'Failed' } });
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/publishing/' && new URL(c.url).searchParams.get('job_status') === 'Failed')).toBe(true));
    fireEvent.change(screen.getByLabelText('Filter by tool'), { target: { value: 'Nuke' } });
    await waitFor(() => expect(calls.some((c) => new URL(c.url).searchParams.get('dcc_tool') === 'Nuke')).toBe(true));
    expect(screen.getByLabelText('Filter by project')).toBeTruthy();
    cleanup();

    const Scoped = () => <DirectoryListPage config={usePublishListConfig({ projectId: 'p-9' })} />;
    const scoped = mockFetch(() => emptyPage);
    renderAt('/x', producer, <Route path="/x" element={<Scoped />} />);
    await screen.findByLabelText('Filter by status');
    expect(screen.queryByLabelText('Filter by project')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Project' })).toBeNull();
    await waitFor(() => expect(scoped.calls.some((c) => path(c) === '/api/v1/publishing/' && new URL(c.url).searchParams.get('project_id') === 'p-9')).toBe(true));
  });

  it('a new job names a project and a tool; the version is optional; without one the shot or asset is asked for', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: flow.jobs_create.body } : { status: 200, body: { count: 1, next: null, previous: null, results: [{ id: 'p-1', code: 'PUB', name: 'Publishing' }] } }));
    renderAt('/publishing/new', producer, <Route path="/publishing/new" element={<DirectoryFormPage config={publishFormConfig} />} />);
    await screen.findByRole('option', { name: /PUB/ });
    fireEvent.change(await screen.findByLabelText(/^Project/), { target: { value: 'p-1' } });
    expect(screen.getByLabelText('Shot or asset code')).toBeTruthy(); // no version chosen
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Comp export' } });
    fireEvent.change(screen.getByLabelText(/^DCC tool/), { target: { value: 'Nuke' } });
    fireEvent.change(screen.getByLabelText('Shot or asset code'), { target: { value: 'SH0010' } });
    fireEvent.click(screen.getByRole('button', { name: /create export job/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].body).toMatchObject({ project_id: 'p-1', name: 'Comp export', dcc_tool: 'Nuke', entity_code: 'SH0010' });
    expect(writes(calls)[0].body).not.toHaveProperty('version_id');
  });

  it('editing never offers the project, version or code, and sends only what changed', async () => {
    const job = flow.jobs_detail_pending.body;
    const { calls } = mockFetch((c) => ({ status: 200, body: c.method === 'PATCH' ? job : job }));
    renderAt(`/publishing/${job.id}/edit`, producer, <Route path="/publishing/:id/edit" element={<DirectoryFormPage config={publishFormConfig} />} />);
    const name = await screen.findByLabelText(/^Name/);
    await waitFor(() => expect((name as HTMLInputElement).value).toBe(job.name));
    for (const label of [/^Project/, /^Published version/, /^Code/, 'About']) expect(screen.queryByLabelText(label)).toBeNull();
    fireEvent.change(screen.getByLabelText('DCC version'), { target: { value: '15.1' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(writes(calls)[0].method).toBe('PATCH');
    expect(writes(calls)[0].body).toEqual({ dcc_version: '15.1' });
  });
});

describe('published files', () => {
  const List = () => <DirectoryListPage config={useFilesListConfig()} />;
  const listRoute = <Route path="/publishing/files" element={<List />} />;
  const registered = flow.files_detail.body;
  const deprecated = flow.files_deprecate.body;
  const revoked = flow.files_detail_revoked.body;
  const page = (results: any[]) => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });
  const row = (f: any) => `${f.relative_path}`;

  it('the list offers the lifecycle by status and permission; there is no search, no edit, no delete', async () => {
    mockFetch(() => page([registered, deprecated, revoked]));
    renderAt('/publishing/files', producer, listRoute);
    await screen.findByRole('link', { name: new RegExp(row(registered).replace(/[.]/g, '\\.')) });
    expect(screen.getByRole('button', { name: new RegExp(`^Deprecate ${registered.relative_path.replace(/[.]/g, '\\.')}`) })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /^Revoke / }).length).toBe(2); // Registered and Deprecated, not Revoked
    expect(screen.getAllByRole('button', { name: /^Restore / }).length).toBe(1);
    expect(screen.queryByRole('link', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    expect(screen.queryByLabelText(/^Search /)).toBeNull();
    expect(screen.getByLabelText('Filter by project')).toBeTruthy();
  });

  it('deprecating needs publishing.deprecate and revoking needs publishing.revoke', async () => {
    mockFetch(() => page([registered]));
    renderAt('/publishing/files', deprecator, listRoute);
    await screen.findByRole('link', { name: new RegExp(row(registered).replace(/[.]/g, '\\.')) });
    expect(screen.getByRole('button', { name: /^Deprecate / })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Revoke / })).toBeNull();
    cleanup();
    mockFetch(() => page([registered]));
    renderAt('/publishing/files', artist, listRoute);
    await screen.findByRole('link', { name: new RegExp(row(registered).replace(/[.]/g, '\\.')) });
    expect(screen.queryByRole('button', { name: /^(Deprecate|Revoke|Restore) / })).toBeNull();
  });

  it('revoking asks for the reason first and posts it', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.files_revoke) : page([registered])));
    renderAt('/publishing/files', producer, listRoute);
    fireEvent.click(await screen.findByRole('button', { name: /^Revoke / }));
    const dialog = within(await screen.findByRole('dialog'));
    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }));
    expect(await dialog.findByText(/reason/i)).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
    fireEvent.change(dialog.getByLabelText(/reason/i), { target: { value: 'Wrong plate' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe(`/api/v1/publishing/files/${registered.id}/revoke/`);
    expect(writes(calls)[0].body).toEqual({ reason: 'Wrong plate' });
  });

  it('the file page shows where it is and why a revoked file was revoked; a revoked file has no actions', async () => {
    mockFetch(() => ({ status: 200, body: revoked }));
    renderAt(`/publishing/files/${revoked.id}`, producer, <Route path="/publishing/files/:fileId" element={<PublishedFilePage />} />);
    expect(await screen.findByText(/This file was revoked: Wrong plate/)).toBeTruthy();
    expect(screen.queryByRole('toolbar', { name: 'File actions' })).toBeNull();
    expect(screen.getByText(revoked.sha256)).toBeTruthy();
    cleanup();

    mockFetch(() => ({ status: 200, body: registered }));
    renderAt(`/publishing/files/${registered.id}`, producer, <Route path="/publishing/files/:fileId" element={<PublishedFilePage />} />);
    const bar = await screen.findByRole('toolbar', { name: 'File actions' });
    expect(within(bar).getAllByRole('button').map((b) => b.textContent)).toEqual(['Deprecate', 'Revoke']);
  });

  it('registering a file sends the root’s code, not its id; a missing version is refused first', async () => {
    const root = flow.roots_detail.body;
    const version = { id: 'v-1', code: 'PV0001', version_number: 'v001', entity_code: 'SH0010' };
    const { calls } = mockFetch((c) => {
      const p = path(c);
      if (c.method === 'POST') return { status: 201, body: registered };
      if (p === '/api/v1/versions/') return page([version]);
      if (p === '/api/v1/publishing/storage-roots/') return page([root]);
      if (p.startsWith('/api/v1/publishing/storage-roots/')) return { status: 200, body: root };
      return emptyPage;
    });
    renderAt('/publishing/files/new', producer, <Route path="/publishing/files/new" element={<DirectoryFormPage config={filesFormConfig} />} />);
    await screen.findByRole('option', { name: new RegExp(root.code) });
    await screen.findByRole('option', { name: /PV0001/ });
    fireEvent.change(await screen.findByLabelText(/^Storage root/), { target: { value: root.id } });
    fireEvent.change(screen.getByLabelText(/^Path under the root/), { target: { value: 'show/SH010/plate.exr' } });
    fireEvent.change(screen.getByLabelText(/^Size/), { target: { value: '1024' } });
    fireEvent.change(screen.getByLabelText(/^SHA-256/), { target: { value: 'a'.repeat(64) } });
    fireEvent.click(screen.getByRole('button', { name: /create published file/i }));
    expect(await screen.findByText(/Choose a published version/)).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(/^Published version/), { target: { value: 'v-1' } });
    fireEvent.click(screen.getByRole('button', { name: /create published file/i }));
    await waitFor(() => expect(writes(calls)).toHaveLength(1));
    expect(path(writes(calls)[0])).toBe('/api/v1/publishing/files/');
    expect(writes(calls)[0].body).toEqual({ version_id: 'v-1', storage_root: root.code, relative_path: 'show/SH010/plate.exr', role: 'main', size_bytes: 1024, sha256: 'a'.repeat(64) });
  });
});

describe('register many files', () => {
  const item = (n: number) => ({ version_id: 'v-1', storage_root: 'PROJECTS', relative_path: `show/f${n}.exr`, size_bytes: 1, sha256: 'a'.repeat(64) });

  it('refuses text that is not a JSON array of files before sending anything', async () => {
    const { calls } = mockFetch(() => emptyPage);
    renderAt('/publishing/files/bulk', producer, <Route path="/publishing/files/bulk" element={<BulkRegisterPage />} />);
    for (const [text, message] of [['{oops', 'That is not valid JSON.'], ['{"a":1}', 'Give a JSON array of 1 to 100 files.'], ['[]', 'Give a JSON array of 1 to 100 files.']] as const) {
      fireEvent.change(screen.getByLabelText('Files (JSON)'), { target: { value: text } });
      fireEvent.click(screen.getByRole('button', { name: 'Register' }));
      expect(await screen.findByText(message)).toBeTruthy();
    }
    expect(writes(calls)).toHaveLength(0);
  });

  it('posts the items and reports each one, naming the field that was refused', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? reply(flow.files_bulk_partial) : emptyPage));
    renderAt('/publishing/files/bulk', producer, <Route path="/publishing/files/bulk" element={<BulkRegisterPage />} />);
    fireEvent.change(screen.getByLabelText('Files (JSON)'), { target: { value: JSON.stringify([item(1), item(2), item(3)]) } });
    fireEvent.click(screen.getByRole('button', { name: 'Register' }));
    const result = await screen.findByRole('region', { name: 'Result' });
    expect(path(writes(calls)[0])).toBe('/api/v1/publishing/files/bulk-register/');
    expect(writes(calls)[0].body).toEqual({ items: [item(1), item(2), item(3)] });
    expect(within(result).getByText(/2 registered, 1 refused/)).toBeTruthy();
    expect(within(result).getByText(/#2: invalid — relative_path: A path cannot contain/)).toBeTruthy();
  });
});

describe('storage roots and the project tab', () => {
  it('a storage root’s code is chosen once', async () => {
    const root = flow.roots_detail.body;
    mockFetch(() => ({ status: 200, body: root }));
    renderAt(`/publishing/storage-roots/${root.id}/edit`, withCodes('publishing.storage.manage'), <Route path="/publishing/storage-roots/:id/edit" element={<DirectoryFormPage config={rootsFormConfig} />} />);
    const name = await screen.findByLabelText(/^Name/);
    await waitFor(() => expect((name as HTMLInputElement).value).toBe(root.name));
    expect(screen.queryByLabelText(/^Code/)).toBeNull();
  });

  it('the project tab lists the project’s export jobs and published files from the server, both filtered by project (CR-22)', async () => {
    const { calls } = mockFetch(() => emptyPage);
    renderAt('/x', artist, <Route path="/x" element={<ProjectPublishingTab project={{ id: 'p-77', code: 'PRJ' } as unknown as Project} />} />);
    for (const url of ['/api/v1/publishing/', '/api/v1/publishing/files/']) {
      await waitFor(() => expect(calls.some((c) => path(c) === url)).toBe(true));
      expect(new URL(calls.find((c) => path(c) === url)!.url).searchParams.get('project_id')).toBe('p-77');
    }
    expect(screen.queryByLabelText('Filter by project')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Publishing' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Published files' })).toBeTruthy();
  });
});
