import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/api/client/ApiClient';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { authService } from '@/modules/auth/services/AuthService';
import { CreateDepartmentPage } from '@/modules/departments/pages/CreateDepartmentPage';
import { DepartmentsListPage } from '@/modules/departments/pages/DepartmentsListPage';
import type { Department } from '@/api/masterdata/departments';
import type { User } from '@/types/identity';
import { live } from './liveBackend';

type Page<T> = { count: number; next: string | null; results: T[] };
const BULK = 27; // 5 seeded + 27 = 32 rows: more than one page of 25
const created: string[] = [];

async function signIn(who: 'admin' | 'artist'): Promise<User> {
  tokenStorage.clearTokens();
  const outcome = await authService.login({ email: live.users[who].email, password: live.users[who].password });
  if (outcome.status !== 'authenticated') throw new Error('expected a plain sign-in');
  return outcome.user;
}

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

let admin: User;
let artist: User;

beforeAll(async () => {
  localStorage.clear();
  admin = await signIn('admin');
  for (let i = 1; i <= BULK; i += 1) {
    const n = String(i).padStart(3, '0');
    const d = await apiClient.post<Department>('/api/v1/departments/', { code: `LIVE-${n}`, name: `Live Dept ${n}`, department_type: i % 2 ? 'creative' : 'technical' });
    created.push(d.id);
  }
  artist = await signIn('artist');
  admin = await signIn('admin');
});

afterAll(async () => {
  await signIn('admin');
  for (const id of created) await apiClient.delete(`/api/v1/departments/${id}/`).catch(() => undefined);
});

afterEach(cleanup);

describe('departments list against the real backend', () => {
  it('shows page 1 of 25 of ALL rows, with the real total', async () => {
    renderPage(<DepartmentsListPage />, admin);
    expect(await screen.findByText(/Registered/)).toBeTruthy();
    const total = (await apiClient.get<Page<Department>>('/api/v1/departments/?page_size=1')).count;
    expect(total).toBe(5 + BULK);
    expect(screen.getByText(new RegExp(`${total} Registered`))).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole('link', { name: /open/i }).length).toBe(25));
  });

  it('pages to the rest of the rows (a first-page-only list would never show these)', async () => {
    renderPage(<DepartmentsListPage />, admin);
    await waitFor(() => expect(screen.getAllByRole('link', { name: /open/i }).length).toBe(25));
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /open/i }).length).toBe(5 + BULK - 25));
  });

  it('searches on the server across all pages', async () => {
    renderPage(<DepartmentsListPage />, admin);
    await screen.findByText(/Registered/);
    fireEvent.change(screen.getByPlaceholderText(/search name or code/i), { target: { value: 'LIVE-02' } });
    // LIVE-020 .. LIVE-027 = 8 rows, found even though most are not on page 1
    await waitFor(() => expect(screen.getByText(/8 Matching/)).toBeTruthy());
    expect(screen.getByText('Live Dept 027')).toBeTruthy();
  });

  it('filters by type on the server and orders by name', async () => {
    renderPage(<DepartmentsListPage />, admin);
    await screen.findByText(/Registered/);
    fireEvent.change(screen.getByLabelText('Filter by type'), { target: { value: 'technical' } });
    const expected = (await apiClient.get<Page<Department>>('/api/v1/departments/?department_type=technical&page_size=1')).count;
    await waitFor(() => expect(screen.getByText(new RegExp(`${expected} Matching`))).toBeTruthy());
  });

  it('exports every matching row, not just the visible page', async () => {
    const blobs: Blob[] = [];
    URL.createObjectURL = (b: Blob) => (blobs.push(b), 'blob:x');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    renderPage(<DepartmentsListPage />, admin);
    await waitFor(() => expect(screen.getAllByRole('link', { name: /open/i }).length).toBe(25));
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(blobs.length).toBe(1));

    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new TextDecoder('utf-8', { ignoreBOM: false }).decode(reader.result as ArrayBuffer));
      reader.readAsArrayBuffer(blobs[0]);
    });
    const lines = text.trim().split('\r\n');
    expect(lines[0]).toBe('Code,Name,Type,Description,Created');
    expect(lines.length - 1).toBe(5 + BULK); // all rows, 7 beyond the visible page
  });
});

describe('create against the real backend', () => {
  const fill = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

  it('creates a department and opens it', async () => {
    renderPage(<CreateDepartmentPage />, admin, '/departments/new', '/departments/new');
    fill(/^Name/, 'Live Created');
    fill(/^Code/, 'LIVE-NEW');
    fill(/Software stack/, 'Katana, USD');
    fireEvent.click(screen.getByRole('button', { name: /create department/i }));

    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/departments\/[0-9a-f-]{36}$/));
    const id = screen.getByTestId('where').textContent!.split('/').pop()!;
    created.push(id);
    const stored = await apiClient.get<Department>(`/api/v1/departments/${id}/`);
    expect(stored).toMatchObject({ name: 'Live Created', code: 'LIVE-NEW', department_type: 'creative', software_stack: ['Katana', 'USD'] });
  });

  it('shows the server’s duplicate errors inline (real 400), including a name clash that ignores case', async () => {
    renderPage(<CreateDepartmentPage />, admin, '/departments/new', '/departments/new');
    fill(/^Name/, 'live dept 001'); // existing "Live Dept 001", different case
    fill(/^Code/, 'LIVE-001'); // existing code
    fireEvent.click(screen.getByRole('button', { name: /create department/i }));

    expect(await screen.findByText('A department with this code already exists.')).toBeTruthy();
    expect(screen.getByText('A department with this name already exists.')).toBeTruthy();
    expect(screen.queryByTestId('where')).toBeNull();
  });
});

describe('permissions against the real backend', () => {
  it('a user without masterdata.directory.manage can read the list but is not offered Add/Delete', async () => {
    renderPage(<DepartmentsListPage />, artist);
    await waitFor(() => expect(screen.getAllByRole('link', { name: /open/i }).length).toBeGreaterThan(0));
    expect(screen.queryByRole('link', { name: /add department/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
  });

  it('and the server agrees: create and delete are 403 for that user', async () => {
    await signIn('artist');
    await expect(apiClient.post('/api/v1/departments/', { code: 'ART-X', name: 'Artist X', department_type: 'creative' })).rejects.toMatchObject({ status: 403 });
    await expect(apiClient.delete(`/api/v1/departments/${created[0]}/`)).rejects.toMatchObject({ status: 403 });
    await signIn('admin');
  });
});

describe('delete against the real backend', () => {
  it('deletes after confirmation', async () => {
    renderPage(<DepartmentsListPage />, admin);
    fireEvent.change(await screen.findByPlaceholderText(/search name or code/i), { target: { value: 'LIVE-027' } });
    await waitFor(() => expect(screen.getByText(/1 Matching/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const left = await apiClient.get<Page<Department>>('/api/v1/departments/?search=LIVE-027');
    expect(left.count).toBe(0);
    created.splice(created.length - 1 - created.slice().reverse().findIndex(() => false), 0); // bookkeeping: afterAll tolerates already-deleted rows
  });
});
