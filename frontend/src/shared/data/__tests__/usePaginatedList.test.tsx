import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors/ApiError';
import { loadSample } from '@/test/samples';
import { createQueryKeys } from '../queryKeys';
import type { ListParams, Page } from '../listing';
import { usePaginatedList } from '../usePaginatedList';

const conflicts = loadSample<Record<string, { status?: number; body?: unknown }>>('_misc/conflicts_and_pagination.json');
const departments = loadSample('masterdata/departments.json').list_admin.body as Page<{ id: string; name: string }>;
const keys = createQueryKeys('departments');

const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

const pageOf = (n: number, count = 60): Page<{ id: string; name: string }> => ({
  count,
  next: n * 25 < count ? `http://x/?page=${n + 1}` : null,
  previous: n > 1 ? `http://x/?page=${n - 1}` : null,
  results: departments.results,
});

const setup = (fetchPage: (p: ListParams, s?: AbortSignal) => Promise<Page<{ id: string; name: string }>>, opts = {}) =>
  renderHook(() => usePaginatedList({ queryKey: keys.lists(), fetchPage, searchDebounceMs: 10, ...opts }), { wrapper: wrapper() });

describe('usePaginatedList', () => {
  it('starts at page 1 with the default page size and exposes the envelope', async () => {
    const fetchPage = vi.fn(async () => departments);
    const { result } = setup(fetchPage);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetchPage.mock.calls[0][0]).toEqual({ page: 1, page_size: 25 });
    expect(result.current.count).toBe(5);
    expect(result.current.pageCount).toBe(1);
    expect(result.current.rows).toEqual(departments.results);
  });

  it('pages forward, clamps to the last page and keeps previous rows while loading', async () => {
    const fetchPage = vi.fn(async (p: ListParams) => {
      if (p.page === 2) await new Promise((r) => setTimeout(r, 30));
      return pageOf(p.page ?? 1);
    });
    const { result } = setup(fetchPage);
    await waitFor(() => expect(result.current.rows.length).toBeGreaterThan(0));
    expect(result.current.pageCount).toBe(3);

    act(() => result.current.setPage(2));
    expect(result.current.isPlaceholderData).toBe(true); // old rows still shown
    expect(result.current.rows.length).toBeGreaterThan(0);
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(fetchPage.mock.calls.at(-1)![0].page).toBe(2);

    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(3);
    act(() => result.current.setPage(-4));
    expect(result.current.page).toBe(1);
  });

  it('debounces search, sends it once, and returns to page 1', async () => {
    const fetchPage = vi.fn(async (p: ListParams) => pageOf(p.page ?? 1));
    const { result } = setup(fetchPage);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));

    act(() => result.current.setSearch('c'));
    act(() => result.current.setSearch('co'));
    act(() => result.current.setSearch(' comp '));
    expect(result.current.isSearchPending).toBe(true);
    await waitFor(() => expect(fetchPage.mock.calls.at(-1)![0].search).toBe('comp'));

    expect(result.current.page).toBe(1);
    expect(fetchPage.mock.calls.filter(([p]) => p.search).length).toBe(1);
  });

  it('cycles ordering asc -> desc -> none and reports the sort state', async () => {
    const fetchPage = vi.fn(async (p: ListParams) => pageOf(p.page ?? 1));
    const { result } = setup(fetchPage);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.toggleSort('name'));
    expect(result.current.sortState).toEqual({ field: 'name', direction: 'asc' });
    act(() => result.current.toggleSort('name'));
    expect(result.current.sortState).toEqual({ field: 'name', direction: 'desc' });
    await waitFor(() => expect(fetchPage.mock.calls.at(-1)![0].ordering).toBe('-name'));
    act(() => result.current.toggleSort('name'));
    expect(result.current.sortState).toBeNull();
  });

  it('applies filters, drops empty ones, and resets to page 1', async () => {
    const fetchPage = vi.fn(async (p: ListParams) => pageOf(p.page ?? 1));
    const { result } = setup(fetchPage, { filters: { department_type: 'creative' } });
    await waitFor(() => expect(fetchPage.mock.calls[0][0].department_type).toBe('creative'));

    act(() => result.current.setFilter('department_type', ''));
    await waitFor(() => expect('department_type' in fetchPage.mock.calls.at(-1)![0]).toBe(false));
    act(() => result.current.resetFilters());
    await waitFor(() => expect(fetchPage.mock.calls.at(-1)![0].department_type).toBe('creative'));
  });

  it('aborts the in-flight request when the query changes', async () => {
    const signals: AbortSignal[] = [];
    const fetchPage = vi.fn(async (p: ListParams, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      if (!p.search) await new Promise((r) => setTimeout(r, 50));
      return pageOf(1);
    });
    const { result } = setup(fetchPage);
    await waitFor(() => expect(signals.length).toBe(1));
    act(() => result.current.setSearch('x'));
    await waitFor(() => expect(signals[0].aborted).toBe(true));
  });

  it('falls back to page 1 when the page is out of range (real 404 body)', async () => {
    const fetchPage = vi.fn(async (p: ListParams) => {
      if ((p.page ?? 1) > 1) throw ApiError.fromDrfResponse(404, conflicts.page_out_of_range as never);
      return pageOf(1);
    });
    const { result } = setup(fetchPage);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(result.current.rows.length).toBeGreaterThan(0);
  });

  it('exposes a normalized error and does not retry a 403', async () => {
    const fetchPage = vi.fn(async () => {
      throw ApiError.fromDrfResponse(403, { detail: 'You do not have permission to perform this action.' });
    });
    const { result } = setup(fetchPage);
    await waitFor(() => expect(result.current.error?.status).toBe(403));
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
