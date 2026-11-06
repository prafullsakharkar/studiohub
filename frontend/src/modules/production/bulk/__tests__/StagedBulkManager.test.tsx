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
import { useAssetsListConfig } from '../../work/assets';
import { useTasksListConfig } from '../../work/tasks';

/**
 * "Bulk add sequences" in the steps of the shot manager: grid → Validate (batch duplicates, check-existence, a dry run
 * of the new rows) → Resolve (new, soft-deleted, active existing, batch duplicates, errors) → Preview → Execute →
 * Result. Every answer is a captured one.
 */
type Captured = { status: number; body: any; request: { body: any } };
const bulk = loadSample<Record<string, Captured>>('production/_bulk_cr48_flow.json');
const structure = loadSample<Record<string, Captured>>('production/_structure_flow.json');
const work = loadSample<Record<string, Captured>>('production/_work_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;
const standard = bulk.projects_detail_standard.body as { id: string; code: string };
const episodic = bulk.projects_detail_episodic.body as { id: string; code: string };

const path = (c: MockCall) => new URL(c.url).pathname;
/**
 * New codes start with the project's (`STD_SQ010`), while the captured answers name the bare codes the backend was asked
 * about. The same captures with their codes prefixed are what the backend would answer to the prefixed request.
 */
const prefixed = <T,>(value: T, project: { code: string }): T => JSON.parse(JSON.stringify(value), (key, v) => (key === 'code' && typeof v === 'string' ? `${project.code}_${v}` : v));
const reply = (c: Captured, project?: { code: string }): MockReply => ({ status: c.status, body: project ? prefixed(c.body, project) : c.body });
const projectOf = (c: MockCall) => ((c.body as { project_id?: string }).project_id === episodic.id ? episodic : standard);
const posts = (calls: MockCall[], route: string) => calls.filter((c) => c.method === 'POST' && path(c) === `/api/v1/sequences/${route}/`);

function server({ dryRun, commit }: { dryRun: Captured; commit?: Captured }) {
  return (c: MockCall): MockReply => {
    const p = path(c);
    if (c.method === 'POST' && p === '/api/v1/sequences/check-existence/') return reply(structure.sequences_check_existence, projectOf(c));
    if (c.method === 'POST' && p === '/api/v1/sequences/bulk-create/') return reply((c.body as { dry_run?: boolean }).dry_run ? dryRun : (commit ?? dryRun), projectOf(c));
    if (p === `/api/v1/projects/${standard.id}/`) return reply(bulk.projects_detail_standard);
    if (p === `/api/v1/projects/${episodic.id}/`) return reply(bulk.projects_detail_episodic);
    if (p === '/api/v1/episodes/') return reply(bulk.episodes_of_episodic);
    if (p === '/api/v1/sequences/') return reply(structure.sequences_list_after_bulk);
    return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
  };
}

function renderList(projectId: string | undefined, user: User = superuser) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  function List() {
    return <DirectoryListPage config={useSequencesListConfig(projectId ? { projectId } : undefined)} />;
  }
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>
          <List />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
  useProductionStore.setState({ activeProjectId: null });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
});

async function openManager() {
  const button = await screen.findByRole('button', { name: 'Bulk add sequences' });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
  return screen.findByRole('dialog');
}
function upload(dialog: HTMLElement, text: string) {
  fireEvent.change(within(dialog).getByLabelText('CSV file'), { target: { files: [new File([text], 'rows.csv', { type: 'text/csv' })] } });
}
const pill = (dialog: HTMLElement, label: RegExp) => within(dialog).getByRole('button', { name: label });

