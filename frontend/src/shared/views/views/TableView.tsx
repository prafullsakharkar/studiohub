import React from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Check,
  X,
  Layers,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { FieldDefinition, SortConfig, EntityAction } from '@/types/common';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

export interface TableViewProps<T = any> {
  data: T[];
  fields: FieldDefinition<T>[];
  visibleColumns: string[];
  sortConfig?: SortConfig[];
  onSortChange?: (fieldKey: string) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  groupBy?: string;
  actions?: EntityAction<T>[];
  onRowClick?: (item: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  /**
   * Optional permission checker (e.g. `can` from `useAuth`). Row actions
   * carrying `requiredPermission` the checker denies are hidden.
   */
  canItem?: (permission?: string) => boolean;
}

export function TableView<T extends { id: string }>({
  data,
  fields,
  visibleColumns,
  sortConfig = [],
  onSortChange,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
  groupBy,
  actions = [],
  onRowClick,
  isLoading = false,
  emptyMessage = 'No records found.',
  canItem,
}: TableViewProps<T>) {
  const activeFields = React.useMemo(() => {
    return fields.filter((f) => visibleColumns.includes(f.key));
  }, [fields, visibleColumns]);

  const allSelected = data.length > 0 && selectedIds.length === data.length;
  const isPartiallySelected = selectedIds.length > 0 && selectedIds.length < data.length;

  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  // Group data if groupBy is provided
  const groupedData = React.useMemo(() => {
    if (!groupBy) return null;
    const map: Record<string, T[]> = {};
    data.forEach((item: any) => {
      const key = String(item[groupBy] || 'Unassigned');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [data, groupBy]);

  const renderCellContent = (field: FieldDefinition<T>, item: T) => {
    const val = (item as any)[field.key];

    if (field.render) {
      return field.render(val, item);
    }

    if (val === undefined || val === null || val === '') {
      return <span className="text-slate-600 font-mono text-xs">—</span>;
    }

    if (field.type === 'status' || field.key === 'status') {
      return <StatusBadge status={String(val)} size="sm" />;
    }

    if (field.type === 'priority' || field.key === 'priority') {
      return <PriorityBadge priority={String(val)} size="sm" />;
    }

    if (field.type === 'boolean' || typeof val === 'boolean') {
      return val ? (
        <span className="inline-flex items-center text-emerald-400 font-mono text-xs">
          <Check className="w-3.5 h-3.5 mr-1" /> Yes
        </span>
      ) : (
        <span className="inline-flex items-center text-slate-500 font-mono text-xs">
          <X className="w-3.5 h-3.5 mr-1" /> No
        </span>
      );
    }

    if (field.type === 'badge') {
      return <Badge variant="neutral" size="sm">{String(val)}</Badge>;
    }

    if (field.type === 'avatar' || field.type === 'media') {
      return (
        <div className="w-7 h-7 rounded-md overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
          <img
            src={String(val)}
            alt=""
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (field.type === 'date') {
      try {
        const d = new Date(String(val));
        if (!isNaN(d.getTime())) {
          return <span className="font-mono text-xs text-slate-400">{d.toLocaleDateString()}</span>;
        }
      } catch {
        // fallback
      }
    }

    if (field.key === 'code' || field.key.endsWith('_code')) {
      return <span className="font-mono font-medium text-xs text-indigo-400">{String(val)}</span>;
    }

    return <span className="text-xs text-slate-200 truncate">{String(val)}</span>;
  };

  const renderSortIndicator = (fieldKey: string) => {
    const current = sortConfig.find((s) => s.field === fieldKey);
    if (!current) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 transition-colors" />;
    }
    return current.direction === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
    );
  };

  const renderRow = (item: T) => {
    const isSelected = selectedIds.includes(item.id);

    return (
      <tr
        key={item.id}
        onClick={() => onRowClick && onRowClick(item)}
        className={`group border-b border-slate-800/80 transition-colors ${
          onRowClick ? 'cursor-pointer' : ''
        } ${
          isSelected
            ? 'bg-indigo-950/30 hover:bg-indigo-950/50'
            : 'hover:bg-slate-850/50 bg-slate-900/40'
        }`}
      >
        {/* Selection Checkbox */}
        {onToggleSelect && (
          <td
            className="w-10 px-3 py-2.5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(item.id)}
              aria-label={`Select row ${(item as any).name || (item as any).title || (item as any).code || item.id}`}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          </td>
        )}

        {/* Data Columns */}
        {activeFields.map((field) => (
          <td
            key={field.key}
            className="px-3 py-2.5 max-w-xs truncate align-middle"
            style={field.width ? { width: `${field.width}px` } : undefined}
          >
            {renderCellContent(field, item)}
          </td>
        ))}

        {/* Action Column */}
        {actions.length > 0 && (
          <td
            className="px-3 py-2.5 text-right whitespace-nowrap align-middle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end gap-1">
              {actions.map((act) => {
                const isVisible = act.isVisible ? act.isVisible(item) : true;
                if (!isVisible) return null;
                if (canItem && act.requiredPermission && !canItem(act.requiredPermission)) return null;
                const isDisabled =
                  typeof act.disabled === 'function' ? act.disabled(item) : Boolean(act.disabled);

                return (
                  <button
                    key={act.id || act.label}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => act.action && act.action(item)}
                    title={act.label}
                    className={`p-1 rounded text-xs transition-colors ${
                      act.variant === 'danger'
                        ? 'text-rose-400 hover:bg-rose-950/40 hover:text-rose-300'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    } disabled:opacity-40 disabled:pointer-events-none`}
                  >
                    {act.icon ? act.icon : act.label}
                  </button>
                );
              })}
            </div>
          </td>
        )}
      </tr>
    );
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/70 shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[11px] text-slate-400 uppercase tracking-wider">
          <tr>
            {/* Selection Checkbox */}
            {onToggleSelectAll && (
              <th className="w-10 px-3 py-3 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label="Select all rows"
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
            )}

            {/* Field Headers */}
            {activeFields.map((field) => {
              const isSortable = field.sortable !== false && onSortChange;

              return (
                <th
                  key={field.key}
                  onClick={() => isSortable && onSortChange(field.key)}
                  className={`px-3 py-3 font-semibold select-none ${
                    isSortable ? 'cursor-pointer hover:text-slate-200 group' : ''
                  }`}
                  style={field.width ? { width: `${field.width}px` } : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{field.label}</span>
                    {isSortable && renderSortIndicator(field.key)}
                  </div>
                </th>
              );
            })}

            {/* Actions Header */}
            {actions.length > 0 && (
              <th className="px-3 py-3 text-right font-semibold">Actions</th>
            )}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-800/50">
          {isLoading ? (
            <tr>
              <td
                colSpan={activeFields.length + (onToggleSelect ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                className="py-16 text-center"
              >
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                  <LoadingSpinner size="md" />
                  <span className="text-xs">Loading records...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={activeFields.length + (onToggleSelect ? 1 : 0) + (actions.length > 0 ? 1 : 0)}
                className="py-14 text-center text-slate-500 italic text-xs"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : groupedData ? (
            Object.entries(groupedData).map(([groupName, items]) => {
              const isCollapsed = collapsedGroups[groupName];

              return (
                <React.Fragment key={groupName}>
                  <tr
                    onClick={() => toggleGroup(groupName)}
                    className="bg-slate-950/60 border-y border-slate-800/80 cursor-pointer hover:bg-slate-950/90 transition-colors"
                  >
                    <td
                      colSpan={
                        activeFields.length +
                        (onToggleSelect ? 1 : 0) +
                        (actions.length > 0 ? 1 : 0)
                      }
                      className="px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{groupName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          {items.length}
                        </span>
                      </div>
                    </td>
                  </tr>
                  {!isCollapsed && items.map(renderRow)}
                </React.Fragment>
              );
            })
          ) : (
            data.map(renderRow)
          )}
        </tbody>
      </table>
    </div>
  );
}
