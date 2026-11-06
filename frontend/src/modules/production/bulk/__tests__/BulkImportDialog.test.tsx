import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { useSequencesListConfig } from '../../structure/lists';

/**
 * CR-48 from the Sequences list: Bulk create / update from a CSV file, a dry run, the per-row preview, the commit and the
 * error report, and "Edit fields" on the selected rows. Every answer is a captured one (`_bulk_cr48_flow.json`).
 */
type Captured = { status: number; body: any; request: { body: any } };
const bulk = loadSample<Record<string, Captured>>('production/_bulk_cr48_flow.json');
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const standard = bulk.projects_detail_standard.body as { id: string; code: string };
const episodic = bulk.projects_detail_episodic.body as { id: string; code: string };
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
    return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
  };
}

function List({ projectId }: { projectId: string }) {
  return <DirectoryListPage config={useSequencesListConfig({ projectId })} />;
}

function renderList(projectId: string, user: User = superuser) {
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
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: (b: Blob) => (blobs.push(b), 'blob:x'), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

async function openBulk(entry: 'create' | 'update') {
  fireEvent.click(await screen.findByRole('button', { name: /^Bulk/ }));
  fireEvent.click(await screen.findByText(`Bulk ${entry} sequences…`));
  return screen.findByRole('dialog');
}

function upload(dialog: HTMLElement, text: string) {
  const file = new File([text], 'rows.csv', { type: 'text/csv' });
  fireEvent.change(within(dialog).getByLabelText('CSV file'), { target: { files: [file] } });
}

describe('Bulk menu', () => {
  it('offers create and update on a project the caller may write', async () => {
    mockFetch(server(() => bulk.sequences_create_dry_run_ok));
    renderList(standard.id);
    fireEvent.click(await screen.findByRole('button', { name: /^Bulk/ }));
    expect(screen.getByText('Bulk create sequences…')).toBeTruthy();
    expect(screen.getByText('Bulk update sequences…')).toBeTruthy();
  });

  it('is not offered without the sequence create and update codes', async () => {
    const { calls } = mockFetch(server(() => bulk.sequences_create_dry_run_ok));
    renderList(standard.id, artist);
    await waitFor(() => expect(calls.some((c) => path(c) === `/api/v1/projects/${standard.id}/`)).toBe(true));
    await screen.findByRole('table', { name: 'Sequences' });
    expect(screen.queryByRole('button', { name: /^Bulk/ })).toBeNull();
  });

  it('each entry follows its own code: with sequence.update only, only Bulk update', async () => {
    mockFetch(server(() => bulk.sequences_create_dry_run_ok));
    // A member of the project (as in useCan.test) whose roles add sequence.update.
    renderList(standard.id, { ...artist, permissions: [...artist.permissions, 'sequence.update'], project_memberships: [{ project_id: standard.id, status: 'active' }] } as unknown as User);
    fireEvent.click(await screen.findByRole('button', { name: /^Bulk/ }));
    expect(screen.getByText('Bulk update sequences…')).toBeTruthy();
    expect(screen.queryByText('Bulk create sequences…')).toBeNull();
  });

  it('the template has an episode column on an episodic project only', async () => {
    mockFetch(server(() => bulk.sequences_create_dry_run_ok));
    renderList(standard.id);
    let dialog = await openBulk('create');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download template' }));
    expect(await blobs[0].text()).toBe('code,name,description,frame_in,frame_out,status\r\n');
    cleanup();

    renderList(episodic.id);
    dialog = await openBulk('create');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Download template' }));
    expect(await blobs[1].text()).toBe('code,name,description,episode,frame_in,frame_out,status\r\n');
  });
});

describe('bulk create', () => {
  it('checks the file by a dry run, shows each row, then stores it all or nothing', async () => {
    const { calls } = mockFetch(server((c) => ((c.body as { dry_run: boolean }).dry_run ? bulk.sequences_create_dry_run_ok : bulk.sequences_create_commit)));
    renderList(standard.id);
    const dialog = await openBulk('create');
    upload(dialog, 'code,name,frame_in,frame_out\nSQ020,Chase,,\nSQ030,,1001,1100\n');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Check rows' }));

    await within(dialog).findByText(/2 of 2 rows can be created\. Nothing has been stored yet\./);
    const [check] = posts(calls, 'bulk-create');
    expect(check.body).toEqual({
      project_id: standard.id,
      dry_run: true,
      atomic: true,
      items: [
        { code: 'SQ020', action: 'create', data: { name: 'Chase' } },
        { code: 'SQ030', action: 'create', data: { frame_in: 1001, frame_out: 1100 } },
      ],
    });
    const table = within(dialog).getByRole('table', { name: 'Checked rows' });
    expect(within(table).getAllByText('Create')).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create 2 sequences' }));
    expect(await within(dialog).findByRole('status')).toHaveProperty('textContent', '2 sequences stored.');
    const commit = posts(calls, 'bulk-create')[1];
    expect(commit.body).toMatchObject({ dry_run: false, atomic: true });
    // The list is read again.
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET' && path(c) === '/api/v1/sequences/').length).toBeGreaterThan(1));
  });

  it('rows the backend refuses block the commit until "Skip invalid rows"; their reasons download as CSV', async () => {
    const { calls } = mockFetch(server((c) => ((c.body as { dry_run: boolean }).dry_run ? bulk.sequences_create_dry_run_errors : bulk.sequences_create_skip_invalid)));
    renderList(standard.id);
    const dialog = await openBulk('create');
    upload(dialog, 'code,frame_in,frame_out\nSQ010,,\nSQ040,,\nSQ040,,\nBAD CODE,,\nSQ050,1100,1001\n');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Check rows' }));

    await within(dialog).findByText(/1 of 5 rows can be created; 4 cannot\./);
    expect(within(dialog).getByText('code: A record with this code already exists.')).toBeTruthy();
    expect(within(dialog).getByText('frame_out: Must not be before frame_in.')).toBeTruthy();
    const commit = within(dialog).getByRole('button', { name: 'Create 1 sequence' }) as HTMLButtonElement;
    expect(commit.disabled).toBe(true);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Download error report' }));
    expect((await blobs[0].text()).split('\r\n')[1]).toBe('1,SQ010,code,A record with this code already exists.');

    fireEvent.click(within(dialog).getByLabelText(/Skip invalid rows/));
    expect(commit.disabled).toBe(false);
    fireEvent.click(commit);
    await within(dialog).findByRole('status');
    expect(posts(calls, 'bulk-create')[1].body).toMatchObject({ dry_run: false, atomic: false });
  });

  it('a batch that fails at commit time stores nothing and says so', async () => {
    mockFetch(server((c) => ((c.body as { dry_run: boolean }).dry_run ? bulk.sequences_create_dry_run_ok : bulk.sequences_create_atomic_fails)));
    renderList(standard.id);
    const dialog = await openBulk('create');
    upload(dialog, 'code\nSQ020\nSQ030\n');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Check rows' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Create 2 sequences' }));
    expect((await within(dialog).findByRole('status')).textContent).toBe('Nothing was stored: 1 rows failed. Check the rows again.');
  });

  it('refuses an unknown column and more than 500 rows before sending anything', async () => {
    const { calls } = mockFetch(server(() => bulk.sequences_create_dry_run_ok));
    renderList(standard.id);
    const dialog = await openBulk('create');
    upload(dialog, 'code,colour\nSQ010,red\n');
    expect(await within(dialog).findByText(/^Unknown column "colour"/)).toBeTruthy();
    upload(dialog, ['code', ...Array.from({ length: 501 }, (_, n) => `SQ${n}`)].join('\n'));
    expect(await within(dialog).findByText(/^At most 500 rows at a time; this has 501/)).toBeTruthy();
    expect((within(dialog).getByRole('button', { name: 'Check rows' }) as HTMLButtonElement).disabled).toBe(true);
    expect(posts(calls, 'bulk-create')).toHaveLength(0);
  });

  it('shows the backend refusal of the whole request', async () => {
    mockFetch(server(() => bulk.sequences_create_over_limit));
    renderList(standard.id);
    const dialog = await openBulk('create');
    upload(dialog, 'code\nSQ020\n');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Check rows' }));
    expect((await within(dialog).findByRole('alert')).textContent).toBe('At most 500 items per request.');
  });
});

describe('bulk update', () => {
  it('matches rows by code and sends only the filled-in fields', async () => {
    const { calls } = mockFetch(server((c) => ((c.body as { dry_run: boolean }).dry_run ? bulk.sequences_update_dry_run : bulk.sequences_update_commit)));
    renderList(standard.id);
    const dialog = await openBulk('update');
    upload(dialog, 'code,name,description\nSQ010,,Re-cut\nNOPE,x,\n');
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Check rows' }));
    await within(dialog).findByText(/1 of 2 rows can be updated; 1 cannot\./);
    expect(posts(calls, 'bulk-update')[0].body).toEqual(bulk.sequences_update_dry_run.request.body);
    expect(within(dialog).getByText('Sequence not found.')).toBeTruthy();
    expect(within(dialog).getByText('Update')).toBeTruthy();
  });
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
