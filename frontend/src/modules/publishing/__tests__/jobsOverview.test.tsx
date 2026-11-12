import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
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
import { JobHistory } from '../JobHistory';
import { usePublishListConfig } from '../jobs';
import { PublishStats } from '../PublishStats';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('publishing/_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const artist = auth.me_artist.body as unknown as User;

const path = (c: MockCall) => new URL(c.url).pathname;
const param = (c: MockCall, name: string) => new URL(c.url).searchParams.get(name);
const page = (results: unknown[], count = results.length): MockReply => ({ status: 200, body: { count, next: null, previous: null, results } });

function mount(ui: React.ReactElement) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AuthContext.Provider value={{ user: artist, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
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

describe('job summary', () => {
  const byStatus: Record<string, number> = { Pending: 2, Validating: 1, Validated: 0, Exporting: 1, Exported: 6, Failed: 2, Cancelled: 3 };
  const serve = (c: MockCall): MockReply => (path(c).endsWith('/publishing/') ? page(flow.jobs_list.body.results.slice(0, 1), byStatus[param(c, 'job_status') ?? ''] ?? 0) : page([]));

  it('counts the jobs by status with one small request each, and works out the success rate of the finished ones', async () => {
    const { calls } = mockFetch(serve);
    mount(<PublishStats filters={{}} />);
    const tiles = within(await screen.findByLabelText('Job summary'));
    const value = (label: string) => tiles.getByText(label).nextElementSibling?.textContent;
    expect(value('Jobs')).toBe('15');
    expect(value('Running')).toBe('4'); // pending, validating, validated and exporting
    expect(value('Exported')).toBe('6');
    expect(value('Failed')).toBe('2');
    expect(value('Cancelled')).toBe('3');
    expect(value('Success rate')).toBe('75%'); // 6 of the 8 that finished
    const asked = calls.filter((c) => path(c).endsWith('/publishing/'));
    expect(asked).toHaveLength(7);
    expect(asked.every((c) => param(c, 'page_size') === '1')).toBe(true);
    expect(asked.every((c) => param(c, 'project_id') === null)).toBe(true);
  });

  it('is narrowed to the project of the list, and has no success rate before anything has finished', async () => {
    const { calls } = mockFetch((c) => (path(c).endsWith('/publishing/') ? page([], param(c, 'job_status') === 'Pending' ? 3 : 0) : page([])));
    mount(<PublishStats filters={{ project_id: 'proj-1' }} />);
    const tiles = within(await screen.findByLabelText('Job summary'));
    expect(calls.filter((c) => path(c).endsWith('/publishing/')).every((c) => param(c, 'project_id') === 'proj-1')).toBe(true);
    expect(tiles.getByText('Success rate').nextElementSibling?.textContent).toBe('—');
    expect(tiles.getByText('Running').nextElementSibling?.textContent).toBe('3');
  });

  it('sits above the jobs list and follows the project filter set on it', async () => {
    mockFetch(serve);
    const List = () => <DirectoryListPage config={usePublishListConfig({ projectId: 'proj-1' })} />;
    mount(<List />);
    expect(await screen.findByLabelText('Job summary')).toBeTruthy();
    expect(await screen.findByRole('table', { name: 'Publishing' })).toBeTruthy();
  });
});

describe('job history', () => {
  const job = flow.jobs_detail_artist.body;
  const row = flow.jobs_list.body.results[0];
  const make = (id: string, code: string, created: string, over: Record<string, unknown> = {}) => ({ ...row, id, code, name: `Export ${code}`, entity_type: job.entity_type, entity_code: job.entity_code, created_at: created, job_status: 'Exported', ...over });
  const history = [make('older', 'PUB-0001', '2026-10-01T10:00:00Z'), make(job.id, job.code, '2026-10-05T10:00:00Z'), make('newest', 'PUB-0009', '2026-10-09T10:00:00Z', { job_status: 'Failed' })];
  const others = [make('other-shot', 'PUB-0100', '2026-10-06T10:00:00Z', { entity_code: 'ANOTHER' }), make('other-kind', 'PUB-0101', '2026-10-07T10:00:00Z', { entity_type: job.entity_type === 'Shot' ? 'Asset' : 'Shot' })];

  it('lists the jobs for the same shot or asset newest first, marks this one, and leaves out other shots and other kinds', async () => {
    const { calls } = mockFetch((c) => (path(c).endsWith('/publishing/') ? page([...history, ...others]) : page([])));
    mount(<JobHistory job={job} />);
    const list = within(await screen.findByRole('list', { name: `Jobs for ${job.entity_code}` }));
    const items = list.getAllByRole('listitem');
    expect(items.map((li) => li.textContent?.match(/PUB-\d+|PUB-[A-Z0-9-]+/)?.[0])).toEqual(['PUB-0009', job.code, 'PUB-0001']);
    expect(items[1].getAttribute('aria-current')).toBe('true');
    expect(within(items[1]).getByText('This job')).toBeTruthy();
    expect(within(items[0]).getByRole('link', { name: /PUB-0009/ }).getAttribute('href')).toBe('/publishing/newest');
    expect(within(items[1]).queryByRole('link')).toBeNull(); // this job is not a link to itself
    expect(list.queryByText(/PUB-0100|PUB-0101/)).toBeNull();
    const call = calls.find((c) => path(c).endsWith('/publishing/')) as MockCall;
    expect(param(call, 'search')).toBe(job.entity_code);
    expect(screen.getByText(/does not record which job it came from/)).toBeTruthy();
  });

  it('says so when a job names no shot or asset, without asking for anything', async () => {
    const { calls } = mockFetch(() => page([]));
    mount(<JobHistory job={{ ...job, entity_code: '' }} />);
    expect(screen.getByText(/names no shot or asset/)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });
});
