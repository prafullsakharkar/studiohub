import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { mapHttpError } from '@/api/errors/errorMapper';
import type { PageFetcher } from '@/shared/data/listing';
import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';
import { cn } from '@/shared/utils/cn';

/**
 * What EntityPicker and EntityMultiPicker share: the server-side list behind the menu (debounced search, Load more),
 * the keys of the search box, and the menu itself (search, options, footer).
 */

const PAGE_SIZE = 25;

export function usePickerList<T extends { id: string }>({
  queryKey,
  fetchPage,
  filters,
  disabled,
}: {
  queryKey: readonly unknown[];
  fetchPage: PageFetcher<T>;
  filters?: Record<string, string | number | boolean | undefined>;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim(), 300);
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
  return {
    search,
    setSearch,
    debounced,
    list,
    items,
    total: list.data?.pages[0]?.count,
    loadingFirst: list.isLoading && !list.data,
    searching: search.trim() !== debounced || (list.isFetching && !list.isFetchingNextPage),
  };
}

export type PickerList<T extends { id: string }> = ReturnType<typeof usePickerList<T>>;

/** `text` split around the first case-insensitive match of `query`, for highlighting it. */
export function splitMatch(text: string, query: string): [string, string, string] | null {
  if (!query) return null;
  const at = text.toLowerCase().indexOf(query.toLowerCase());
  return at < 0 ? null : [text.slice(0, at), text.slice(at, at + query.length), text.slice(at + query.length)];
}

/** The active option, kept on one that exists, and the keys of the search box that move it. */
export function useActiveOption(count: number, resetOn: unknown) {
  const [active, setActive] = useState(0);
  const current = count ? Math.min(Math.max(active, 0), count - 1) : -1;
  // A new search starts at its first result.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the results change.
  useEffect(() => setActive(0), [resetOn]);
  const onKey = (e: React.KeyboardEvent, on: { enter: (index: number) => void; escape: () => void; tab: () => void }) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(count - 1, current + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, current - 1));
    } else if (e.key === 'Home' && count) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && count) {
      e.preventDefault();
      setActive(count - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (current >= 0) on.enter(current);
    } else if (e.key === 'Escape') {
      // Stop here: a dialog around the form closes on Escape too.
      e.preventDefault();
      e.stopPropagation();
      on.escape();
    } else if (e.key === 'Tab') {
      on.tab();
    }
  };
  return { current, setActive, onKey };
}

export interface PickerMenuProps<T extends { id: string }> {
  /** The base of the element ids (from `useId`). */
  baseId: string;
  label: string;
  picker: PickerList<T>;
  options: T[];
  getLabel: (item: T) => string;
  isSelected: (item: T) => boolean;
  current: number;
  setActive: (index: number) => void;
  onPick: (item: T) => void;
  onSearchKey: (e: React.KeyboardEvent) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  multiselectable?: boolean;
  /** Shown in the footer after the count and Load more (Clear, the number chosen). */
  footer?: React.ReactNode;
}

export const optionDomId = (baseId: string, index: number) => `${baseId}-opt-${index}`;
export const listDomId = (baseId: string) => `${baseId}-list`;

/** The open menu: a search box that has focus, the options (the match highlighted, a check on the chosen), a footer. */
export function PickerMenu<T extends { id: string }>({
  baseId,
  label,
  picker,
  options,
  getLabel,
  isSelected,
  current,
  setActive,
  onPick,
  onSearchKey,
  searchRef,
  listRef,
  multiselectable,
  footer,
}: PickerMenuProps<T>): React.ReactElement {
  const { list, items, total, debounced, loadingFirst, searching } = picker;
  const listId = listDomId(baseId);
  useEffect(() => {
    if (current >= 0) listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView?.({ block: 'nearest' });
  }, [current, listRef]);
  return (
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
          aria-activedescendant={current >= 0 ? optionDomId(baseId, current) : undefined}
          placeholder="Search…"
          value={picker.search}
          onChange={(e) => picker.setSearch(e.target.value)}
          onKeyDown={onSearchKey}
          className="w-full h-8 bg-slate-950 border border-indigo-500/60 rounded-lg pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden"
        />
      </div>
      <div ref={listRef} id={listId} role="listbox" aria-label={label} aria-multiselectable={multiselectable || undefined} aria-busy={searching} className="max-h-60 overflow-y-auto p-1.5">
        {options.map((item, index) => {
          const text = getLabel(item);
          const parts = splitMatch(text, debounced);
          const selected = isSelected(item);
          return (
            // Keys are handled on the search box, which points at the active option (aria-activedescendant).
            // biome-ignore lint/a11y/useKeyWithClickEvents: see above.
            <div
              key={item.id}
              id={optionDomId(baseId, index)}
              data-index={index}
              role="option"
              tabIndex={-1}
              aria-selected={selected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onPick(item)}
              onMouseEnter={() => setActive(index)}
              className={cn('flex items-center gap-2 min-h-8 px-2 rounded-md cursor-pointer text-xs text-slate-200', index === current && 'bg-slate-800')}
            >
              {multiselectable && (
                <span aria-hidden="true" className={cn('flex w-3.5 h-3.5 shrink-0 items-center justify-center rounded-sm border', selected ? 'border-cyan-400 bg-cyan-500/20' : 'border-slate-600')}>
                  {selected && <Check className="w-3 h-3 text-cyan-300" />}
                </span>
              )}
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
              {!multiselectable && selected && <Check aria-hidden="true" className="w-3.5 h-3.5 shrink-0 text-cyan-400" />}
            </div>
          );
        })}
        {!loadingFirst && !list.error && options.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-slate-400">{debounced ? `Nothing matches “${debounced}”` : 'Nothing to choose from'}</p>
        )}
        {loadingFirst && <p className="px-2 py-3 text-center text-xs text-slate-400">Loading…</p>}
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
        {footer}
      </div>
    </div>
  );
}

/** The list's error under a closed picker, with Retry. */
export function PickerListError({ picker }: { picker: PickerList<{ id: string }> }): React.ReactElement | null {
  if (!picker.list.error) return null;
  return (
    <p role="alert" className="text-[11px] text-rose-400">
      {mapHttpError(picker.list.error).userMessage}{' '}
      <button type="button" className="underline" onClick={() => void picker.list.refetch()}>
        Retry
      </button>
    </p>
  );
}

/** Close the menu on a mouse press outside `root` while it is open. */
export function useCloseOnOutsidePress(open: boolean, root: React.RefObject<HTMLElement | null>, close: () => void) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the menu opens or closes only.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
}
