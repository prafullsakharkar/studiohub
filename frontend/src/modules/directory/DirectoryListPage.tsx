import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Download, Plus, Trash2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { InputError } from '@/api/errors/serverMessage';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { exportAll } from '@/shared/data/exportAll';
import { fetchAllRows } from '@/shared/data/listing';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { SearchInput } from '@/shared/components/SearchInput';
import type { BulkAction, DirectoryListConfig, ListFilter, RowAction } from './types';

function FilterSelect({ filter, value, onChange }: { filter: ListFilter; value: string; onChange: (value: string) => void }) {
  const loaded = useQuery({
    queryKey: [...(filter.optionsFrom?.queryKey ?? ['none']), 'filter-options'],
    queryFn: ({ signal }) => fetchAllRows((filter.optionsFrom as NonNullable<ListFilter['optionsFrom']>).fetchPage, {}, { signal }),
    enabled: Boolean(filter.optionsFrom),
    staleTime: 60_000,
  });
  const options = filter.options ?? (loaded.data ?? []).map((row) => ({ value: row.id, label: (filter.optionsFrom as NonNullable<ListFilter['optionsFrom']>).getLabel(row as never) }));
  return (
    <select aria-label={`Filter by ${filter.label.toLowerCase()}`} value={value} onChange={(e) => onChange(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
      <option value="">All {filter.label.toLowerCase()}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * One list screen for every directory entity: server-side search / filters / ordering / paging with the
 * backend's own parameter names, export of ALL filtered rows (Q4), and delete with the server's reason
 * (a referenced row answers 409 `has_dependants`, shown by ConfirmDialog).
 */
export function DirectoryListPage<T extends { id: string }>({ config }: { config: DirectoryListConfig<T> }): React.ReactElement {
  const queryClient = useQueryClient();
  const canManage = useCan(config.managePermission);
  const canCreate = useCan(config.createPermission ?? config.managePermission);
  const canDelete = useCan(config.deletePermission ?? config.managePermission);
  const [view, setView] = useState<'active' | 'archived'>('active');
  const inArchive = view === 'archived' && Boolean(config.archived);
  const fetchPage = inArchive ? (config.archived as NonNullable<typeof config.archived>).fetchPage : config.fetchPage;
  const list = usePaginatedList<T>({ queryKey: [...config.queryKey, view, config.scope ?? {}], fetchPage, ordering: config.defaultOrdering, filters: config.scope });
  const [toDelete, setToDelete] = useState<T | null>(null);
  const [pendingAction, setPendingAction] = useState<(RowAction & { rowName: string }) | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkInput, setBulkInput] = useState('');
  const [actionText, setActionText] = useState('');
  const [actionDate, setActionDate] = useState('');
  const [exporting, setExporting] = useState<AbortController | null>(null);
  // Ticks belong to the page they were made on: a new page, search, filter or view starts clean.
  const paramsKey = JSON.stringify(list.params);
  useEffect(() => setSelected(new Set()), [paramsKey, view]);
  const bulkActions = canManage && !inArchive ? (config.bulk?.actions ?? []).filter((a) => !a.available || a.available(list.filters)) : [];
  const toggle = (id: string) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const filtered = Boolean(list.search || Object.values(list.filters).some(Boolean));

  const runExport = async () => {
    if (!config.exportColumns) return;
    const controller = new AbortController();
    setExporting(controller);
    try {
      const result = await exportAll<T>({
        fetchPage,
        params: list.params,
        filename: `${config.title.toLowerCase().replace(/\s+/g, '-')}.csv`,
        signal: controller.signal,
        confirmLarge: async (count) => window.confirm(`This export has ${count.toLocaleString()} rows. Continue?`),
        columns: [...config.exportColumns],
      });
      if (!result.cancelled) notify.success(`Exported ${result.rows.toLocaleString()} ${config.title.toLowerCase()}.`, { title: 'Export ready' });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) notify.error(error instanceof Error ? error.message : 'Export failed.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">{config.title}</h1>
            {!list.error && !list.isLoading && (
              <Badge variant="outline" className="font-mono text-xs">
                {list.count} {filtered ? 'Matching' : 'Registered'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{config.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput placeholder={config.searchPlaceholder} value={list.search} onChange={(e) => list.setSearch(e.target.value)} onClear={() => list.setSearch('')} aria-label={`Search ${config.title.toLowerCase()}`} className="w-56" />
          {config.filters?.filter((filter) => !(config.scope && filter.key in config.scope)).map((filter) => (
            <FilterSelect key={filter.key} filter={filter} value={String(list.filters[filter.key] ?? '')} onChange={(value) => list.setFilter(filter.key, value)} />
          ))}
          {config.archived && (
            <select aria-label="Show" value={view} onChange={(e) => setView(e.target.value as 'active' | 'archived')} className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          )}
          {config.exportColumns && (
            <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />} isLoading={exporting !== null} onClick={() => void runExport()}>
              Export
            </Button>
          )}
          {config.headerExtra?.(list.filters)}
          {canCreate && (
            <Link to={`${config.basePath}/new${config.createQuery ? `?${config.createQuery}` : ''}`}>
              <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                New {config.noun}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.rows.length === 0 ? list.error : null}
        onRetry={() => void list.refetch()}
        entityName={config.title.toLowerCase()}
        isEmpty={list.rows.length === 0}
        empty={{ title: `No ${config.title.toLowerCase()} found`, description: filtered ? 'Nothing matches the search or filters.' : `No ${config.title.toLowerCase()} have been created yet.` }}
      >
        {selected.size > 0 && bulkActions.length > 0 && (
          <div role="toolbar" aria-label="Actions for the selected rows" className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-900/60 bg-cyan-950/30 px-3 py-2 text-xs text-slate-200">
            <span className="font-semibold">{selected.size} selected</span>
            {bulkActions.map((action) => (
              <Button key={action.label} size="sm" variant={action.destructive ? 'danger' : 'outline'} onClick={() => { setBulkInput(''); setBulkAction(action); }}>
                {action.label}
              </Button>
            ))}
            <button type="button" className="ml-auto text-slate-400 hover:text-slate-200" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table aria-label={config.title} className="w-full text-xs">
            <thead className="bg-slate-900 text-slate-400 text-left">
              <tr>
                {bulkActions.length > 0 && (
                  <th scope="col" className="px-3 py-2 w-8">
                    <input type="checkbox" aria-label="Select all on this page" checked={list.rows.length > 0 && list.rows.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(list.rows.map((r) => r.id)) : new Set())} />
                  </th>
                )}
                {config.columns.map((column) => {
                  const active = column.sortField && list.sortState?.field === column.sortField ? list.sortState : null;
                  return (
                    <th key={column.header} scope="col" aria-sort={active ? (active.direction === 'asc' ? 'ascending' : 'descending') : undefined} className="px-4 py-2 font-semibold">
                      {column.sortField ? (
                        <button type="button" className="inline-flex items-center gap-1 hover:text-slate-200" onClick={() => list.toggleSort(column.sortField as string)}>
                          {column.header}
                          {active && (active.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
                {canManage && <th scope="col" className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {list.rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/60">
                  {bulkActions.length > 0 && (
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Select ${config.rowName(row)}`} checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                    </td>
                  )}
                  {config.columns.map((column, index) => (
                    <td key={column.header} className="px-4 py-2 text-slate-300">
                      {index === 0 ? (
                        (config.rowLink ? config.rowLink(row) : `${config.basePath}/${row.id}`) === null ? (
                          <span className="font-semibold text-slate-100">{column.cell(row)}</span>
                        ) : (
                          <Link to={(config.rowLink ? config.rowLink(row) : `${config.basePath}/${row.id}`) as string} className="font-semibold text-cyan-300 hover:underline">
                            {column.cell(row)}
                          </Link>
                        )
                      ) : (
                        column.cell(row)
                      )}
                    </td>
                  ))}
                  {canManage && (
                    <td className="px-4 py-2 text-right space-x-3 whitespace-nowrap">
                      {inArchive && (
                        <button type="button" className="text-cyan-300 hover:underline" aria-label={`Restore ${config.rowName(row)}`} onClick={() => setPendingAction({ label: 'Restore', confirm: `Restore ${config.rowName(row)}?`, run: () => (config.archived as NonNullable<typeof config.archived>).restore(row.id), rowName: config.rowName(row) })}>
                          Restore
                        </button>
                      )}
                      {!inArchive && config.rowActions?.(row).map((action) => (
                        <button key={action.label} type="button" className={action.destructive ? 'text-amber-400 hover:underline' : 'text-cyan-300 hover:underline'} aria-label={`${action.label} ${config.rowName(row)}`} onClick={() => { setActionText(''); setActionDate(action.askDate?.initial ?? ''); setPendingAction({ ...action, rowName: config.rowName(row) }); }}>
                          {action.label}
                        </button>
                      ))}
                      {!inArchive && (config.canEdit?.(row) ?? true) && (
                        <Link to={`${config.basePath}/${row.id}/edit`} className="text-cyan-300 hover:underline" aria-label={`Edit ${config.rowName(row)}`}>
                          Edit
                        </Link>
                      )}
                      {!inArchive && canDelete && (config.canRemove?.(row) ?? true) && (
                        <button type="button" className="text-rose-400 hover:text-rose-300" aria-label={`${config.deleteLabel ?? 'Delete'} ${config.rowName(row)}`} onClick={() => setToDelete(row)}>
                          {config.deleteLabel ?? <Trash2 className="inline w-3.5 h-3.5" />}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel={config.title.toLowerCase()} />
      </QueryBoundary>

      <ConfirmDialog
        isOpen={bulkAction !== null}
        title={bulkAction ? `${bulkAction.label} ${selected.size} ${selected.size === 1 ? config.noun : config.title.toLowerCase()}` : ''}
        message={
          <>
            {bulkAction?.confirm(selected.size)}
            {bulkAction?.input && <div className="mt-3">{bulkAction.input.render({ value: bulkInput, onChange: setBulkInput, filters: list.filters })}</div>}
          </>
        }
        confirmLabel={bulkAction?.label ?? 'Confirm'}
        destructive={bulkAction?.destructive}
        onClose={() => setBulkAction(null)}
        onConfirm={async () => {
          if (!bulkAction) return;
          if (bulkAction.input?.required && !bulkInput) throw new InputError(`Choose ${bulkAction.input.label.toLowerCase()}.`);
          const summary = await bulkAction.run([...selected], bulkInput || undefined);
          setSelected(new Set());
          await Promise.all([queryClient.invalidateQueries({ queryKey: config.queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
          if (summary) notify.info(summary);
        }}
      />

      <ConfirmDialog
        isOpen={pendingAction !== null}
        title={pendingAction ? `${pendingAction.label} ${pendingAction.rowName}` : ''}
        message={
          <>
            {pendingAction?.confirm}
            {pendingAction?.askDate && (
              <label className="mt-3 block text-xs text-slate-400">
                {pendingAction.askDate.label}
                <input type="date" aria-label={pendingAction.askDate.label} value={actionDate} onChange={(e) => setActionDate(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs" />
              </label>
            )}
            {pendingAction?.askText && (
              <label className="mt-3 block text-xs text-slate-400">
                {pendingAction.askText.label}
                <textarea aria-label={pendingAction.askText.label} rows={3} value={actionText} onChange={(e) => setActionText(e.target.value)} className="mt-1 block w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs" />
              </label>
            )}
          </>
        }
        confirmLabel={pendingAction?.label ?? 'Confirm'}
        destructive={pendingAction?.destructive}
        onClose={() => setPendingAction(null)}
        onConfirm={async () => {
          if (!pendingAction) return;
          if (pendingAction.askDate && !actionDate) throw new InputError(`Choose ${pendingAction.askDate.label.toLowerCase()}.`);
          if (pendingAction.askText?.required && !actionText.trim()) throw new InputError(`Enter ${pendingAction.askText.label.toLowerCase()}.`);
          await pendingAction.run(actionDate || undefined, actionText.trim() || undefined);
          await Promise.all([queryClient.invalidateQueries({ queryKey: config.queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]); // a write adds a history entry
        }}
      />

      <ConfirmDialog
        isOpen={toDelete !== null}
        title={`${config.deleteLabel ?? 'Delete'} ${config.noun}`}
        message={config.deleteLabel ? `${config.deleteLabel} "${toDelete ? config.rowName(toDelete) : ''}"? It moves to the Archived view and can be restored.` : `Delete "${toDelete ? config.rowName(toDelete) : ''}"? This cannot be undone.`}
        confirmLabel={config.deleteLabel ?? 'Delete'}
        destructive
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          await config.remove(toDelete.id);
          await Promise.all([queryClient.invalidateQueries({ queryKey: config.queryKey }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]); // a write adds a history entry
          notify.success(`${config.rowName(toDelete)} was deleted.`);
        }}
      />
    </div>
  );
}
