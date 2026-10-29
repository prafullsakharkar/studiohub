import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { DirectoryFormPage } from '../DirectoryFormPage';
import { DirectoryListPage } from '../DirectoryListPage';
import { officesFormConfig, officesListConfig } from '../entities/offices';
import { teamsFormConfig, teamsListConfig } from '../entities/teams';

type Captured = { status: number; body: any };
const teams = loadSample<Record<string, Captured>>('masterdata/teams.json');
const offices = loadSample<Record<string, Captured>>('masterdata/offices.json');
const departments = loadSample<Record<string, Captured>>('masterdata/_departments_flow.json');
const conflicts = loadSample<Record<string, Captured>>('_misc/conflicts_and_pagination.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const artist = auth.me_artist.body as unknown as User;

const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });
const path = (c: MockCall) => new URL(c.url).pathname;
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);

function renderAt(initial: string, user: User, routes: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={{ user, refreshUser: vi.fn() } as unknown as AuthContextValue}>
        <MemoryRouter initialEntries={[initial]}>
          <Routes>{routes}</Routes>
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
  vi.unstubAllGlobals();
});

const teamRows = teams.list_admin.body.results as Array<{ id: string; name: string; code: string }>;

describe('DirectoryListPage (teams)', () => {
  const listRoute = <Route path="/teams" element={<DirectoryListPage config={teamsListConfig} />} />;

  it('loads the first page server-side with the backend’s ordering parameter', async () => {
    const { calls } = mockFetch(() => reply(teams.list_admin));
    renderAt('/teams', superuser, listRoute);
    expect(await screen.findByRole('link', { name: teamRows[0].name })).toBeTruthy();
    expect(path(calls[0])).toBe('/api/v1/teams/');
    expect(q(calls[0])).toEqual({ page: '1', page_size: '25', ordering: 'name' });
    expect(screen.getByText(`${teams.list_admin.body.count} Registered`)).toBeTruthy();
  });

  it('searches and sorts on the server', async () => {
    const { calls } = mockFetch(() => reply(teams.list_admin));
    renderAt('/teams', superuser, listRoute);
    await screen.findByRole('link', { name: teamRows[0].name });

    fireEvent.change(screen.getByLabelText('Search teams'), { target: { value: 'comp' } });
    await waitFor(() => expect(calls.some((c) => q(c).search === 'comp')).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: 'Code' }));
    await waitFor(() => expect(calls.some((c) => q(c).ordering === 'code')).toBe(true));
  });

  it('hides create/edit/delete from a user without masterdata.directory.manage', async () => {
    mockFetch(() => reply(teams.list_admin));
    renderAt('/teams', artist, listRoute);
    await screen.findByRole('link', { name: teamRows[0].name });
    expect(screen.queryByRole('link', { name: /new team/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull();
  });

  it('shows the server’s reason when a delete is blocked by references (409 has_dependants)', async () => {
    mockFetch((c) => (c.method === 'DELETE' ? reply(conflicts.department_delete_referenced) : reply(teams.list_admin)));
    renderAt('/teams', superuser, listRoute);
    await screen.findByRole('link', { name: teamRows[0].name });

    fireEvent.click(screen.getByRole('button', { name: `Delete ${teamRows[0].name}` }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText(/Still referenced by/i)).toBeTruthy();
  });

  it('offers office filters with the backend’s parameter names', async () => {
    const { calls } = mockFetch(() => reply(offices.list_admin));
    renderAt('/offices', superuser, <Route path="/offices" element={<DirectoryListPage config={officesListConfig} />} />);
    await screen.findByRole('table', { name: 'Offices' });

    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'true' } });
    await waitFor(() => expect(calls.some((c) => q(c).is_active === 'true')).toBe(true));
  });
});

describe('DirectoryFormPage', () => {
  const createRoute = (
    <>
      <Route path="/teams/new" element={<DirectoryFormPage config={teamsFormConfig} />} />
      <Route path="/teams/:id" element={<div>team page</div>} />
    </>
  );

  it('checks required links before sending anything', async () => {
    const { calls } = mockFetch(() => reply(departments.list_default));
    renderAt('/teams/new', superuser, createRoute);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Layout' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'LAY' } });
    fireEvent.click(screen.getByRole('button', { name: /create team/i }));
    expect(await screen.findByText('Choose a department.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('shows the server’s field errors inline (real create_empty_400)', async () => {
    const dept = departments.list_default.body.results[0] as { id: string; name: string };
    mockFetch((c) => (c.method === 'POST' ? reply(teams.create_empty_400) : reply(departments.list_default)));
    renderAt('/teams/new', superuser, createRoute);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Layout' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'LAY' } });
    await screen.findByRole('option', { name: dept.name });
    fireEvent.change(screen.getByLabelText(/^Department/), { target: { value: dept.id } });
    fireEvent.click(screen.getByRole('button', { name: /create team/i }));

    expect((await screen.findAllByText('This field is required.')).length).toBeGreaterThanOrEqual(3);
  });

  it('creates with the picked department and navigates to the new record', async () => {
    const dept = departments.list_default.body.results[0] as { id: string; name: string };
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return { status: 201, body: { ...teamRows[0], id: 'new-team-id' } };
      return reply(departments.list_default);
    });
    renderAt('/teams/new', superuser, createRoute);

    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Layout' } });
    fireEvent.change(screen.getByLabelText(/^Code/), { target: { value: 'LAY' } });
    await screen.findByRole('option', { name: dept.name });
    fireEvent.change(screen.getByLabelText(/^Department/), { target: { value: dept.id } });
    fireEvent.click(screen.getByRole('button', { name: /create team/i }));

    expect(await screen.findByText('team page')).toBeTruthy();
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.body).toMatchObject({ name: 'Layout', code: 'LAY', department: dept.id });
    expect(post.body).not.toHaveProperty('description'); // untouched optional blanks are not sent
  });

  it('edit sends only the changed fields, and clears an emptied number with null', async () => {
    const office = offices.detail_admin.body as Record<string, any>;
    const { calls } = mockFetch((c) => (c.method === 'PATCH' ? { body: office } : { body: office }));
    renderAt(
      `/offices/${office.id}/edit`,
      superuser,
      <>
        <Route path="/offices/:id/edit" element={<DirectoryFormPage config={officesFormConfig} />} />
        <Route path="/offices/:id" element={<div>office page</div>} />
      </>
    );
    await waitFor(() => expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe(office.name));

    fireEvent.change(screen.getByLabelText(/^City/), { target: { value: 'Pune' } });
    fireEvent.change(screen.getByLabelText('Workstations'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await screen.findByText('office page');
    expect(calls.find((c) => c.method === 'PATCH')!.body).toEqual({ city: 'Pune', workstations_count: null });
  });
});
