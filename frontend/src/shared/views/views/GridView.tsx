import React from 'react';
import { FieldDefinition, EntityAction } from '@/types/crud';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { EntityReferenceComponent } from '@/shared/relationships/EntityReference';
import { MoreVertical } from 'lucide-react';

interface GridViewProps<T = any> {
  data: T[];
  fields: FieldDefinition<T>[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  actions?: EntityAction<T>[];
  onCardClick?: (item: T) => void;
  emptyMessage?: string;
}

export function GridView<T extends { id: string }>({
  data,
  fields,
  selectedIds,
  onToggleSelect,
  actions = [],
  onCardClick,
  emptyMessage = 'No items to display.',
}: GridViewProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {data.map((item: any) => {
        const isSelected = selectedIds.includes(item.id);
        const title = item.name || item.title || item.code || `Item #${item.id}`;
        const code = item.code || item.slug || item.id;
        const thumbnail = item.thumbnail_url || item.avatar_url || item.banner_url;
        const status = item.status;
        const priority = item.priority;

        return (
          <div
            key={item.id}
            onClick={() => onCardClick && onCardClick(item)}
            className={`rounded-xl border transition-all overflow-hidden flex flex-col justify-between group ${
              isSelected
                ? 'bg-indigo-950/30 border-indigo-500 ring-1 ring-indigo-500/40 shadow-lg'
                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:shadow-md'
            } ${onCardClick ? 'cursor-pointer' : ''}`}
          >
            {/* Top Media / Header area */}
            <div>
              {thumbnail ? (
                <div className="aspect-video bg-slate-950 relative overflow-hidden border-b border-slate-800">
                  <img
                    src={thumbnail}
                    alt={title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  {status && (
                    <div className="absolute top-2 right-2">
                      <StatusBadge status={status} size="sm" />
                    </div>
                  )}
                  {/* Selection Checkbox */}
                  <div
                    className="absolute top-2 left-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect(item.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(item.id)}
                      className="rounded border-slate-700 bg-slate-900/90 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                  <div
                    className="flex items-center gap-2"
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
                    <span className="font-mono text-xs font-semibold text-slate-300">
                      {code}
                    </span>
                  </div>
                  {status && <StatusBadge status={status} size="sm" />}
                </div>
              )}

              {/* Card Body */}
              <div className="p-3.5 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between gap-1">
                    {thumbnail && (
                      <span className="font-mono text-[11px] text-indigo-400 font-semibold truncate">
                        {code}
                      </span>
                    )}
                    {priority && <PriorityBadge priority={priority} size="sm" />}
                  </div>
                  <h4 className="font-semibold text-xs text-slate-100 line-clamp-1 mt-0.5">
                    {title}
                  </h4>
                  {item.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                  )}
                </div>

                {/* Key metadata grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/40 p-2 rounded-lg border border-slate-800/60 font-mono">
                  {item.project_code && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Project</span>
                      <span className="text-slate-300 truncate block">{item.project_code}</span>
                    </div>
                  )}
                  {item.department && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Dept</span>
                      <span className="text-slate-300 truncate block">{item.department}</span>
                    </div>
                  )}
                  {item.due_date && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Due</span>
                      <span className="text-amber-300/90 truncate block">{item.due_date}</span>
                    </div>
                  )}
                  {item.frame_count && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Frames</span>
                      <span className="text-slate-300 truncate block">{item.frame_count} f</span>
                    </div>
                  )}
                  {item.logged_hours !== undefined && (
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase block">Logged</span>
                      <span className="text-slate-300">{item.logged_hours}h</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Card Footer */}
            <div className="p-3 pt-0 flex items-center justify-between text-xs text-slate-400">
              {item.assignee_name ? (
                <span className="text-[11px] text-slate-300 truncate">
                  👤 {item.assignee_name}
                </span>
              ) : item.client_name ? (
                <span className="text-[11px] text-slate-300 truncate">
                  🏢 {item.client_name}
                </span>
              ) : (
                <span className="text-[11px] text-slate-600 font-mono">ID: {item.id}</span>
              )}

              {actions.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    actions[0]?.action(item);
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  View Details
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
