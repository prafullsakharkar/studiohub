import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { useProductionStore } from '@/core/production/useProductionStore';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { useSequencesListConfig } from '../../structure/lists';

/**
 * "Edit fields" on the selected rows of the Sequences list (CR-48): the ticked fields for every selected id in one
 * all-or-nothing bulk-update. Every answer is a captured one (`_bulk_cr48_flow.json`).
 */
type Captured = { status: number; body: any; request: { body: any } };
const bulk = loadSample<Record<string, Captured>>('production/_bulk_cr48_flow.json');
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;

const standard = bulk.projects_detail_standard.body as { id: string; code: string; name: string };
const episodic = bulk.projects_detail_episodic.body as { id: string; code: string; name: string };
const rows = structure.sequences_list_after_bulk.body.results as Array<{ id: string; code: string; name: string }>;

const path = (c: MockCall) => new URL(c.url).pathname;
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const posts = (calls: MockCall[], route: string) => calls.filter((c) => c.method === 'POST' && path(c) === `/api/v1/sequences/${route}/`);

/** GETs as the list needs them; each POST answered by `answer` (a captured batch). */
function server(answer: (c: MockCall) => Captured) {
  return (c: MockCall): MockReply => {
    const p = path(c);
    if (c.method === 'POST') return reply(answer(c));
    if (p === `/api/v1/projects/${standard.id}/`) return reply(bulk.projects_detail_standard);
    if (p === `/api/v1/projects/${episodic.id}/`) return reply(bulk.projects_detail_episodic);
    if (p === '/api/v1/projects/') return { status: 200, body: { count: 2, next: null, previous: null, results: [standard, episodic] } };
    if (p === '/api/v1/sequences/') return reply(structure.sequences_list_after_bulk);
    if (p === '/api/v1/episodes/') return reply(bulk.episodes_of_episodic);
    return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
  };
}

/** A project's Sequences tab (`projectId`), or the Sequences page of the Production nav (none). */
function List({ projectId }: { projectId?: string }) {
  return <DirectoryListPage config={useSequencesListConfig(projectId ? { projectId } : undefined)} />;
}

function renderList(projectId: string | undefined, user: User = superuser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>
          <List projectId={projectId} />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const blobs: Blob[] = [];
beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  blobs.length = 0;
  useProductionStore.setState({ activeProjectId: null });
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => (blobs.push(b), 'blob:x'), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('Edit fields on the selected rows', () => {
  async function editStatus(answer: Captured, status: string) {
    const result = mockFetch(server(() => answer));
    renderList(standard.id);
    fireEvent.click(await screen.findByLabelText(`Select ${rows[0].code}`));
    fireEvent.click(screen.getByRole('button', { name: 'Edit fields' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByLabelText('Change Status'));
    fireEvent.change(within(dialog).getByLabelText('Status'), { target: { value: status } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit fields' }));
    return { ...result, dialog };
  }

  it('sends the ticked fields for every selected id, all or nothing', async () => {
    const { calls } = await editStatus(bulk.sequences_update_ids, 'Pending Review');
    await waitFor(() => expect(posts(calls, 'bulk-update')).toHaveLength(1));
    expect(posts(calls, 'bulk-update')[0].body).toEqual({ ids: [rows[0].id], changes: { status: 'Pending Review' }, dry_run: false, atomic: true });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('a refused edit changes nothing and keeps the dialog open with the reason', async () => {
    const { dialog } = await editStatus(bulk.sequences_update_ids_refused, 'Approved');
    expect(await within(dialog).findByText('Nothing changed: 1 of 1 rows were refused (status: "Nope" is not a valid choice.).')).toBeTruthy();
  });
});
