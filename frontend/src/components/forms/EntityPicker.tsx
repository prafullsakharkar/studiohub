import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type React from 'react';
import type { PageFetcher } from '@/shared/data/listing';
import { cn } from '@/shared/utils/cn';
import { listDomId, PickerListError, PickerMenu, useActiveOption, useCloseOnOutsidePress, usePickerList } from './pickerParts';

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

/**
 * Pick a related record from a server-side list. A combobox: the field shows the chosen record; opening it
 * shows a menu whose search box (debounced, server-side) has focus, with "Load more" following the
 * pagination at the end of the list. The saved value shows its label even when it is not on the first page.
 * Keyboard: ↓/Enter/Space open, ↑/↓ move, Enter picks, Escape closes (and does not close a dialog around it).
 * Used wherever a form holds a foreign key (department, team, office, client, vendor, person, …).
 * Several records: EntityMultiPicker.
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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const picker = usePickerList({ queryKey, fetchPage, filters, disabled });
  const { items, debounced } = picker;
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
  const { current, setActive, onKey } = useActiveOption(options.length, debounced);

  const close = (refocus: boolean) => {
    setOpen(false);
    picker.setSearch('');
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
  const onSearchKey = (e: React.KeyboardEvent) =>
    onKey(e, { enter: (index) => pick(options[index]), escape: () => close(true), tab: () => close(false) });

  const shownLabel = selectedItem ? getLabel(selectedItem) : value ? (selected.isLoading ? 'Loading…' : 'Unknown record') : placeholder;

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
        aria-controls={open ? listDomId(id) : undefined}
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
        <PickerMenu
          baseId={id}
          label={label}
          picker={picker}
          options={options}
          getLabel={getLabel}
          isSelected={(item) => item.id === value}
          current={current}
          setActive={setActive}
          onPick={pick}
          onSearchKey={onSearchKey}
          searchRef={searchRef}
          listRef={listRef}
          footer={
            value && (
              <button type="button" onClick={() => pick(null)} className="ml-auto text-slate-400 hover:text-slate-200 hover:underline">
                Clear
              </button>
            )
          }
        />
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