describe('Bulk add sequences', () => {
  it('is offered on the project, and on the Sequences page for the active project; not without sequence.create', async () => {
    mockFetch(server({ dryRun: bulk.sequences_create_dry_run_ok }));
    renderList(standard.id);
    expect(await screen.findByRole('button', { name: 'Bulk add sequences' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Bulk$/ })).toBeNull();
    cleanup();

    useProductionStore.setState({ activeProjectId: standard.id });
    renderList(undefined);
    expect(await screen.findByRole('button', { name: 'Bulk add sequences' })).toBeTruthy();
    cleanup();

    renderList(standard.id, artist);
    await screen.findByRole('table', { name: 'Sequences' });
    expect(screen.queryByRole('button', { name: 'Bulk add sequences' })).toBeNull();
  });

  it('validate sorts the rows into new, active existing and batch duplicates; execute creates the new and skips the rest', async () => {
    const { calls } = mockFetch(server({ dryRun: bulk.sequences_create_dry_run_ok, commit: bulk.sequences_create_commit }));
    renderList(standard.id);
    const dialog = await openManager();
    // SQ010 is in the project already (check-existence); SQ020 twice in the file.
    upload(dialog, 'code,name\nSQ010,Opening\nSQ020,Chase\nSQ020,Again\n');
    await within(dialog).findByDisplayValue('Chase');
    fireEvent.click(within(dialog).getByRole('button', { name: /Validate/ }));

    expect(await within(dialog).findByText('Batch Validation Breakdown')).toBeTruthy();
    expect(posts(calls, 'check-existence')[0].body).toEqual({ project_id: standard.id, codes: ['STD_SQ010', 'STD_SQ020'] });
    // Only the row still new is dry-run.
    expect(posts(calls, 'bulk-create')[0].body).toEqual({ project_id: standard.id, dry_run: true, atomic: false, items: [{ code: 'STD_SQ020', action: 'create', data: { name: 'Chase' } }] });
    expect(pill(dialog, /New \(Create\)\s*1/)).toBeTruthy();
    expect(pill(dialog, /Active Existing\s*1/)).toBeTruthy();
    expect(pill(dialog, /Batch Duplicates\s*1/)).toBeTruthy();
    expect(pill(dialog, /Validation Errors\s*0/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: /Review Execution Preview/ }));
    fireEvent.click(await within(dialog).findByRole('button', { name: /Execute Bulk Operation \(1\)/ }));
    await waitFor(() => expect(posts(calls, 'bulk-create')).toHaveLength(2));
    expect(posts(calls, 'bulk-create')[1].body).toEqual({
      project_id: standard.id,
      items: [
        { code: 'STD_SQ010', action: 'skip', data: {} },
        { code: 'STD_SQ020', action: 'create', data: { name: 'Chase' } },
        { code: 'STD_SQ020', action: 'skip', data: {} },
      ],
    });
    expect(await within(dialog).findByText(/2 created/)).toBeTruthy();
  });

  it('a row the backend would refuse is a validation error before anything is stored', async () => {
    const { calls } = mockFetch(server({ dryRun: bulk.sequences_create_episodic_dry_run }));
    renderList(episodic.id);
    const dialog = await openManager();
    upload(dialog, 'code,episode\nSQA,EP101\nSQB,\n');
    await within(dialog).findByDisplayValue('SQB');
    fireEvent.click(within(dialog).getByRole('button', { name: /Validate/ }));

    expect(await within(dialog).findByText('Batch Validation Breakdown')).toBeTruthy();
    expect(posts(calls, 'bulk-create')[0].body.items).toEqual(prefixed(bulk.sequences_create_episodic_dry_run.request.body.items, episodic));
    expect(pill(dialog, /New \(Create\)\s*1/)).toBeTruthy();
    expect(pill(dialog, /Validation Errors\s*1/)).toBeTruthy();
    expect(within(dialog).getByText('episode: An episode is required for sequences on episodic projects.')).toBeTruthy();
    expect(posts(calls, 'bulk-create')).toHaveLength(1);
  });

  it('Load Template fills the grid with the project\'s own episode', async () => {
    mockFetch(server({ dryRun: bulk.sequences_create_dry_run_ok }));
    renderList(episodic.id);
    const dialog = await openManager();
    fireEvent.click(await within(dialog).findByRole('button', { name: /Load Template/ }));
    expect(await within(dialog).findByDisplayValue('SQ010')).toBeTruthy();
    expect(within(dialog).getAllByDisplayValue('EP101')).toHaveLength(3);
  });

  it('an unknown column is refused before anything is sent', async () => {
    const { calls } = mockFetch(server({ dryRun: bulk.sequences_create_dry_run_ok }));
    renderList(standard.id);
    const dialog = await openManager();
    upload(dialog, 'code,colour\nSQ010,red\n');
    expect(await within(dialog).findByText(/^Unknown column "colour"/)).toBeTruthy();
    expect(posts(calls, 'check-existence')).toHaveLength(0);
  });
});

describe.each([
  {
    plural: 'assets',
    useConfig: useAssetsListConfig,
    existence: work.assets_check_existence,
    dryRun: bulk.assets_create_dry_run,
    csv: 'code,name,asset_type,category\nHERO,Hero,,Character\nPROP1,Prop,NOPE,\nPROP2,,,\n',
    errors: 2,
  },
  {
    plural: 'tasks',
    useConfig: useTasksListConfig,
    existence: work.tasks_check_existence,
    dryRun: bulk.tasks_create_dry_run,
    csv: 'code,title,entity_type,entity\nCOMP010,Comp,Shot,SH010\nCOMP020,Comp,Shot,SH999\n',
    errors: 1,
  },
])('Bulk add $plural', ({ plural, useConfig, existence, dryRun, csv, errors }) => {
  it('validates on its own routes and shows the backend\'s refusals as validation errors', async () => {
    const { calls } = mockFetch((c) => {
      const p = path(c);
      if (c.method === 'POST' && p === `/api/v1/${plural}/check-existence/`) return reply(existence, standard);
      if (c.method === 'POST' && p === `/api/v1/${plural}/bulk-create/`) return reply(dryRun, standard);
      if (p === `/api/v1/projects/${standard.id}/`) return reply(bulk.projects_detail_standard);
      return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    function List() {
      return <DirectoryListPage config={useConfig({ projectId: standard.id })} />;
    }
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter>
            <List />
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    const button = await screen.findByRole('button', { name: `Bulk add ${plural}` });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    const dialog = await screen.findByRole('dialog');
    upload(dialog, csv);
    await waitFor(() => expect(within(dialog).getAllByRole('row').length).toBeGreaterThan(1));
    fireEvent.click(within(dialog).getByRole('button', { name: /Validate/ }));

    expect(await within(dialog).findByText('Batch Validation Breakdown')).toBeTruthy();
    const dry = calls.find((c) => c.method === 'POST' && path(c) === `/api/v1/${plural}/bulk-create/`);
    expect((dry?.body as { items: unknown } | undefined)?.items).toEqual(prefixed(dryRun.request.body.items, standard));
    expect(pill(dialog, /New \(Create\)\s*1/)).toBeTruthy();
    expect(pill(dialog, new RegExp(`Validation Errors\\s*${errors}`))).toBeTruthy();
  });
});

