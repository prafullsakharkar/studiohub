import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { RelatedRecords } from '@/modules/directory/RelatedRecords';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { sequencesConfigFor } from '../../structure/configs';
import { shotsFormConfig } from '../shots';

/**
 * A new shot's code starts with the project's (TST_SH010), and a shot needs a sequence of that project. Answers are the
 * captured ones; an existing record keeps its code and may stay without a sequence.
 */
type Captured = { status: number; body: any };
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const projects = loadSample<Record<string, Captured>>('production/projects.json');
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const superuser = loadSample('identity/_auth_flow.json').me_admin.body as unknown as User;

const project = projects.detail_admin.body as { id: string; code: string };
const sequence = structure.sequences_list_after_bulk.body.results[0] as { id: string; code: string };
const legacyShot = { ...work.shots_list.body.results[0], project_id: project.id, sequence_id: null, sequence_code: '' };

const path = (c: MockCall) => new URL(c.url).pathname;
const page = (results: unknown[]): MockReply => ({ status: 200, body: { count: results.length, next: null, previous: null, results } });

function serve({ sequences = [sequence] as unknown[] } = {}) {
  return (c: MockCall): MockReply => {
    const p = path(c);
    if (c.method === 'POST' && p === '/api/v1/shots/') return { status: 201, body: legacyShot };
    if (c.method === 'PATCH' && p === `/api/v1/shots/${legacyShot.id}/`) return { status: 200, body: legacyShot };
    if (p === `/api/v1/shots/${legacyShot.id}/`) return { status: 200, body: legacyShot };
    if (p === `/api/v1/projects/${project.id}/`) return { status: 200, body: project };
    if (p === '/api/v1/sequences/') return page(sequences);
    return page([]);
  };
}

function renderAt(initial: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>
            <Route path="/shots/new" element={<DirectoryFormPage config={shotsFormConfig} />} />
            <Route path="/shots/:id/edit" element={<DirectoryFormPage config={shotsFormConfig} />} />
            <Route path="*" element={<p>saved</p>} />
          </Routes>
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
});

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const posts = (calls: MockCall[]) => calls.filter((c) => c.method === 'POST' && path(c) === '/api/v1/shots/');

describe('new shot: the code', () => {
  it('shows the project code in front of the input, taken from the chosen project', async () => {
    mockFetch(serve());
    renderAt(`/shots/new?project=${project.id}`);
    expect((await screen.findByLabelText('Code prefix')).textContent).toBe(`${project.code}_`);
  });

  it('is sent with the project code in front, upper case', async () => {
    const { calls } = mockFetch(serve());
    renderAt(`/shots/new?project=${project.id}&sequence_id=${sequence.id}`);
    await screen.findByLabelText('Code prefix');
    type('Code *', 'sh010');
    fireEvent.click(screen.getByRole('button', { name: 'Create shot' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect(posts(calls)[0].body).toMatchObject({ project: project.id, code: `${project.code}_SH010`, sequence_id: sequence.id });
  });

  it('typed with the prefix already, it is not doubled', async () => {
    const { calls } = mockFetch(serve());
    renderAt(`/shots/new?project=${project.id}&sequence_id=${sequence.id}`);
    await screen.findByLabelText('Code prefix');
    type('Code *', `${project.code}_SH010`);
    fireEvent.click(screen.getByRole('button', { name: 'Create shot' }));
    await waitFor(() => expect(posts(calls)).toHaveLength(1));
    expect((posts(calls)[0].body as { code: string }).code).toBe(`${project.code}_SH010`);
  });
});

describe('new shot: the sequence', () => {
  it('is required: without one nothing is sent', async () => {
    const { calls } = mockFetch(serve());
    renderAt(`/shots/new?project=${project.id}`);
    await screen.findByLabelText('Code prefix');
    type('Code *', 'sh010');
    fireEvent.click(screen.getByRole('button', { name: 'Create shot' }));
    expect(await screen.findByText('Choose a sequence.')).toBeTruthy();
    expect(posts(calls)).toHaveLength(0);
  });

  it('says so when the project has no sequences at all', async () => {
    mockFetch(serve({ sequences: [] }));
    renderAt(`/shots/new?project=${project.id}`);
    expect((await screen.findByRole('alert')).textContent).toMatch(/has no sequences\. Create the sequence first/);
  });

  it('does not say so while the project has one', async () => {
    mockFetch(serve());
    renderAt(`/shots/new?project=${project.id}`);
    await screen.findByLabelText('Code prefix');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText(/has no sequences/)).toBeNull();
  });
});

describe('an existing shot', () => {
  it('shows its code as saved, with no prefix, and can be saved without a sequence', async () => {
    const { calls } = mockFetch(serve());
    renderAt(`/shots/${legacyShot.id}/edit`);
    const code = (await screen.findByLabelText('Code *')) as HTMLInputElement;
    await waitFor(() => expect(code.value).toBe(legacyShot.code));
    expect(screen.queryByLabelText('Code prefix')).toBeNull();
    type('Name', 'Renamed');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH' && path(c) === `/api/v1/shots/${legacyShot.id}/`)).toBe(true));
    expect(screen.queryByText('Choose a sequence.')).toBeNull();
  });
});

describe('a project\'s Sequences tab: Add sequence', () => {
  it('sends the code with the project code in front', async () => {
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST' && path(c) === '/api/v1/sequences/') return { status: 201, body: sequence };
      if (path(c) === `/api/v1/projects/${project.id}/`) return { status: 200, body: project };
      if (path(c) === '/api/v1/sequences/') return page([sequence]);
      return page([]);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter>
            <RelatedRecords config={sequencesConfigFor(false)} parentId={project.id} />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Add sequence' }));
    const dialog = await screen.findByRole('dialog');
    expect((await within(dialog).findByLabelText('Code prefix')).textContent).toBe(`${project.code}_`);
    fireEvent.change(within(dialog).getByLabelText('Code *'), { target: { value: 'sq0010' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create sequence' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && path(c) === '/api/v1/sequences/')).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && path(c) === '/api/v1/sequences/')?.body).toMatchObject({ project: project.id, code: `${project.code}_SQ0010` });
  });
});
