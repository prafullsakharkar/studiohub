import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

/** `text` split around the first case-insensitive match of `query`, for highlighting it. */
function splitMatch(text: string, query: string): [string, string, string] | null {
  if (!query) return null;
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  return at < 0 ? null : [text.slice(0, at), text.slice(at, at + query.length), text.slice(at + query.length)];
}

/**
 * Pick a related record from a server-side list. A combobox: the field shows the chosen record; opening it
 * shows a menu whose search box (debounced, server-side) has focus, with "Load more" following the
 * pagination at the end of the list. The saved value shows its label even when it is not on the first page.
 * Keyboard: ↓/Enter/Space open, ↑/↓ move, Enter picks, Escape closes (and does not close a dialog around it).
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
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-opt-${index}`;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const list = useInfiniteQuery({
    queryKey: [...queryKey, 'picker', debounced, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => fetchPage({ page: pageParam, page_size: PAGE_SIZE, ...(debounced ? { search: debounced } : {}), ...filters }, signal),
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
    staleTime: 30_000,
    // A disabled picker (waiting for the project to be chosen) must not list everything meanwhile.
    enabled: !disabled,
  });

  const items = useMemo(() => list.data?.pages.flatMap((p) => p.results) ?? [], [list.data]);
  const total = list.data?.pages[0]?.count;
  const selectedOnPage = items.find((item) => item.id === value);

  // The saved value may not be on the loaded pages: fetch just that record for its label.
  const selected = useQuery({
    queryKey: [...queryKey, 'picker-selected', value],
    queryFn: ({ signal }) => (fetchOne as NonNullable<typeof fetchOne>)(value as string, signal),
    enabled: Boolean(value && !selectedOnPage && fetchOne),
    staleTime: 60_000,
  });
  // Keep the label of the chosen record while a search hides it from the list.
  const [chosen, setChosen] = useState<T | null>(null);
  const selectedItem = selectedOnPage ?? selected.data ?? (chosen && chosen.id === value ? chosen : undefined);

  // With no search typed, a saved record that is not on the loaded pages is listed first.
  const options = selectedItem && !selectedOnPage && !debounced ? [selectedItem, ...items] : items;

  // The active option is always one that exists: the first until the user moves (or the chosen one when opening).
  const current = options.length ? Math.min(Math.max(active, 0), options.length - 1) : -1;

  const close = (refocus: boolean) => {
    setOpen(false);
    setSearch('');
    if (refocus) triggerRef.current?.focus();
  };
  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setActive(Math.max(0, options.findIndex((o) => o.id === value)));
  };
  const pick = (item: T | null) => {
    setChosen(item);
    onChange(item ? item.id : null);
    close(true);
  };

  // Search has focus when the menu opens; a click outside closes it (so opening another picker closes this one).
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the menu opens or closes only.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // A new search starts at its first result; keep the active option scrolled into view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the results change.
  useEffect(() => setActive(0), [debounced]);
  useEffect(() => {
    if (current >= 0) listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  };
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(options.length - 1, current + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, current - 1));
    } else if (e.key === 'Home' && options.length) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && options.length) {
      e.preventDefault();
      setActive(options.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (current >= 0) pick(options[current]);
    } else if (e.key === 'Escape') {
      // Stop here: a dialog around the form closes on Escape too.
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  const shownLabel = selectedItem ? getLabel(selectedItem) : value ? (selected.isLoading ? 'Loading…' : 'Unknown record') : placeholder;
  const loadingFirst = list.isLoading && !list.data;
  const searching = search.trim() !== debounced || (list.isFetching && !list.isFetchingNextPage);

  return (
    <div ref={rootRef} className={cn('relative space-y-1', className)}>
      <span id={labelId} className="block text-xs font-mono text-slate-400">
        {label}
        {required ? ' *' : ''}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-invalid={Boolean(error)}
        disabled={disabled}
        onClick={() => (open ? close(false) : openMenu())}
        onKeyDown={onTriggerKey}
        className={cn(
          'w-full h-8 flex items-center gap-2 bg-slate-950 border rounded-lg px-3 text-xs text-left focus:outline-hidden focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed',
          error ? 'border-rose-500' : open ? 'border-indigo-500' : 'border-slate-800'
        )}
      >
        <span id={valueId} className={cn('flex-1 min-w-0 truncate', selectedItem ? 'text-slate-200' : 'text-slate-500')}>
          {shownLabel}
        </span>
        <ChevronDown aria-hidden="true" className={cn('w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 min-w-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/60">
          <div className="relative p-2 border-b border-slate-800">
            <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              ref={searchRef}
              type="search"
              role="combobox"
              aria-label={`Search ${label.toLowerCase()}`}
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={current >= 0 ? optionId(current) : undefined}
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKey}
              className="w-full h-8 bg-slate-950 border border-indigo-500/60 rounded-lg pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden"
            />
          </div>
          <div ref={listRef} id={listId} role="listbox" aria-label={label} aria-busy={searching} className="max-h-60 overflow-y-auto p-1.5">
            {options.map((item, index) => {
              const text = getLabel(item);
              const parts = splitMatch(text, debounced);
              const isSelected = item.id === value;
              return (
                // Keys are handled on the search box, which points at the active option (aria-activedescendant).
                // biome-ignore lint/a11y/useKeyWithClickEvents: see above.
                <div
                  key={item.id}
                  id={optionId(index)}
                  data-index={index}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                  onMouseEnter={() => setActive(index)}
                  className={cn('flex items-center gap-2 min-h-8 px-2 rounded-md cursor-pointer text-xs text-slate-200', index === current && 'bg-slate-800')}
                >
                  <span className="flex-1 min-w-0 truncate">
                    {parts ? (
                      <>
                        {parts[0]}
                        <mark className="bg-cyan-500/25 text-cyan-100 rounded-xs">{parts[1]}</mark>
                        {parts[2]}
                      </>
                    ) : (
                      text
                    )}
                  </span>
                  {isSelected && <Check aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-cyan-400" />}
                </div>
              );
            })}
            {!loadingFirst && !list.error && options.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-slate-400">
                {debounced ? `Nothing matches “${debounced}”` : 'Nothing to choose from'}
              </p>
            )}
            {loadingFirst && (
              <p className="px-2 py-3 text-center text-xs text-slate-400">
                Loading…
              </p>
            )}
          </div>
          {list.error && (
            <p role="alert" className="px-3 py-2 border-t border-slate-800 text-[11px] text-rose-400">
              {mapHttpError(list.error).userMessage}{' '}
              <button type="button" className="underline" onClick={() => void list.refetch()}>
                Retry
              </button>
            </p>
          )}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-slate-800 text-[11px] text-slate-400">
            {total !== undefined && <span aria-live="polite">{`${items.length} of ${total}`}</span>}
            {list.hasNextPage && (
              <button type="button" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()} className="text-cyan-300 hover:underline disabled:opacity-60">
                {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            )}
            {value && (
              <button type="button" onClick={() => pick(null)} className="ml-auto text-slate-400 hover:text-slate-200 hover:underline">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {!open && list.error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {mapHttpError(list.error).userMessage}{' '}
          <button type="button" className="underline" onClick={() => void list.refetch()}>
            Retry
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
