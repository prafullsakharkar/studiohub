import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Download, Eye, Plus, Search, Trash2, Workflow } from 'lucide-react';
import { DEPARTMENT_TYPES, DEPARTMENT_ORDERING, departmentsApi } from '@/api/masterdata/departments';
import type { Department } from '@/api/masterdata/departments';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { exportAll } from '@/shared/data/exportAll';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { useDeleteDepartment, useDepartmentList } from '../hooks/useDepartmentList';

const SORT_LABELS: Record<(typeof DEPARTMENT_ORDERING)[number], string> = { name: 'Name', code: 'Code', created_at: 'Newest' };

export const DepartmentsListPage: React.FC = () => {
  const list = useDepartmentList();
  const deleteDepartment = useDeleteDepartment();
  const canManage = useCan('masterdata.directory.manage');
  const [toDelete, setToDelete] = useState<Department | null>(null);
  const [exporting, setExporting] = useState<AbortController | null>(null);

  const runExport = async () => {
    const controller = new AbortController();
    setExporting(controller);
    try {
      const result = await exportAll<Department>({
        fetchPage: departmentsApi.list,
        params: list.params,
        filename: 'departments.csv',
        signal: controller.signal,
        confirmLarge: async (count) => window.confirm(`This export has ${count.toLocaleString()} rows. Continue?`),
        columns: [
          { header: 'Code', value: (d) => d.code },
          { header: 'Name', value: (d) => d.name },
          { header: 'Type', value: (d) => d.department_type },
          { header: 'Description', value: (d) => d.description },
          { header: 'Created', value: (d) => d.created_at },
        ],
      });
      if (!result.cancelled) notify.success(`Exported ${result.rows.toLocaleString()} departments.`, { title: 'Export ready' });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
    } finally {
      setExporting(null);
    }
  };

  const filtered = Boolean(list.search || list.filters.department_type);

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-5 h-5 text-indigo-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Departments</h1>
            {!list.error && !list.isLoading && (
              <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
                {list.count} {filtered ? 'Matching' : 'Registered'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">Functional studio departments (Lighting, Comp, FX, Pipeline).</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            placeholder="Search name or code..."
            value={list.search}
            onChange={(e) => list.setSearch(e.target.value)}
            onClear={() => list.setSearch('')}
            className="w-56"
          />
          <select
            aria-label="Filter by type"
            value={String(list.filters.department_type ?? '')}
            onChange={(e) => list.setFilter('department_type', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">All types</option>
            {DEPARTMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort by"
            value={list.sortState?.field ?? ''}
            onChange={(e) => list.setOrdering(e.target.value ? (e.target.value === 'created_at' ? '-created_at' : e.target.value) : undefined)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
          >
            <option value="">Default order</option>
            {DEPARTMENT_ORDERING.map((field) => (
              <option key={field} value={field}>
                {SORT_LABELS[field]}
              </option>
            ))}
          </select>
          {list.sortState && (
            <button
              type="button"
              aria-label={list.sortState.direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
              onClick={() => list.toggleSort(list.sortState!.field)}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:text-white"
            >
              {list.sortState.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
            </button>
          )}
          {exporting ? (
            <Button size="sm" variant="outline" onClick={() => exporting.abort()}>
              Cancel export
            </Button>
          ) : (
            <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={runExport} disabled={list.count === 0}>
              Export CSV
            </Button>
          )}
          {canManage && (
            <Link to="/departments/new">
              <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                Add Department
              </Button>
            </Link>
          )}
        </div>
      </div>

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.rows.length === 0 ? list.error : null}
        onRetry={() => void list.refetch()}
        entityName="departments"
        isEmpty={list.rows.length === 0}
        empty={{
          icon: <Search className="w-6 h-6 text-slate-400" />,
          title: filtered ? 'No departments match your filters' : 'No departments configured yet',
          description: filtered ? 'Try a different search term or clear the filters.' : 'Set up functional departments to route crew and tasks.',
        }}
      >
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
          {list.rows.map((dept) => (
            <div key={dept.id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {dept.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dept.color }} aria-hidden />}
                    <span className="font-bold text-sm text-white truncate">{dept.name}</span>
                    <span className="px-1.5 rounded bg-indigo-950 font-mono text-[10px] font-bold text-indigo-300 border border-indigo-500/30 shrink-0">
                      {dept.code}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono shrink-0 text-indigo-300 border-indigo-500/30 capitalize">
                  {dept.department_type}
                </Badge>
              </div>

              <p className="text-xs text-slate-400 line-clamp-2 min-h-[2rem]">{dept.description || 'No description provided.'}</p>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/70">
                <Link to={`/departments/${dept.id}`}>
                  <Button size="xs" variant="outline" leftIcon={<Eye className="w-3 h-3" />}>
                    Open
                  </Button>
                </Link>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => setToDelete(dept)}
                    className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <Pagination
          currentPage={list.page}
          totalCount={list.count}
          pageSize={list.pageSize}
          totalPages={list.pageCount}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          itemLabel="departments"
          className="mt-4"
        />
      </QueryBoundary>

      <ConfirmDialog
        isOpen={toDelete !== null}
        title="Delete department"
        destructive
        confirmLabel="Delete"
        message={
          <>
            Delete <strong>{toDelete?.name}</strong> [{toDelete?.code}]? This cannot be undone.
          </>
        }
        onConfirm={() => deleteDepartment.mutateAsync(toDelete!)}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
};
