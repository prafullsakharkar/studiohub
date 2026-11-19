import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Review, Version } from '@/api/production/review';
import type { Project } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { ProjectWorkspacePage } from '@/modules/production/pages/ProjectWorkspacePage';
import { projectsFormConfig } from '@/modules/production/structure/configs';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { downloadHref } from '../ReviewCopyDownload';
import { ReviewMoviePanel } from '../ReviewMoviePanel';
import { ReviewViewer } from '../ReviewViewer';

/** RP-23 (C-RP-56, Q-RP-105 to Q-RP-108): the Download link and the project's switch, against _review_download_flow.json. */
type Captured<T> = { status: number; body: T };
interface Flow {
  project_default: Captured<Project>;
  project_everyone_200: Captured<Project>;
  project_nobody_200: Captured<Project>;
  project_bad_value_400: Captured<Record<string, string[]>>;
  version_as_studio: Captured<Version>;
  version_as_client: Captured<Version>;
  version_as_client_everyone: Captured<Version>;
  version_as_studio_nobody: Captured<Version>;
  version_still_as_studio: Captured<Version>;
}
const flow = loadSample<Flow>('production/_review_download_flow.json');
const reviews = loadSample<Record<string, Captured<Review>>>('production/_review_flow.json');
const rollup = loadSample<Record<string, Captured<unknown>>>('production/_rollup_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const studio = flow.version_as_studio.body;
const path = (c: MockCall) => new URL(c.url).pathname;
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });
const label = (v: Version) => `Download the review copy of ${v.code}`;

function mount(ui: React.ReactElement, initial = '/') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}
const panel = () => screen.getByRole('region', { name: 'Review movie' });

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('the Download link (C-RP-56, Q-RP-108)', () => {
  it('a studio member: the panel links the server’s download link, absolute, and saves it', () => {
    mockFetch(() => ({ status: 500 }));
    mount(<ReviewMoviePanel version={studio} />);
    const link = within(panel()).getByRole('link', { name: label(studio) });
    const given = studio.review_media?.download_url ?? '';
    expect(given).toMatch(/^\/api\/v1\/review-media\/[^/]+\/download\/\?token=/);
    expect(link.getAttribute('href')).toBe(`http://api.test${given}`);
    expect(link.hasAttribute('download')).toBe(true);
    expect(link.textContent).toBe('Download');
  });

  it('a still downloads its JPEG the same way', () => {
    mockFetch(() => ({ status: 500 }));
    const still = flow.version_still_as_studio.body;
    mount(<ReviewMoviePanel version={still} />);
    expect(within(panel()).getByRole('link', { name: label(still) }).getAttribute('href')).toContain('/download/?token=');
  });

  it('no link where the server gives none: a client under internal, anyone under nobody; the copy still plays', () => {
    for (const version of [flow.version_as_client.body, flow.version_as_studio_nobody.body]) {
      expect(version.review_media?.proxy_url).toBeTruthy();
      expect(version.review_media?.download_url).toBeNull();
      mockFetch(() => ({ status: 500 }));
      mount(<ReviewMoviePanel version={version} />);
      expect(within(panel()).queryByRole('link', { name: label(version) })).toBeNull();
      cleanup();
    }
  });

  it('a client gets the link once the project says everyone', () => {
    mockFetch(() => ({ status: 500 }));
    const version = flow.version_as_client_everyone.body;
    mount(<ReviewMoviePanel version={version} />);
    expect(within(panel()).getByRole('link', { name: label(version) })).toBeTruthy();
  });

  it('only a ready copy is offered', () => {
    const media = studio.review_media;
    if (!media) throw new Error('the captured version has no copy');
    expect(downloadHref(media)).toBe(`http://api.test${media.download_url}`);
    expect(downloadHref({ ...media, status: 'processing' })).toBeUndefined();
    expect(downloadHref(null)).toBeUndefined();
  });

  it('the review player offers it for the version on show', async () => {
    const review = reviews.reviews_start_review.body;
    const shown = { ...studio, id: review.versions[0].id };
    mockFetch((c) => (path(c) === `/api/v1/versions/${shown.id}/` ? { status: 200, body: shown } : { status: 200, body: page([]) }));
    mount(<ReviewViewer review={review} />);
    const link = await screen.findByRole('link', { name: `Download the review copy of ${review.versions[0].code}` });
    expect(link.getAttribute('href')).toBe(`http://api.test${studio.review_media?.download_url}`);
  });
});

describe('the project’s switch (C-RP-56, Q-RP-105)', () => {
  it('the form offers the server’s three choices, studio members by default, and sends the one chosen', async () => {
    const created = flow.project_default.body;
    expect(created.review_downloads).toBe('internal');
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: created } : { status: 200, body: page([]) }));
    mount(
      <Routes>
        <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />
        <Route path="/projects/:id" element={<p>opened</p>} />
      </Routes>,
      '/projects/new',
    );
    const select = (await screen.findByLabelText('Who may download review copies')) as HTMLSelectElement;
    expect(select.value).toBe('internal');
    expect([...select.options].map((o) => o.value).filter(Boolean)).toEqual(['internal', 'everyone', 'nobody']);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Downloads' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'RDL2' } });
    fireEvent.change(select, { target: { value: 'everyone' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ review_downloads: 'everyone' });
  });

  it('another value is refused on its field, as the server says', () => {
    expect(flow.project_bad_value_400.body.review_downloads).toEqual(['"clients" is not a valid choice.']);
  });

  it.each([
    ['everyone', 'Clients and vendors may download review copies'],
    ['nobody', 'Review copies cannot be downloaded'],
  ] as const)('the project page says when it is %s, and a duplicate keeps it', async (value, text) => {
    const project = value === 'everyone' ? flow.project_everyone_200.body : flow.project_nobody_200.body;
    expect(project.review_downloads).toBe(value);
    const { calls } = mockFetch((c) => {
      const p = path(c);
      if (p === `/api/v1/projects/${project.id}/`) return { status: 200, body: project };
      if (p === '/api/v1/projects/' && c.method === 'POST') return { status: 201, body: rollup.create_project_on.body };
      return { status: 200, body: page([]) };
    });
    mount(
      <Routes>
        <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
      </Routes>,
      `/projects/${project.id}`,
    );
    await screen.findByRole('heading', { name: project.name });
    expect(screen.getByText(text)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Duplicate/ }));
    fireEvent.change(await screen.findByDisplayValue(`${project.name} (Copy)`), { target: { value: 'Downloads 2' } });
    fireEvent.change(screen.getByDisplayValue(`${project.code}_CLONE`), { target: { value: 'RDL3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate project' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ review_downloads: value });
  });

  it('the default says nothing on the project page', async () => {
    const project = flow.project_default.body;
    mockFetch((c) => (path(c) === `/api/v1/projects/${project.id}/` ? { status: 200, body: project } : { status: 200, body: page([]) }));
    mount(
      <Routes>
        <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
      </Routes>,
      `/projects/${project.id}`,
    );
    await screen.findByRole('heading', { name: project.name });
    expect(screen.queryByText(/download review copies|cannot be downloaded/)).toBeNull();
  });
});
