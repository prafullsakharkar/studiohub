import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, Sequence } from '@/api/production/structure';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { pickEntity } from '@/test/picker';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { GradeExport } from '../components/GradeExport';

/** RP-27 (C-RP-62, Q-RP-121 to Q-RP-124): Export grades… on the Shots page, against _grade_export_flow.json. */
type Captured<T = unknown> = { status: number; body: T };
const flow = loadSample<Record<string, Captured>>('production/_grade_export_flow.json');
const supervisor = flow.me_supervisor.body as User;
const withoutShots = flow.me_without_shot_view.body as User;
const project = flow.project.body as Project;
const sequences = flow.sequences.body as { results: Sequence[] };
const path = (c: MockCall) => new URL(c.url).pathname;
const exportPath = `/api/v1/projects/${project.id}/grades/export/`;
const exports = (calls: MockCall[]) => calls.filter((c) => path(c) === exportPath);

function server(c: MockCall): MockReply {
  if (path(c) === exportPath) return { body: flow.export_project.body, headers: { 'Content-Type': 'application/xml; charset=utf-8' } };
  if (path(c) === `/api/v1/projects/${project.id}/`) return { body: project };
  if (path(c) === '/api/v1/sequences/') return { body: sequences };
  return { body: { count: 0, next: null, previous: null, results: [] } };
}

/** The names the page saved files under (ApiClient.download clicks a link with `download`). */
let saved: string[] = [];
beforeEach(() => {
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  saved = [];
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:grades'), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    saved.push(this.download);
  });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(user: User) {
  render(
    <MemoryRouter>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
        <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <GradeExport projectId={project.id} />
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('Export grades… (C-RP-62)', () => {
  it('exports the whole project, saved as the server names it', async () => {
    const { calls } = mockFetch(server);
    mount(supervisor);
    fireEvent.click(screen.getByRole('button', { name: 'Export grades…' }));
    await screen.findByText(`Saved as ${project.code}_grades.ccc.`);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(saved).toEqual([`${project.code}_grades.ccc`]));
    expect(exports(calls)).toHaveLength(1);
    expect(new URL(exports(calls)[0].url).searchParams.has('sequence_id')).toBe(false);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('one sequence sends its id', async () => {
    const { calls } = mockFetch(server);
    mount(supervisor);
    fireEvent.click(screen.getByRole('button', { name: 'Export grades…' }));
    await screen.findByText(`Saved as ${project.code}_grades.ccc.`);
    const chase = sequences.results.find((s) => s.code === 'REX_SQ020') as Sequence;
    await pickEntity(/Sequence/, /REX_SQ020/);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    await waitFor(() => expect(exports(calls)).toHaveLength(1));
    expect(new URL(exports(calls)[0].url).searchParams.get('sequence_id')).toBe(chase.id);
  });

  it('a refusal is shown, and nothing is saved', async () => {
    mockFetch((c) => (path(c) === exportPath ? { status: 403, body: flow.export_without_shot_view_403.body } : server(c)));
    mount(supervisor);
    fireEvent.click(screen.getByRole('button', { name: 'Export grades…' }));
    await screen.findByText(`Saved as ${project.code}_grades.ccc.`);
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission/i);
    expect(saved).toEqual([]);
  });

  it('not offered without shot.view', () => {
    mockFetch(server);
    mount(withoutShots);
    expect(screen.queryByRole('button', { name: 'Export grades…' })).toBeNull();
  });
});
