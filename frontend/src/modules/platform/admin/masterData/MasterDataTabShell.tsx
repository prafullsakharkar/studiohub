import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';
import { MasterDataEntityDef } from './masterDataEntities';

export interface MasterDataItem {
  id: string;
  name: string;
  code: string;
  is_archived?: boolean;
  [key: string]: unknown;
}

interface MasterDataTabShellProps {
  entity: MasterDataEntityDef;
  items: MasterDataItem[];
  isLoading: boolean;
  onCreate?: () => void;
  onEdit?: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Sub tabs component rendered on the left of the toolbar */
  subTabs?: React.ReactNode;
  /** Entity-specific filter UI rendered beside search; ANDed via applyExtraFilter. */
  extraFilters?: React.ReactNode;
  applyExtraFilter?: (item: MasterDataItem) => boolean;
  /** Full-table override for entity-specific columns; receives shell-filtered rows. */
  renderTable?: (items: MasterDataItem[]) => React.ReactNode;
  /** Create button copy; defaults to `New {singular}`. */
  createLabel?: string;
  /** Item string fields matched by search; defaults to name/code/description. */
  searchFields?: string[];
}

export const MasterDataTabShell: React.FC<MasterDataTabShellProps> = ({
  entity,
  items,
  isLoading,
  onCreate,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
  subTabs,
  extraFilters,
  applyExtraFilter,
  renderTable,
  createLabel,
  searchFields,
}) => {
  const { can, canAny } = usePermissionEvaluator();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');

  const allow = (perm: string | string[]) =>
    Array.isArray(perm) ? canAny(perm) : can(perm);
  const permTitle = (perm: string | string[]) =>
    Array.isArray(perm) ? perm.join(' or ') : perm;

  const canCreate = allow(entity.permissions.create);
  const canUpdate = allow(entity.permissions.update);
  const canArchive = allow(entity.permissions.archive);
  const canRestore = allow(entity.permissions.restore);
  const canDelete = allow(entity.permissions.delete);

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-400">Loading {entity.label}…</div>;
  }

  const query = search.trim().toLowerCase();
  const fields = searchFields || ['name', 'code', 'description'];
  const filtered = items.filter((item) => {
    const matchesSearch =
      query.length === 0 ||
      fields.some(
        (f) => typeof item[f] === 'string' && (item[f] as string).toLowerCase().includes(query),
      );
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'archived' ? item.is_archived : !item.is_archived);
    const matchesExtra = applyExtraFilter ? applyExtraFilter(item) : true;
    return matchesSearch && matchesStatus && matchesExtra;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
        {/* Left side: Sub tabs, status filter, extra filters, add button in same row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {subTabs}
          <select
            aria-label="Status filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'archived')}
            className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          {extraFilters}
          {onCreate && (
            <Button
              variant="primary"
              size="sm"
              disabled={!canCreate}
              title={canCreate ? createLabel || `New ${entity.singular}` : permTitle(entity.permissions.create)}
              onClick={onCreate}
              className="h-9 whitespace-nowrap bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-0 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {createLabel || `New ${entity.singular}`}
            </Button>
          )}
        </div>

        {/* Right side: Search in right end */}
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-64 md:ml-auto">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder={entity.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full pl-9 pr-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      </div>

      {renderTable ? (
        renderTable(filtered)
      ) : (

      <table className="w-full text-sm text-slate-200">
        <thead>
          <tr className="text-left text-xs font-mono uppercase tracking-wider text-slate-400">
            {entity.columns.map((col) => (
              <th key={col.key} className="px-3 py-2 border-b border-slate-800">
                {col.header}
              </th>
            ))}
            <th className="px-3 py-2 border-b border-slate-800">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <tr key={item.id} className="border-b border-slate-800/60">
              <td className="px-3 py-2">{item.name}</td>
              <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
              <td className="px-3 py-2">
                <Badge variant="outline">{item.is_archived ? 'Archived' : 'Active'}</Badge>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  {onEdit && canUpdate && !item.is_archived && (
                    <Button variant="ghost" size="sm" onClick={() => onEdit(item.id)}>
                      Edit
                    </Button>
                  )}
                  {onArchive && canArchive && !item.is_archived && (
                    <Button variant="ghost" size="sm" onClick={() => onArchive(item.id)}>
                      Archive
                    </Button>
                  )}
                  {onRestore && canRestore && item.is_archived && (
                    <Button variant="ghost" size="sm" onClick={() => onRestore(item.id)}>
                      Restore
                    </Button>
                  )}
                  {onDelete && canDelete && (
                    <Button variant="ghost" size="sm" onClick={() => onDelete(item.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  );
};
