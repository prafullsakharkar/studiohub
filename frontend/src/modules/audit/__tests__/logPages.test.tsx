import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { apiRequestsConfig, backgroundJobsConfig, changeLogsConfig, errorLogsConfig } from '../viewer/configs';
import { LogListPage } from '../viewer/LogListPage';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('audit/_audit_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

function renderPage(ui: React.ReactElement, user: User) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter>{ui}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('change log page', () => {
  it('lists changes with the actor and opens the before/after diff', async () => {
    const { calls } = mockFetch(() => reply(flow.changelogs_all));
    renderPage(<LogListPage config={changeLogsConfig} />, superuser);
    const rows = flow.changelogs_all.body.results as Array<{ id: string; change_type: string; target_type: string; target_name: string }>;
    const first = rows[0];
    expect(await screen.findByRole('table', { name: 'Change log' })).toBeTruthy();
    expect(path(calls[0])).toBe('/api/v1/audit/change-logs/');
    expect(q(calls[0])).toMatchObject({ page: '1', page_size: '25' });

    fireEvent.click(screen.getAllByRole('button', { name: /^Details of/ })[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('table', { name: /Changes in/ })).toBeTruthy();
    expect(first).toBeTruthy();
  });

  it('sends the route’s own filter names and the created_at window', async () => {
    const { calls } = mockFetch(() => reply(flow.changelogs_all));
    renderPage(<LogListPage config={changeLogsConfig} />, superuser);
    await screen.findByRole('table', { name: 'Change log' });

    fireEvent.change(screen.getByLabelText('Filter by change'), { target: { value: 'update' } });
    await waitFor(() => expect(calls.some((c) => q(c).change_type === 'update')).toBe(true));

    const typeFilter = screen.getByLabelText('Filter by record type');
    fireEvent.change(typeFilter, { target: { value: 'Department' } });
    fireEvent.keyDown(typeFilter, { key: 'Enter' });
    await waitFor(() => expect(calls.some((c) => q(c).target_type === 'Department')).toBe(true));

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-31' } });
    await waitFor(() => expect(calls.some((c) => q(c).created_at__gte === '2026-10-01' && q(c).created_at__lte === '2026-10-31')).toBe(true));
  });

  it('says the API refused when the caller lacks audit.view (403)', async () => {
    mockFetch(() => reply(flow.artist_changelogs));
    renderPage(<LogListPage config={changeLogsConfig} />, artist);
    expect((await screen.findAllByText(/permission/i)).length).toBeGreaterThan(0);
  });
});

describe('api requests', () => {
  it('filters by method and status code on the server', async () => {
    const { calls } = mockFetch(() => reply(flow.api_requests));
    renderPage(<LogListPage config={apiRequestsConfig} />, superuser);
    await screen.findByRole('table', { name: 'API requests' });
    fireEvent.change(screen.getByLabelText('Filter by method'), { target: { value: 'PATCH' } });
    await waitFor(() => expect(calls.some((c) => q(c).method === 'PATCH')).toBe(true));
  });
});

describe('background jobs and error log actions', () => {
  const jobs = flow.jobs_list.body.results as Array<{ id: string; job_id: string; status: string }>;
  const queued = jobs.find((j) => j.status === 'cancelled' || j.status === 'queued') as { id: string; job_id: string; status: string };

  it('Cancel is offered only on queued/running jobs and Retry only on failed ones, and each posts to its route', async () => {
    const rows = [
      { ...jobs[0], id: 'j-queued', job_id: 'job-queued', status: 'queued' },
      { ...jobs[0], id: 'j-failed', job_id: 'job-failed', status: 'failed' },
      { ...jobs[0], id: 'j-done', job_id: 'job-done', status: 'completed' },
    ];
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { body: rows[0] } : { body: { count: 3, next: null, previous: null, results: rows } }));
    renderPage(<LogListPage config={backgroundJobsConfig} />, superuser);
    await screen.findByRole('button', { name: /^Cancel job report job-queued/ });
    expect(screen.queryByRole('button', { name: /^Cancel job report job-failed/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Retry report job-failed/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Retry report job-done/ })).toBeNull();
    expect(queued).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^Retry report job-failed/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe('/api/v1/audit/background-jobs/j-failed/retry/');
  });

  it('hides every action from a caller without audit.update', async () => {
    const rows = [{ ...jobs[0], id: 'j-failed', job_id: 'job-failed', status: 'failed' }];
    mockFetch(() => ({ body: { count: 1, next: null, previous: null, results: rows } }));
    renderPage(<LogListPage config={backgroundJobsConfig} />, artist);
    await screen.findByRole('table', { name: 'Background jobs' });
    expect(screen.queryByRole('button', { name: /^Retry/ })).toBeNull();
  });

  it('resolving an error posts to the resolve route', async () => {
    const err = (flow.errors_list.body.results as Array<{ id: string; resolved: boolean; error_type: string; message: string }>)[0];
    const open = { ...err, resolved: false };
    const { calls } = mockFetch((c) => (c.method === 'POST' ? { body: { status: 'resolved' } } : { body: { count: 1, next: null, previous: null, results: [open] } }));
    renderPage(<LogListPage config={errorLogsConfig} />, superuser);
    fireEvent.click(await screen.findByRole('button', { name: /^Resolve/ }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(path(calls.find((c) => c.method === 'POST')!)).toBe(`/api/v1/audit/error-logs/${open.id}/resolve/`);
  });
});
