import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { ProjectPublishingTab } from '@/modules/production/components/project-tabs/ProjectPublishingTab';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { PublishedFilePage } from '../FilePages';
import { pathTemplateFormConfig, usePathTemplatesListConfig } from '../registry';

/** Review pipeline RP-4 screens: a file's dependencies (C-RP-16) and path templates (C-RP-18), served from captures. */
type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('publishing/_dependencies_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;
const withCodes = (...codes: string[]) => ({ ...artist, permissions: [...artist.permissions, ...codes] }) as User;
const manager = withCodes('publishing.template.manage');
const path = (c: MockCall) => new URL(c.url).pathname;
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

describe('a file’s dependencies', () => {
  const fileRoute = <Route path="/publishing/files/:fileId" element={<PublishedFilePage />} />;
  const open = (file: any, dependencies: Captured) => {
    const mocked = mockFetch((c) => (path(c).endsWith('/dependencies/') ? { status: dependencies.status, body: dependencies.body } : { status: 200, body: file }));
    renderAt(`/publishing/files/${file.id}`, artist, fileRoute);
    return mocked;
  };

  it('lists what the file was built from, each linking to its page', async () => {
    const file = flow.file_detail_downstream.body;
    const { calls } = open(file, flow.dependencies_of_downstream);
    const built = await screen.findByRole('region', { name: 'Built from' });
    const upstream = flow.dependencies_of_downstream.body.upstream[0];
    const link = within(built).getByRole('link', { name: upstream.relative_path });
    expect(link.getAttribute('href')).toBe(`/publishing/files/${upstream.id}`);
    expect(within(built).getByText(new RegExp(upstream.version_code))).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Used by' })).getByText('No file names this one as an upstream.')).toBeTruthy();
    expect(calls.some((c) => path(c) === `/api/v1/publishing/files/${file.id}/dependencies/`)).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lists the files built from an upstream', async () => {
    open(flow.register_upstream.body, flow.dependencies_of_upstream);
    const used = await screen.findByRole('region', { name: 'Used by' });
    expect(within(used).getByRole('link', { name: flow.dependencies_of_upstream.body.downstream[0].relative_path })).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Built from' })).getByText('Registered without upstream files.')).toBeTruthy();
  });

  it('warns when a file it was built from has been revoked', async () => {
    open(flow.file_detail_downstream.body, flow.dependencies_after_upstream_revoked);
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/A file this one was built from has been revoked/));
  });
});

describe('path templates', () => {
  const List = ({ projectId }: { projectId?: string }) => <DirectoryListPage config={usePathTemplatesListConfig(projectId ? { projectId } : undefined)} />;
  const page = (results: any[]) => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

  it('lists studio and project templates; only a holder of publishing.template.manage may add one', async () => {
    const rows = flow.templates_list.body.results;
    mockFetch(() => page(rows));
    renderAt('/publishing/path-templates', artist, <Route path="/publishing/path-templates" element={<List />} />);
    expect(await screen.findAllByText(rows[0].pattern)).toBeTruthy();
    expect(screen.getAllByText('Studio').length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /New path template/i })).toBeNull();
    cleanup();

    mockFetch(() => page(rows));
    renderAt('/publishing/path-templates', manager, <Route path="/publishing/path-templates" element={<List />} />);
    expect(await screen.findByRole('link', { name: /New path template/i })).toBeTruthy();
  });

  it('a project’s tab asks for that project’s templates and opens the form on it', async () => {
    const { calls } = mockFetch(() => emptyPage);
    renderAt('/x', manager, <Route path="/x" element={<ProjectPublishingTab project={{ id: 'p-77', code: 'PRJ' } as unknown as Project} />} />);
    await waitFor(() => expect(calls.some((c) => path(c) === '/api/v1/publishing/path-templates/')).toBe(true));
    const call = calls.find((c) => path(c) === '/api/v1/publishing/path-templates/')!;
    expect(new URL(call.url).searchParams.get('project_id')).toBe('p-77');
    expect(screen.getByRole('heading', { name: 'Path templates' })).toBeTruthy();
    expect((await screen.findByRole('link', { name: /New path template/i })).getAttribute('href')).toContain('project=p-77');
  });

  it('a new studio template sends no project, the switches, and the codes as typed', async () => {
    const created = flow.template_create_studio;
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: created.status, body: created.body } : emptyPage));
    renderAt('/publishing/path-templates/new', manager, <Route path="/publishing/path-templates/new" element={<DirectoryFormPage config={pathTemplateFormConfig} />} />);
    fireEvent.change(await screen.findByLabelText(/^File type code/), { target: { value: 'EXR' } });
    fireEvent.change(screen.getByLabelText(/^Storage root code/), { target: { value: 'PROJECTS' } });
    fireEvent.change(screen.getByLabelText(/^Pattern/), { target: { value: created.body.pattern } });
    fireEvent.click(screen.getByRole('button', { name: /Create|Save/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const body = calls.find((c) => c.method === 'POST')!.body as Record<string, unknown>;
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe('/api/v1/publishing/path-templates/');
    expect(body).toMatchObject({ project: null, file_type: 'EXR', storage_root: 'PROJECTS', pattern: created.body.pattern, enforce: false, is_active: true });
  });

  it('editing never offers the key and sends only what changed', async () => {
    const template = flow.template_create_project_enforcing.body;
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? { status: 200, body: { ...template, enforce: false } } : { status: 200, body: template }));
    renderAt(`/publishing/path-templates/${template.id}/edit`, manager, <Route path="/publishing/path-templates/:id/edit" element={<DirectoryFormPage config={pathTemplateFormConfig} />} />);
    const enforce = (await screen.findByLabelText(/^Refuse files of this type and role/)) as HTMLInputElement;
    await waitFor(() => expect(enforce.checked).toBe(true));
    expect(screen.queryByLabelText(/^File type code/)).toBeNull();
    expect(screen.queryByLabelText(/^Role/)).toBeNull();
    fireEvent.click(enforce);
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.method === 'PATCH')!;
    expect(path(patch)).toBe(`/api/v1/publishing/path-templates/${template.id}/`);
    expect(patch.body).toEqual({ enforce: false });
  });
});
