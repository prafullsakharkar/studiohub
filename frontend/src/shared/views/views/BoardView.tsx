import React from 'react';
import { FieldDefinition, EntityAction } from '@/types/crud';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Plus, ArrowRight, Check } from 'lucide-react';

interface BoardViewProps<T = any> {
  data: T[];
  groupBy?: string;
  onCardClick?: (item: T) => void;
  onStatusChange?: (item: T, nextStatus: string) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  actions?: EntityAction<T>[];
  emptyMessage?: string;
}

const DEFAULT_STATUS_COLUMNS = [
  'Not Started',
  'In Progress',
  'Pending Review',
  'Approved',
  'Completed',
];

export function BoardView<T extends { id: string }>({
  data,
  groupBy = 'status',
  onCardClick,
  onStatusChange,
  selectedIds,
  onToggleSelect,
  actions = [],
  emptyMessage = 'No items in board.',
}: BoardViewProps<T>) {
  // Collect unique group values from data or default columns
  const columns: string[] = React.useMemo(() => {
    if (groupBy === 'status') {
      const statusesInData = Array.from(new Set(data.map((d: any) => d.status))).filter(Boolean);
      return Array.from(new Set([...DEFAULT_STATUS_COLUMNS, ...statusesInData]));
    }
    const set = new Set(data.map((d: any) => String(d[groupBy] || 'Unassigned')));
    return Array.from(set);
  }, [data, groupBy]);

  const grouped: Record<string, T[]> = React.useMemo(() => {
    const map: Record<string, T[]> = {};
    columns.forEach((c) => (map[c] = []));
    data.forEach((item: any) => {
      const key = String(item[groupBy] || 'Unassigned');
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [data, columns, groupBy]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 items-start min-h-[500px]">
      {columns.map((columnKey) => {
        const columnItems = grouped[columnKey] || [];

        return (
          <div
            key={columnKey}
            className="w-72 flex-shrink-0 bg-slate-900/70 border border-slate-800 rounded-xl flex flex-col max-h-[750px] shadow-sm"
          >
            {/* Column Header */}
            <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-slate-200 truncate">
                  {columnKey}
                </span>
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                  {columnItems.length}
                </span>
              </div>
            </div>

            {/* Cards List */}
            <div className="p-2 space-y-2 overflow-y-auto flex-1 pr-1.5">
              {columnItems.length === 0 ? (
                <div className="py-8 text-center text-[11px] text-slate-600 italic">
                  Empty column
                </div>
              ) : (
                columnItems.map((item: any) => {
                  const isSelected = selectedIds.includes(item.id);
                  const title = item.name || item.title || item.code || `Item #${item.id}`;
                  const code = item.code || item.slug || item.id;
                  const priority = item.priority;
                  const thumbnail = item.thumbnail_url || item.avatar_url;

                  return (
                    <div
                      key={item.id}
                      onClick={() => onCardClick && onCardClick(item)}
                      className={`p-3 rounded-lg border transition-all text-xs flex flex-col justify-between group ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                          : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/90'
                      } ${onCardClick ? 'cursor-pointer' : ''}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div
                            className="flex items-center gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSelect(item.id);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect(item.id)}
                              className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                            <span className="font-mono text-[11px] font-semibold text-indigo-400">
                              {code}
                            </span>
                          </div>
                          {priority && <PriorityBadge priority={priority} size="sm" />}
                        </div>

                        <h5 className="font-medium text-slate-200 line-clamp-2 leading-relaxed">
                          {title}
                        </h5>

                        {thumbnail && (
                          <div className="mt-2 rounded overflow-hidden aspect-video bg-slate-950 border border-slate-800">
                            <img
                              src={thumbnail}
                              alt=""
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                      </div>

                      {/* Card meta footer */}
                      <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                        {item.assignee_name ? (
                          <span className="truncate max-w-[120px] text-slate-300">
                            👤 {item.assignee_name}
                          </span>
                        ) : item.project_code ? (
                          <span className="font-mono text-slate-400">
                            {item.project_code}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-slate-600">{item.id}</span>
                        )}

                        {item.due_date && (
                          <span className="text-amber-400/90 font-mono text-[10px]">
                            {item.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
