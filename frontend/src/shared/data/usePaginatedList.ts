import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapHttpError } from '@/api/errors/errorMapper';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { DEFAULT_PAGE_SIZE } from './listing';
import type { ListParams, Page, PageFetcher, ParamValue } from './listing';

export interface UsePaginatedListOptions<T> {
  /** Base key, e.g. `departmentKeys.lists()`; the params are appended. */
  queryKey: readonly unknown[];
  fetchPage: PageFetcher<T>;
  pageSize?: number;
  ordering?: string;
  filters?: Record<string, ParamValue>;
  searchDebounceMs?: number;
  enabled?: boolean;
  staleTime?: number;
}

export type SortDirection = 'asc' | 'desc';

/**
 * Server-side pagination, search, ordering and filters for a table.
 *
 * - search/filter/ordering/page-size changes return to page 1;
 * - the previous page stays on screen while the next one loads (no flicker);
 * - leaving the page (or typing again) aborts the in-flight request;
 * - a 404 on page > 1 (the last row of the last page was deleted) falls back to page 1.
 */
export function usePaginatedList<T>({
  queryKey,
  fetchPage,
  pageSize: initialPageSize = DEFAULT_PAGE_SIZE,
  ordering: initialOrdering,
  filters: initialFilters = {},
  searchDebounceMs = 300,
  enabled = true,
  staleTime = 30_000,
}: UsePaginatedListOptions<T>) {
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [search, setSearchState] = useState('');
  const [ordering, setOrderingState] = useState<string | undefined>(initialOrdering);
  const [filters, setFilters] = useState<Record<string, ParamValue>>(initialFilters);

  const debouncedSearch = useDebouncedValue(search.trim(), searchDebounceMs);

  // The page belongs to one query shape. When search/filters/ordering/page size change, the
  // page is 1 *in the same render*: resetting it from an effect would first request the old
  // page number against the new query (wasted, and a 404 if that page does not exist there).
  const queryShape = JSON.stringify([debouncedSearch, ordering, filters, pageSize]);
  const [pageState, setPageState] = useState({ shape: queryShape, page: 1 });
  const page = pageState.shape === queryShape ? pageState.page : 1;
  const setPage = useCallback((next: number) => setPageState({ shape: queryShape, page: next }), [queryShape]);

  const params = useMemo<ListParams>(() => {
    const out: ListParams = { page, page_size: pageSize };
    if (debouncedSearch) out.search = debouncedSearch;
    if (ordering) out.ordering = ordering;
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== '') out[key] = value;
    }
    return out;
  }, [page, pageSize, debouncedSearch, ordering, filters]);

  const query = useQuery<Page<T>>({
    queryKey: [...queryKey, params],
    queryFn: ({ signal }) => fetchPage(params, signal),
    placeholderData: keepPreviousData,
    enabled,
    staleTime,
    // A 404 is "page out of range", handled below; do not retry it.
    retry: (failureCount, error) => mapHttpError(error).status >= 500 && failureCount < 2,
  });

  const outOfRange = query.error && mapHttpError(query.error).status === 404 && page > 1;
  useEffect(() => {
    if (outOfRange) setPage(1);
  }, [outOfRange, setPage]);

  const count = query.data?.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(count / pageSize));

  const toggleSort = useCallback((field: string) => {
    setOrderingState((current) => {
      if (current === field) return `-${field}`;
      if (current === `-${field}`) return undefined;
      return field;
    });
  }, []);

  const setFilter = useCallback((key: string, value: ParamValue) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const sortState = useMemo<{ field: string; direction: SortDirection } | null>(() => {
    if (!ordering) return null;
    return ordering.startsWith('-') ? { field: ordering.slice(1), direction: 'desc' } : { field: ordering, direction: 'asc' };
  }, [ordering]);

  return {
    rows: query.data?.results ?? [],
    count,
    page,
    pageSize,
    pageCount,
    hasNext: Boolean(query.data?.next),
    hasPrevious: Boolean(query.data?.previous),
    setPage: (next: number) => setPage(Math.min(Math.max(1, next), pageCount)),
    setPageSize: (size: number) => setPageSizeState(size),
    search,
    setSearch: setSearchState,
    ordering,
    sortState,
    setOrdering: setOrderingState,
    toggleSort,
    filters,
    setFilter,
    resetFilters: () => setFilters(initialFilters),
    /** First load only; later pages keep the previous rows visible. */
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    /** Search typed but not yet sent. */
    isSearchPending: search.trim() !== debouncedSearch,
    error: query.error ? mapHttpError(query.error) : null,
    refetch: query.refetch,
    params,
  };
}
