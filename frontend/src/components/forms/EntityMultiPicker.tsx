import { useQueries } from '@tanstack/react-query';
import { ChevronDown, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type React from 'react';
import type { PageFetcher } from '@/shared/data/listing';
import { cn } from '@/shared/utils/cn';
import { listDomId, PickerListError, PickerMenu, useActiveOption, useCloseOnOutsidePress, usePickerList } from './pickerParts';

export interface EntityMultiPickerProps<T extends { id: string }> {
  label: string;
  /** Stable key for the cache, e.g. `vendorsApi.keys.all`. */
  queryKey: readonly unknown[];
  fetchPage: PageFetcher<T>;
  /** Resolves the label of a chosen id that is not on the loaded pages (ids may come from a saved record). */
  fetchOne: (id: string, signal?: AbortSignal) => Promise<T>;
  getLabel: (item: T) => string;
  /** The chosen ids, in order. */
  value: ReadonlyArray<string>;
  onChange: (ids: string[]) => void;
  /** What an id that no longer resolves is called ("Unknown vendor"): it can only be removed. */
  unknownLabel?: string;
  filters?: Record<string, string | number | boolean | undefined>;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
}

/**
 * Pick several related records from a server-side list. The field shows the chosen records as chips, each with a
 * remove button; opening it shows the same menu as EntityPicker (search inside it, Load more), where an option is
 * checked or unchecked and the menu stays open. A chosen record keeps its label when it is not on the loaded pages
 * (it is fetched on its own); one that no longer exists shows as `unknownLabel`, to be removed.
 * Keyboard: ↓/Enter/Space open, ↑/↓ move, Enter checks or unchecks, Backspace in an empty search removes the last
 * chip, Escape closes (and does not close a dialog around it).
 */
export function EntityMultiPicker<T extends { id: string }>({
  label,
  queryKey,
  fetchPage,
  fetchOne,
  getLabel,
  value,
  onChange,
  unknownLabel = 'Unknown record',
  filters,
  placeholder = 'Choose…',
  hint,
  required,
  disabled,
  error,
  className,
}: EntityMultiPickerProps<T>): React.ReactElement {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const picker = usePickerList({ queryKey, fetchPage, filters, disabled });
  const { items, debounced } = picker;

  // Records picked in this session keep their labels while a search hides them from the list.
  const [picked, setPicked] = useState<Record<string, T>>({});
  const onPage = new Map(items.map((item) => [item.id, item]));
  const missing = value.filter((v) => !onPage.has(v) && !picked[v]);
  const fetched = useQueries({
    queries: missing.map((v) => ({
      queryKey: [...queryKey, 'picker-selected', v],
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchOne(v, signal),
      staleTime: 60_000,
      retry: false,
      // Wait for the first page: most saved ids are on it and need no request of their own.
      enabled: !picker.list.isLoading,
    })),
  });
  const known = (v: string): T | undefined => onPage.get(v) ?? picked[v] ?? fetched[missing.indexOf(v)]?.data;
  const pending = (v: string) => picker.list.isLoading || (fetched[missing.indexOf(v)]?.isLoading ?? false);
  const chipLabel = (v: string) => {
    const item = known(v);
    return item ? getLabel(item) : pending(v) ? 'Loading…' : unknownLabel;
  };

  const chosen = new Set(value);
  const { current, setActive, onKey } = useActiveOption(items.length, debounced);

  const close = (refocus: boolean) => {
    setOpen(false);
    picker.setSearch('');
    if (refocus) triggerRef.current?.focus();
  };
  const openMenu = () => {
    if (disabled) return;
    setOpen(true);
    setActive(0);
  };
  const toggle = (item: T) => {
    if (chosen.has(item.id)) {
      onChange(value.filter((v) => v !== item.id));
    } else {
      setPicked((p) => ({ ...p, [item.id]: item }));
      onChange([...value, item.id]);
    }
  };
  const remove = (v: string) => onChange(value.filter((x) => x !== v));

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);
  useCloseOnOutsidePress(open, rootRef, () => close(false));

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
    }
  };
  const onSearchKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && picker.search === '' && value.length > 0) {
      e.preventDefault();
      remove(value[value.length - 1]);
      return;
    }
    onKey(e, { enter: (index) => toggle(items[index]), escape: () => close(true), tab: () => close(false) });
  };

  const summary = value.length === 0 ? placeholder : `${value.length} chosen`;

  return (
    <div ref={rootRef} className={cn('relative space-y-1', className)}>
      <span id={labelId} className="block text-xs font-mono text-slate-400">
        {label}
        {required ? ' *' : ''}
      </span>
      <div
        className={cn(
          'w-full min-h-8 flex flex-wrap items-center gap-1 bg-slate-950 border rounded-lg px-1.5 py-1 text-xs',
          disabled && 'opacity-50',
          error ? 'border-rose-500' : open ? 'border-indigo-500' : 'border-slate-800'
        )}
      >
        <ul aria-label={`Chosen ${label.toLowerCase()}`} className="contents">
          {value.map((v) => {
            const text = chipLabel(v);
            const unknown = !known(v) && !pending(v);
            return (
              <li key={v} data-unknown={unknown || undefined} className={cn('inline-flex items-center gap-1 h-6 max-w-full rounded-md border pl-2 pr-1', unknown ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-slate-700 bg-slate-800 text-slate-200')}>
                <span className="truncate">{text}</span>
                <button type="button" disabled={disabled} aria-label={`Remove ${text}`} onClick={() => remove(v)} className="rounded-sm p-0.5 text-slate-400 hover:bg-slate-700 hover:text-slate-100">
                  <X aria-hidden="true" className="w-3 h-3" />
                </button>
              </li>
            );
          })}
        </ul>
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listDomId(id) : undefined}
          aria-labelledby={labelId}
          aria-describedby={hint ? hintId : undefined}
          aria-invalid={Boolean(error)}
          disabled={disabled}
          onClick={() => (open ? close(false) : openMenu())}
          onKeyDown={onTriggerKey}
          className="flex-1 min-w-24 h-6 flex items-center gap-2 px-1.5 text-left text-slate-500 focus:outline-hidden disabled:cursor-not-allowed"
        >
          <span className="flex-1 min-w-0 truncate">{value.length === 0 ? placeholder : 'Add…'}</span>
          <span className="sr-only">{summary}</span>
          <ChevronDown aria-hidden="true" className={cn('w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
        </button>
      </div>

      {open && (
        <PickerMenu
          baseId={id}
          label={label}
          picker={picker}
          options={items}
          getLabel={getLabel}
          isSelected={(item) => chosen.has(item.id)}
          current={current}
          setActive={setActive}
          onPick={toggle}
          onSearchKey={onSearchKey}
          searchRef={searchRef}
          listRef={listRef}
          multiselectable
          footer={
            <>
              <span className="ml-auto">{`${value.length} chosen`}</span>
              {value.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="text-slate-400 hover:text-slate-200 hover:underline">
                  Clear all
                </button>
              )}
            </>
          }
        />
      )}

      {hint && !error && (
        <p id={hintId} className="text-[11px] text-slate-500">
          {hint}
        </p>
      )}
      {!open && <PickerListError picker={picker} />}
      {error && (
        <p role="alert" className="text-[11px] text-rose-400">
          {error}
        </p>
      )}
    </div>
  );
}
