import { useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Table } from '@/modules/identity/components/ui';
import { exportAll } from '@/shared/data/exportAll';
import type { PageFetcher } from '@/shared/data/listing';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { SearchInput } from '@/shared/components/SearchInput';

export interface LogFilter {
  /** Backend filter parameter. */
  key: string;
  label: string;
  /** A fixed list; without it the filter is free text, applied on Enter or blur. */
  options?: ReadonlyArray<{ value: string; label: string }>;
}

export interface LogRowAction<T> {
  label: string;
  /** Only offered on rows where this returns true. */
  when: (row: T) => boolean;
  confirm: (row: T) => string;
  run: (row: T) => Promise<unknown>;
}

export interface LogListConfig<T extends { id: string }> {
  title: string;
  subtitle: string;
  queryKey: readonly unknown[];
  fetchPage: PageFetcher<T>;
  searchPlaceholder?: string;
  filters?: ReadonlyArray<LogFilter>;
  /** Offer the created_at window (`created_at__gte` / `created_at__lte`). */
  dateRange?: boolean;
  columns: ReadonlyArray<{ header: string; cell: (row: T) => React.ReactNode }>;
  rowTitle: (row: T) => string;
  detail: (row: T) => React.ReactNode;
  actions?: ReadonlyArray<LogRowAction<T>>;
  exportColumns?: ReadonlyArray<{ header: string; value: (row: T) => unknown }>;
}

const TextFilter: React.FC<{ filter: LogFilter; onApply: (value: string) => void }> = ({ filter, onApply }) => {
  const [value, setValue] = useState('');
  return (
    <input
      aria-label={`Filter by ${filter.label.toLowerCase()}`}
      placeholder={filter.label}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onApply(value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && onApply(value.trim())}
      className="w-32 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
    />
  );
};

/**
 * A read-only log screen: server-side search, the route's own filters, a created_at window, paging,
 * a detail dialog per row, export of every matching row, and the few actions the API offers (all
 * behind `audit.update`).
 */
export function LogListPage<T extends { id: string }>({ config }: { config: LogListConfig<T> }): React.ReactElement {
  const queryClient = useQueryClient();
  const canAct = useCan('audit.update');
  const list = usePaginatedList<T>({ queryKey: config.queryKey, fetchPage: config.fetchPage });
  const [selected, setSelected] = useState<T | null>(null);
  const [pending, setPending] = useState<{ action: LogRowAction<T>; row: T } | null>(null);
  const [exporting, setExporting] = useState(false);

  const runExport = async () => {
    if (!config.exportColumns) return;
    setExporting(true);
    try {
      const result = await exportAll<T>({
        fetchPage: config.fetchPage,
        params: list.params,
        filename: `${config.title.toLowerCase().replace(/\s+/g, '-')}.csv`,
        confirmLarge: async (count) => window.confirm(`This export has ${count.toLocaleString()} rows. Continue?`),
        columns: [...config.exportColumns],
      });
      if (!result.cancelled) notify.success(`Exported ${result.rows.toLocaleString()} rows.`, { title: 'Export ready' });
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 flex-1 min-h-0 w-full">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">{config.title}</h1>
          <p className="text-xs text-slate-400 mt-1">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder={config.searchPlaceholder ?? 'Search…'} value={list.search} onChange={(e) => list.setSearch(e.target.value)} onClear={() => list.setSearch('')} aria-label={`Search ${config.title.toLowerCase()}`} className="w-52" />
          {config.filters?.map((filter) =>
            filter.options ? (
              <select key={filter.key} aria-label={`Filter by ${filter.label.toLowerCase()}`} value={String(list.filters[filter.key] ?? '')} onChange={(e) => list.setFilter(filter.key, e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
                <option value="">All {filter.label.toLowerCase()}</option>
                {filter.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <TextFilter key={filter.key} filter={filter} onApply={(value) => list.setFilter(filter.key, value)} />
            )
          )}
          {config.dateRange && (
            <>
              <input type="date" aria-label="From" value={String(list.filters.created_at__gte ?? '')} onChange={(e) => list.setFilter('created_at__gte', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200" />
              <input type="date" aria-label="To" value={String(list.filters.created_at__lte ?? '')} onChange={(e) => list.setFilter('created_at__lte', e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200" />
            </>
          )}
          {config.exportColumns && (
            <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />} isLoading={exporting} onClick={() => void runExport()}>
              Export
            </Button>
          )}
        </div>
      </div>

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.rows.length === 0 ? list.error : null}
        onRetry={() => void list.refetch()}
        entityName={config.title.toLowerCase()}
        isEmpty={list.rows.length === 0}
        empty={{ title: `No ${config.title.toLowerCase()}`, description: 'Nothing matches the search and filters.' }}
      >
        <Table label={config.title} columns={[...config.columns.map((c) => c.header), '']}>
          {list.rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-900/60">
              {config.columns.map((c) => (
                <td key={c.header} className="px-4 py-2 text-slate-300">
                  {c.cell(row)}
                </td>
              ))}
              <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                {canAct &&
                  config.actions
                    ?.filter((a) => a.when(row))
                    .map((a) => (
                      <button key={a.label} type="button" className="text-amber-400 hover:underline" aria-label={`${a.label} ${config.rowTitle(row)}`} onClick={() => setPending({ action: a, row })}>
                        {a.label}
                      </button>
                    ))}
                <button type="button" className="text-cyan-300 hover:underline" aria-label={`Details of ${config.rowTitle(row)}`} onClick={() => setSelected(row)}>
                  Details
                </button>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="entries" />
      </QueryBoundary>

      {selected && (
        <Dialog isOpen onClose={() => setSelected(null)} title={config.rowTitle(selected)} size="2xl">
          {config.detail(selected)}
        </Dialog>
      )}
      <ConfirmDialog
        isOpen={pending !== null}
        title={pending ? `${pending.action.label}: ${config.rowTitle(pending.row)}` : ''}
        message={pending ? pending.action.confirm(pending.row) : ''}
        confirmLabel={pending?.action.label ?? 'Confirm'}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          await pending.action.run(pending.row);
          await queryClient.invalidateQueries({ queryKey: config.queryKey });
        }}
      />
    </div>
  );
}
