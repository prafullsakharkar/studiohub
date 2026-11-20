import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewCopies, Version } from '@/api/production/review';
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
import { ReviewCopiesNotice, differingText, outOfDateText } from '../ReviewCopiesNotice';
import { downloadTitle } from '../ReviewCopyDownload';

/** RP-25 (C-RP-59, C-RP-60, Q-RP-113 to Q-RP-116): the project's slate switch and line, against _review_slates_flow.json. */
type Captured<T> = { status: number; body: T };
interface Flow {
  project_default: Captured<Project>;
  project_slates_on_200: Captured<Project>;
  version_without_slate: Captured<Version>;
  version_remade_with_slate: Captured<Version>;
  copies_differing_slate: Captured<ReviewCopies>;
  copies_after_off: Captured<ReviewCopies>;
}
const flow = loadSample<Flow>('production/_review_slates_flow.json');
const rollup = loadSample<Record<string, Captured<unknown>>>('production/_rollup_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const admin = auth.me_admin.body as unknown as User;
const path = (c: MockCall) => new URL(c.url).pathname;
const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });
const slated = flow.project_slates_on_200.body;

function mount(ui: React.ReactElement, initial = '/') {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}>
      <AuthContext.Provider value={{ user: admin, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('the project’s switch and line (C-RP-59, Q-RP-113, Q-RP-114)', () => {
  it('off by default; the line shows only while the switch is on, and both are sent', async () => {
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { status: 201, body: slated } : { status: 200, body: page([]) }));
    mount(
      <Routes>
        <Route path="/projects/new" element={<DirectoryFormPage config={projectsFormConfig} />} />
        <Route path="/projects/:id" element={<p>opened</p>} />
      </Routes>,
      '/projects/new',
    );
    const box = (await screen.findByLabelText('Put a slate before downloaded review copies')) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(screen.queryByLabelText('Slate line')).toBeNull();
    fireEvent.click(box);
    const line = (await screen.findByLabelText('Slate line')) as HTMLInputElement;
    expect(line.maxLength).toBe(120);
    fireEvent.change(line, { target: { value: slated.review_slate_note } });
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Slates' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'RSL2' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ review_slates: true, review_slate_note: 'Confidential: 100% "internal" -- do not forward' });
  });

  it('the project page says so, and a duplicate keeps the switch and the line', async () => {
    const { calls } = mockFetch((c) => {
      const p = path(c);
      if (p === `/api/v1/projects/${slated.id}/`) return { status: 200, body: slated };
      if (p === '/api/v1/projects/' && c.method === 'POST') return { status: 201, body: rollup.create_project_on.body };
      return { status: 200, body: page([]) };
    });
    mount(
      <Routes>
        <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
      </Routes>,
      `/projects/${slated.id}`,
    );
    await screen.findByRole('heading', { name: slated.name });
    expect(screen.getByText('Slates on downloaded review copies')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: /Duplicate/ }));
    fireEvent.change(await screen.findByDisplayValue(`${slated.name} (Copy)`), { target: { value: 'Slates 2' } });
    fireEvent.change(screen.getByDisplayValue(`${slated.code}_CLONE`), { target: { value: 'RSL3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate project' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ review_slates: true, review_slate_note: slated.review_slate_note });
  });

  it('off says nothing on the project page', async () => {
    const project = flow.project_default.body;
    mockFetch((c) => (path(c) === `/api/v1/projects/${project.id}/` ? { status: 200, body: project } : { status: 200, body: page([]) }));
    mount(
      <Routes>
        <Route path="/projects/:id" element={<ProjectWorkspacePage />} />
      </Routes>,
      `/projects/${project.id}`,
    );
    await screen.findByRole('heading', { name: project.name });
    expect(screen.queryByText(/Slates on downloaded/)).toBeNull();
  });
});

describe('the Download link says what it saves (C-RP-59)', () => {
  it('a copy with a slate, and one without', () => {
    expect(downloadTitle(flow.version_remade_with_slate.body.review_media)).toBe(
      'Save the review copy, with a two-second slate first and its burn-ins and grade. Downloads are recorded.',
    );
    expect(downloadTitle(flow.version_without_slate.body.review_media)).toBe('Save the review copy, with its burn-ins and grade. Downloads are recorded.');
  });
});

describe('copies that differ in their slate (C-RP-60, Q-RP-116)', () => {
  it('names the slate when it is the only difference, both ways', () => {
    expect(outOfDateText(flow.copies_differing_slate.body)).toBe('1 review copy was made without the slate; the project now puts one before downloads.');
    expect(outOfDateText(flow.copies_after_off.body)).toBe('2 review copies were made with a slate; the project now leaves it off.');
  });

  it('with another difference too, the sentence names the slate among the settings', () => {
    const both: ReviewCopies = {
      ...flow.copies_differing_slate.body,
      differing: flow.copies_differing_slate.body.differing.map((row) => ({ ...row, why: ['burn_ins', 'slate'] })),
    };
    expect(outOfDateText(both)).toBe('1 review copy was made with other slate, colour or burn-in settings than the project has now.');
  });

  it('a listed copy says the slate differs', () => {
    const [row] = flow.copies_differing_slate.body.differing;
    if (!row) throw new Error('no differing copy');
    expect(differingText(row)).toBe('slate differ · can be remade');
  });

  it('the project notice offers to remake it', async () => {
    mockFetch((c) => (path(c) === `/api/v1/projects/${slated.id}/review-copies/` ? { status: 200, body: flow.copies_differing_slate.body } : { status: 200, body: page([]) }));
    mount(<ReviewCopiesNotice project={slated} />);
    expect(await screen.findByText('1 review copy was made without the slate; the project now puts one before downloads.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remake them' })).toBeTruthy();
  });
});
