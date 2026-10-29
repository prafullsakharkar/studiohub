import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/core/auth/AuthContext';
import type { AuthContextValue } from '@/core/auth/AuthContext';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import type { User } from '@/types/identity';
import { TaskTemplateForm } from '../templates';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('production/_work_flow.json');
const auth = loadSample('identity/_auth_flow.json');
const superuser = auth.me_admin.body as unknown as User;
const path = (c: MockCall) => new URL(c.url).pathname;

beforeEach(() => {
  localStorage.clear();
  tokenStorage.setTokens({ access: 'a', refresh: 'r' });
});
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('task template form', () => {
  it('creates a studio template: items are posted in order with their task type, name and bid hours', async () => {
    const types = flow.catalog_task_types.body;
    const rows = Array.isArray(types) ? types : (flow.catalog_task_type_create.body && [flow.catalog_task_type_create.body]);
    const { calls } = mockFetch((c) => {
      if (c.method === 'POST') return { status: 201, body: flow.templates_create.body };
      if (path(c).includes('task-types')) return { status: 200, body: rows };
      return { status: 200, body: { count: 0, next: null, previous: null, results: [] } };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter initialEntries={['/task-templates/new']}>
            <Routes>
              <Route path="/task-templates/new" element={<TaskTemplateForm />} />
              <Route path="/task-templates" element={<div>templates list</div>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'Shot starter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a task' }));
    await screen.findAllByRole('option', { name: rows[0].name });
    fireEvent.change(screen.getByLabelText('Task type 1'), { target: { value: rows[0].id } });
    fireEvent.change(screen.getByLabelText('Task name 1'), { target: { value: 'Comp' } });
    fireEvent.change(screen.getByLabelText('Bid hours 1'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Task type 2'), { target: { value: rows[0].id } });
    fireEvent.change(screen.getByLabelText('Task name 2'), { target: { value: 'Roto' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create template' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(path(post)).toBe('/api/v1/task-templates/');
    expect(post.body).toEqual({
      name: 'Shot starter',
      description: '',
      entity_type: 'Shot',
      is_active: true,
      items: [
        { task_type_id: rows[0].id, name: 'Comp', order: 1, default_bid_hours: '8' },
        { task_type_id: rows[0].id, name: 'Roto', order: 2 }, // no bid typed: left to the server
      ],
    });
    expect(post.body).not.toHaveProperty('project_id'); // empty project = a studio template
  });

  it('refuses an item without a task type before sending anything', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: [] }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    render(
      <QueryClientProvider client={client}>
        <AuthContext.Provider value={{ user: superuser, refreshUser: vi.fn() } as unknown as AuthContextValue}>
          <MemoryRouter initialEntries={['/task-templates/new']}>
            <Routes>
              <Route path="/task-templates/new" element={<TaskTemplateForm />} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </QueryClientProvider>
    );
    fireEvent.change(await screen.findByLabelText(/^Name/), { target: { value: 'X' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add a task' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create template' }));
    expect(await screen.findByText('Choose a task type.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });
});
