import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import type { User } from '@/types/identity';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { CreateDepartmentPage } from '../pages/CreateDepartmentPage';
import { DepartmentsListPage } from '../pages/DepartmentsListPage';

const flow = loadSample('masterdata/_departments_flow.json');
const conflicts = loadSample('_misc/conflicts_and_pagination.json');
const auth = loadSample('identity/_auth_flow.json');
const people = loadSample('masterdata/people.json').list_admin;

const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;
const reply = (c: { status: number; body: unknown }): MockReply => ({ status: c.status, body: c.body });

const Where = () => <div data-testid="where">{useLocation().pathname}</div>;

function renderPage(element: React.ReactElement, user: User, path = '/departments', routePath = '/departments') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user } as AuthContextValue}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={routePath} element={element} />
            <Route path="*" element={<Where />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const q = (call: MockCall) => Object.fromEntries(new URL(call.url).searchParams);
const path = (call: MockCall) => new URL(call.url).pathname;

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a1', refresh: 'r1' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Serves the captured list responses by query string. */
const listServer = (call: MockCall): MockReply => {
  const params = q(call);
  if (params.search === 'comp') return reply(flow.list_search_comp);
  if (params.search === 'zzzz') return reply(flow.list_search_no_match);
  if (params.department_type === 'technical') return reply(flow.list_filter_type);
  if (params.ordering === '-name') return reply(flow.list_ordering_name_desc);
  if (params.page === '2') return reply(flow.list_page_2_of_size_2);
  if (params.page_size === '2') return reply(flow.list_page_size_2);
  return reply(flow.list_default);
};

describe('departments list', () => {
  it('loads the first page server-side, sorted by name', async () => {
    const { calls } = mockFetch(listServer);
    renderPage(<DepartmentsListPage />, superuser);

    expect(await screen.findByText('Compositing')).toBeTruthy();
    expect(path(calls[0])).toBe('/api/v1/departments/');
    expect(q(calls[0])).toEqual({ page: '1', page_size: '25', ordering: 'name' });
    expect(screen.getByText(/6 Registered/)).toBeTruthy();
  });

  it('searches on the server (debounced), not by filtering the loaded page', async () => {
    const { calls } = mockFetch(listServer);
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');

    fireEvent.change(screen.getByPlaceholderText(/search name or code/i), { target: { value: 'comp' } });
    await waitFor(() => expect(calls.some((c) => q(c).search === 'comp')).toBe(true));
    await waitFor(() => expect(screen.getByText(/1 Matching/)).toBeTruthy());
    expect(screen.queryByText('Pipeline TD')).toBeNull();
  });

  it('shows the empty state for a search with no results', async () => {
    mockFetch(listServer);
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');
    fireEvent.change(screen.getByPlaceholderText(/search name or code/i), { target: { value: 'zzzz' } });
    expect(await screen.findByText('No departments match your filters')).toBeTruthy();
  });

  it('filters by type on the server', async () => {
    const { calls } = mockFetch(listServer);
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');
    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'technical' } });
    await waitFor(() => expect(calls.some((c) => q(c).department_type === 'technical')).toBe(true));
    expect(await screen.findByText('Pipeline TD')).toBeTruthy();
  });

  it('pages through the full list (more than one page)', async () => {
    // Real page shapes, with the total raised so that 25 per page really means several pages.
    const asPage = (sample: { body: unknown }) => ({ body: { ...(sample.body as object), count: 60 } });
    const { calls } = mockFetch((call) => (q(call).page === '2' ? asPage(flow.list_page_2_of_size_2) : asPage(flow.list_page_size_2)));
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');
    expect(screen.getByText(/60 Registered/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(calls.some((c) => q(c).page === '2')).toBe(true));
    expect(await screen.findByText('FX')).toBeTruthy();
  });

  it('shows an error with a retry, then recovers', async () => {
    let failures = 3; // first attempt + the two automatic retries
    // A 5xx is retried twice with backoff (~3 s) before the error state is shown; that is intended.
    mockFetch((call) => (failures-- > 0 ? { status: 500, body: { detail: 'boom', error: { code: 'server_error', request_id: 'req-77' } } } : listServer(call)));
    renderPage(<DepartmentsListPage />, superuser);

    fireEvent.click(await screen.findByRole('button', { name: /try again/i }, { timeout: 8000 }));
    expect(screen.queryByText(/Registered/)).toBeNull(); // no "0 Registered" while the list failed to load
    expect(await screen.findByText('Compositing')).toBeTruthy();
  });

  it('shows a permission state, not an empty list, for a 403', async () => {
    mockFetch(() => ({ status: 403, body: { detail: 'You do not have permission to perform this action.' } }));
    renderPage(<DepartmentsListPage />, artist);
    expect(await screen.findByText(/Permission Denied/i)).toBeTruthy();
  });
});

