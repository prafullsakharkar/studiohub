import React, { useState } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Layers,
  ExternalLink,
  Edit2,
  Trash2,
  Eye,
} from 'lucide-react';
import { FieldDefinition, SortConfig, EntityAction } from '@/types/crud';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { EntityReferenceComponent } from '@/shared/relationships/EntityReference';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

interface TableViewProps<T = any> {
  data: T[];
  fields: FieldDefinition<T>[];
  visibleColumns: string[];
  sortConfig: SortConfig[];
  onSortChange: (field: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  groupBy?: string;
  actions?: EntityAction<T>[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function TableView<T extends { id: string }>({
  data,
  fields,
  visibleColumns,
  sortConfig,
  onSortChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  groupBy,
  actions = [],
  onRowClick,
  isLoading = false,
  emptyMessage = 'No matching records found.',
}: TableViewProps<T>) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);

  const activeFields = fields.filter((f) =>
    visibleColumns.length > 0 ? visibleColumns.includes(f.key) : !f.hiddenByDefault
  );

  const isAllSelected = data.length > 0 && selectedIds.length === data.length;
  const isPartiallySelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Group data if groupBy is specified
  const groupedData: Record<string, T[]> = React.useMemo(() => {
    if (!groupBy) return { 'All Items': data };
    const map: Record<string, T[]> = {};
    data.forEach((item: any) => {
      const key = String(item[groupBy] || 'Unassigned');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [data, groupBy]);

  const renderCellContent = (item: any, field: FieldDefinition<T>) => {
    const val = item[field.key];

    if (field.renderCell) {
      return field.renderCell(val, item);
    }

    if (val === undefined || val === null || val === '') {
      return <span className="text-slate-600 font-mono italic">—</span>;
    }

    switch (field.type) {
      case 'status':
        return <StatusBadge status={val} size="sm" />;
      case 'priority':
        return <PriorityBadge priority={val} size="sm" />;
      case 'reference':
        if (field.referenceType) {
          return (
            <EntityReferenceComponent
              type={field.referenceType}
              id={val}
              variant="pill"
              showAvatar
              showCode
            />
          );
        }
        return <span className="font-mono text-xs text-slate-300">{val}</span>;
      case 'thumbnail':
        return (
          <div className="w-12 h-7 rounded bg-slate-950 overflow-hidden border border-slate-800 flex-shrink-0">
            <img src={val} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
        );
      case 'tags':
        if (Array.isArray(val)) {
          return (
            <div className="flex flex-wrap gap-1">
              {val.map((t, idx) => (
                <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                  {t}
                </span>
              ))}
            </div>
          );
        }
        return String(val);
      case 'progress':
        return (
          <div className="flex items-center gap-2 min-w-[90px]">
            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, Number(val) || 0))}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-slate-400">{val}%</span>
          </div>
        );
      case 'currency':
        return <span className="font-mono text-xs text-emerald-400">${Number(val).toLocaleString()}</span>;
      case 'number':
        return <span className="font-mono text-xs text-slate-300">{Number(val).toLocaleString()}</span>;
      case 'date':
        return <span className="font-mono text-xs text-slate-400">{val}</span>;
      case 'boolean':
        return val ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            YES
          </span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-mono">
            NO
          </span>
        );
      default:
        return <span className="text-xs text-slate-200 truncate">{String(val)}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner message="Querying dataset and resolving references..." />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold sticky top-0 z-10">
            <tr>
              {/* Select All Checkbox */}
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>

              {/* Dynamic Column Headers */}
              {activeFields.map((field) => {
                const sort = sortConfig.find((s) => s.field === field.key);
                return (
                  <th
                    key={field.key}
                    style={{ width: field.width, minWidth: field.minWidth || 100 }}
                    onClick={() => field.sortable !== false && onSortChange(field.key)}
                    className={`px-3 py-3 font-medium transition-colors select-none ${
                      field.sortable !== false ? 'cursor-pointer hover:text-slate-200' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{field.label}</span>
                      {field.sortable !== false && (
                        <span className="text-slate-600">
                          {sort?.direction === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                          ) : sort?.direction === 'desc' ? (
                            <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 hover:text-slate-400" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}

              {/* Actions Header */}
              {actions.length > 0 && <th className="w-12 px-3 py-3 text-right">Actions</th>}
            </tr>
          </thead>

          {/* Table Body with Grouping */}
          <tbody className="divide-y divide-slate-800/60">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={activeFields.length + 2}
                  className="px-4 py-16 text-center text-slate-500 text-xs"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              Object.entries(groupedData).map(([groupTitle, groupItems]) => {
                const isCollapsed = collapsedGroups[groupTitle];

                return (
                  <React.Fragment key={groupTitle}>
                    {/* Group Header Row (if grouping enabled) */}
                    {groupBy && (
                      <tr
                        onClick={() => toggleGroupCollapse(groupTitle)}
                        className="bg-slate-950/60 hover:bg-slate-950 text-slate-300 font-semibold cursor-pointer select-none transition-colors border-t border-b border-slate-800"
                      >
                        <td colSpan={activeFields.length + 2} className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-slate-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="text-xs uppercase tracking-wider font-mono text-indigo-400">
                              {groupBy}:
                            </span>
                            <span className="text-slate-200">{groupTitle}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                              {groupItems.length} items
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Group Items Rows */}
                    {!isCollapsed &&
                      groupItems.map((item) => {
                        const isSelected = selectedIds.includes(item.id);

                        return (
                          <tr
                            key={item.id}
                            onClick={() => onRowClick && onRowClick(item)}
                            className={`transition-colors group ${
                              isSelected
                                ? 'bg-indigo-950/20 hover:bg-indigo-950/30'
                                : 'hover:bg-slate-800/40 bg-slate-900/20'
                            } ${onRowClick ? 'cursor-pointer' : ''}`}
                          >
                            {/* Checkbox Cell */}
                            <td
                              className="px-3 py-2.5 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelect(item.id)}
                                className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </td>

                            {/* Data Cells */}
                            {activeFields.map((field) => (
                              <td key={field.key} className="px-3 py-2.5 align-middle">
                                {renderCellContent(item, field)}
                              </td>
                            ))}

                            {/* Row Action Cell */}
                            {actions.length > 0 && (
                              <td
                                className="px-3 py-2.5 text-right relative"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActionMenuOpenId(actionMenuOpenId === item.id ? null : item.id)
                                  }
                                  className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>

                                {actionMenuOpenId === item.id && (
                                  <div className="absolute right-3 top-full mt-1 z-50 rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl p-1 w-36 space-y-0.5 text-left">
                                    {actions.map((act) => {
                                      if (act.isVisible && !act.isVisible(item)) return null;
                                      return (
                                        <button
                                          key={act.id}
                                          type="button"
                                          onClick={() => {
                                            act.action(item);
                                            setActionMenuOpenId(null);
                                          }}
                                          disabled={act.disabled && act.disabled(item)}
                                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
                                        >
                                          {act.icon}
                                          <span>{act.label}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
