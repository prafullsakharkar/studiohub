import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { departmentsApi } from '@/api/masterdata/departments';
import type { Department } from '@/api/masterdata/departments';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { mockFetch } from '@/test/fetchMock';
import type { MockCall, MockReply } from '@/test/fetchMock';
import { loadSample } from '@/test/samples';
import { EntityPicker } from '../EntityPicker';

type Captured = { status: number; body: any };
const flow = loadSample<Record<string, Captured>>('masterdata/_departments_flow.json');
const q = (c: MockCall) => Object.fromEntries(new URL(c.url).searchParams);
const reply = (c: Captured): MockReply => ({ status: c.status, body: c.body });

const server = (c: MockCall): MockReply => {
  const params = q(c);
  if (new URL(c.url).pathname !== '/api/v1/departments/') return { status: 404, body: {} };
  if (params.search === 'comp') return reply(flow.list_search_comp);
  if (params.page === '2') return reply(flow.list_page_2_of_size_2);
  return reply(flow.list_page_size_2); // first page, with a `next` link
};

function Harness({ value = null, onChange = () => undefined, fetchOne }: { value?: string | null; onChange?: (id: string | null) => void; fetchOne?: (id: string) => Promise<Department> }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <EntityPicker<Department> label="Department" queryKey={['t-departments']} fetchPage={departmentsApi.list} fetchOne={fetchOne} getLabel={(d) => d.name} value={value} onChange={onChange} />
    </QueryClientProvider>
  );
}

beforeEach(() => tokenStorage.setTokens({ access: 'a', refresh: 'r' }));
afterEach(() => {
  cleanup();
  tokenStorage.clearTokens();
  vi.unstubAllGlobals();
});

describe('EntityPicker', () => {
  const firstPage = flow.list_page_size_2.body.results as Department[];
  const secondPage = flow.list_page_2_of_size_2.body.results as Department[];

  it('lists the first page and reports the chosen id (and null when cleared)', async () => {
    mockFetch(server);
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(await screen.findByRole('option', { name: firstPage[0].name })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: firstPage[0].id } });
    expect(onChange).toHaveBeenLastCalledWith(firstPage[0].id);
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('searches on the server (debounced) instead of filtering the loaded page', async () => {
    const { calls } = mockFetch(server);
    render(<Harness />);
    await screen.findByRole('option', { name: firstPage[0].name });

    fireEvent.change(screen.getByLabelText('Search department'), { target: { value: 'comp' } });
    await waitFor(() => expect(calls.some((c) => q(c).search === 'comp')).toBe(true));
  });

  it('"Load more" follows the pagination and keeps the earlier rows', async () => {
    const { calls } = mockFetch(server);
    render(<Harness />);
    await screen.findByRole('option', { name: firstPage[0].name });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('option', { name: secondPage[0].name })).toBeTruthy();
    expect(screen.getByRole('option', { name: firstPage[0].name })).toBeTruthy();
    expect(calls.some((c) => q(c).page === '2')).toBe(true);
  });

  it('shows the label of a saved value that is not on the loaded pages, via fetchOne', async () => {
    mockFetch(server);
    const saved = { ...firstPage[0], id: 'saved-elsewhere', name: 'Saved on page 9' };
    const fetchOne = vi.fn().mockResolvedValue(saved);
    render(<Harness value="saved-elsewhere" fetchOne={fetchOne} />);

    expect(await screen.findByRole('option', { name: 'Saved on page 9' })).toBeTruthy();
    expect(fetchOne).toHaveBeenCalledWith('saved-elsewhere', expect.anything());
    expect((screen.getByLabelText('Department') as HTMLSelectElement).value).toBe('saved-elsewhere');
  });

  it('says so when the list cannot be loaded and offers a retry', async () => {
    mockFetch(() => ({ status: 500, body: { detail: 'Internal server error.' } }));
    render(<Harness />);
    expect(await screen.findByRole('button', { name: 'Retry' })).toBeTruthy();
  });
});
