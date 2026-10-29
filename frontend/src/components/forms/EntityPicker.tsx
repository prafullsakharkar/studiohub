import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useId, useMemo, useState } from 'react';
import type React from 'react';
import { mapHttpError } from '@/api/errors/errorMapper';
import type { PageFetcher } from '@/shared/data/listing';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { cn } from '@/shared/utils/cn';

export interface EntityPickerProps<T extends { id: string }> {
  label: string;
  /** Stable key for the cache, e.g. `departmentKeys.all`. */
  queryKey: readonly unknown[];
  fetchPage: PageFetcher<T>;
  /** Resolves the label of the SELECTED id when it is not on the loaded pages (the id may come from a saved record). */
  fetchOne?: (id: string, signal?: AbortSignal) => Promise<T>;
  getLabel: (item: T) => string;
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  /** Extra list filters, e.g. `{ department: id }` for the teams of a department. */
  filters?: Record<string, string | number | boolean | undefined>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

const PAGE_SIZE = 25;

/**
 * Pick a related record from a server-side list: type to search (debounced, server-side), "Load more"
 * follows the pagination, and the saved value shows its label even when it is not on the first page.
 * Used wherever a form holds a foreign key (department, team, office, client, vendor, person, …).
 */
export function EntityPicker<T extends { id: string }>({
  label,
  queryKey,
  fetchPage,
  fetchOne,
  getLabel,
  value,
  onChange,
  filters,
  placeholder = 'Select…',
  required,
  disabled,
  error,
  className,
}: EntityPickerProps<T>): React.ReactElement {
  const id = useId();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);

  const list = useInfiniteQuery({
    queryKey: [...queryKey, 'picker', debounced, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchPage({ page: pageParam, page_size: PAGE_SIZE, ...(debounced ? { search: debounced } : {}), ...filters }, signal),
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
    staleTime: 30_000,
  });

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.results) ?? [], [list.data]);
  const selectedOnPage = items.find((item) => item.id === value);

  // The saved value may not be on the loaded pages: fetch just that record for its label.
  const selected = useQuery({
    queryKey: [...queryKey, 'picker-selected', value],
    queryFn: ({ signal }) => (fetchOne as NonNullable<typeof fetchOne>)(value as string, signal),
    enabled: Boolean(value && !selectedOnPage && fetchOne),
    staleTime: 60_000,
  });
  const selectedItem = selectedOnPage ?? selected.data;

  const options = selectedItem && !selectedOnPage ? [selectedItem, ...items] : items;

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={`${id}-select`} className="block text-xs font-mono text-slate-400">
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder="Search…"
        value={search}
        disabled={disabled}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500"
      />
      <select
        id={`${id}-select`}
        value={value ?? ''}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn('w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-500', error ? 'border-rose-500' : 'border-slate-800')}
      >
        <option value="">{list.isLoading ? 'Loading…' : placeholder}</option>
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {getLabel(item)}
          </option>
        ))}
        {value && !selectedItem && <option value={value}>{selected.isLoading ? 'Loading…' : 'Unknown record'}</option>}
      </select>
      {list.error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {mapHttpError(list.error).userMessage}{' '}
          <button type="button" className="underline" onClick={() => void list.refetch()}>
            Retry
          </button>
        </p>
      )}
      {list.hasNextPage && (
        <button type="button" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} className="text-[11px] text-cyan-300 hover:underline">
          {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