describe('departments permissions in the UI', () => {
  it('hides Add and Delete for a user without masterdata.directory.manage (reads stay open)', async () => {
    mockFetch(() => reply(flow.list_as_artist));
    renderPage(<DepartmentsListPage />, artist);
    await screen.findByText('Compositing');
    expect(screen.queryByRole('link', { name: /add department/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
  });

  it('offers them to a manager', async () => {
    mockFetch(listServer);
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');
    expect(screen.getByRole('link', { name: /add department/i })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /delete/i }).length).toBeGreaterThan(0);
  });
});

describe('departments delete', () => {
  it('deletes after confirmation and reloads the list', async () => {
    const { calls } = mockFetch((call) => (call.method === 'DELETE' ? { status: 204 } : listServer(call)));
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(path(calls.find((c) => c.method === 'DELETE')!)).toMatch(/^\/api\/v1\/departments\/[0-9a-f-]{36}\/$/);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('explains a blocked delete (409 has_dependants) and keeps the dialog open', async () => {
    mockFetch((call) => (call.method === 'DELETE' ? reply(conflicts.department_delete_referenced) : listServer(call)));
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');

    fireEvent.click(screen.getAllByRole('button', { name: /^delete$/i })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain('masterdata.Position.department (2)');
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('departments export', () => {
  it('exports every row matching the current search, ignoring the visible page', async () => {
    const urls: string[] = [];
    // Only the static helpers: replacing the whole URL class would break every `new URL()`.
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      urls.push(this.download);
    });
    const { calls } = mockFetch(listServer);
    renderPage(<DepartmentsListPage />, superuser);
    await screen.findByText('Compositing');
    fireEvent.change(screen.getByPlaceholderText(/search name or code/i), { target: { value: 'comp' } });
    await screen.findByText(/1 Matching/);

    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(urls).toEqual(['departments.csv']));
    const exportCalls = calls.filter((c) => q(c).page_size === '500');
    expect(exportCalls.length).toBeGreaterThan(0);
    expect(exportCalls.every((c) => q(c).search === 'comp' && q(c).ordering === 'name')).toBe(true);
  });
});

describe('create department', () => {
  const fill = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const pickerServer = (call: MockCall): MockReply => {
    if (call.method === 'POST') return reply(flow.create_ok);
    if (path(call) === '/api/v1/people/') return { body: { count: 1, next: null, previous: null, results: (people.body as { results: unknown[] }).results.slice(0, 1) } };
    return reply(flow.list_default);
  };

  it('validates required fields before calling the API', async () => {
    const { calls } = mockFetch(pickerServer);
    renderPage(<CreateDepartmentPage />, superuser, '/departments/new', '/departments/new');
    fireEvent.click(await screen.findByRole('button', { name: /create department/i }));

    expect(await screen.findByText('Name is required')).toBeTruthy();
    expect(screen.getByText('Code is required')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('rejects a code longer than the model allows (30)', async () => {
    mockFetch(pickerServer);
    renderPage(<CreateDepartmentPage />, superuser, '/departments/new', '/departments/new');
    fill(/^Name/, 'X');
    fill(/^Code/, 'C'.repeat(31));
    fireEvent.click(screen.getByRole('button', { name: /create department/i }));
    expect(await screen.findByText(/at most 30 characters/)).toBeTruthy();
  });

  it('posts only fields the backend has, then opens the new department', async () => {
    const { calls } = mockFetch(pickerServer);
    renderPage(<CreateDepartmentPage />, superuser, '/departments/new', '/departments/new');
    fill(/^Name/, 'Lookdev');
    fill(/^Code/, 'DEPT-LOOK');
    fill(/Software stack/, 'Katana, USD');
    fireEvent.click(screen.getByRole('button', { name: /create department/i }));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(`/departments/${(flow.create_ok.body as { id: string }).id}`));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe('/api/v1/departments/');
    expect(post.body).toEqual({
      name: 'Lookdev',
      code: 'DEPT-LOOK',
      department_type: 'creative',
      description: '',
      color: '#6366f1',
      parent: null,
      manager: null,
      software_stack: ['Katana', 'USD'],
    });
  });

  it('shows the backend’s duplicate errors inline, on both fields (real 400)', async () => {
    mockFetch((call) => (call.method === 'POST' ? reply(flow.create_duplicate_code) : pickerServer(call)));
    renderPage(<CreateDepartmentPage />, superuser, '/departments/new', '/departments/new');
    fill(/^Name/, 'Lookdev');
    fill(/^Code/, 'DEPT-LOOK');
    fireEvent.click(screen.getByRole('button', { name: /create department/i }));

    expect(await screen.findByText('A department with this code already exists.')).toBeTruthy();
    expect(screen.getByText('A department with this name already exists.')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull(); // stayed on the form
  });

  it('shows the 403 for a user who cannot create', async () => {
    mockFetch((call) => (call.method === 'POST' ? reply(flow.create_as_artist_403) : pickerServer(call)));
    renderPage(<CreateDepartmentPage />, artist, '/departments/new', '/departments/new');
    fill(/^Name/, 'Lookdev');
    fill(/^Code/, 'DEPT-ART');
    fireEvent.click(screen.getByRole('button', { name: /create department/i }));
    expect(await screen.findByText('You do not have permission to perform this action.')).toBeTruthy();
  });

  it('loads every department and person for the pickers (page_size 500, not page 1 of 25)', async () => {
    const { calls } = mockFetch(pickerServer);
    renderPage(<CreateDepartmentPage />, superuser, '/departments/new', '/departments/new');
    await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(2));
    expect(calls.filter((c) => q(c).page_size === '500').map(path).sort()).toEqual(['/api/v1/departments/', '/api/v1/people/']);
    expect(await screen.findByRole('option', { name: /Compositing/ })).toBeTruthy();
  });
});
