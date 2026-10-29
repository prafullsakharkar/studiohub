import type React from 'react';
import type { FieldDefinition, EntityAction } from '@/types/common';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { Pagination } from '@/shared/components/Pagination';

export interface GridViewProps<T = any> {
  data: T[];
  fields: FieldDefinition<T>[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  actions?: EntityAction<T>[];
  onCardClick?: (item: T) => void;
  emptyMessage?: string;
  renderCard?: (item: T) => React.ReactNode;
  /**
   * Optional controlled pagination. When `totalCount` is provided, a pager
   * renders below the grid and page changes delegate to the parent
   * (server-driven lists). Absent entirely preserves current behavior.
   */
  page?: number;
  totalCount?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function GridView<T extends { id: string }>({
  data,
  fields,
  selectedIds = [],
  onToggleSelect,
  actions = [],
  onCardClick,
  emptyMessage = 'No items found in grid view.',
  renderCard,
  page = 1,
  totalCount,
  pageSize = 25,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
}: GridViewProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500 italic text-xs bg-slate-900/40 rounded-xl border border-slate-800">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {data.map((item: any) => {
          if (renderCard)
            return (
              <div
                key={item.id}
                aria-label={item.name || item.title || item.code || `Item #${item.id}`}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && onCardClick) {
                    // Ignore key events from nested interactive controls;
                    // mouse clicks are handled by the rendered card itself.
                    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                    e.preventDefault();
                    onCardClick(item);
                  }
                }}
                role={onCardClick ? 'button' : undefined}
                tabIndex={onCardClick ? 0 : undefined}
              >
                {renderCard(item)}
              </div>
            );
        const isSelected = selectedIds.includes(item.id);
        const title = item.name || item.title || item.code || `Item #${item.id}`;
        const code = item.code || item.slug || item.id;
        const thumbnail = item.thumbnail_url || item.avatar_url || item.preview_url || item.image_url;
        const priority = item.priority;
        const status = item.status;
        const department = item.department || item.department_name;

        // Display up to 3 extra metadata fields
        const extraFields = fields
          .filter(
            (f) =>
              !['id', 'name', 'title', 'code', 'slug', 'status', 'priority', 'thumbnail_url', 'avatar_url'].includes(
                f.key
              ) &&
              item[f.key] !== undefined &&
              item[f.key] !== null &&
              item[f.key] !== ''
          )
          .slice(0, 3);

        return (
          <div
            key={item.id}
            onClick={() => onCardClick && onCardClick(item)}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && onCardClick) {
                e.preventDefault();
                onCardClick(item);
              }
            }}
            role={onCardClick ? 'button' : undefined}
            tabIndex={onCardClick ? 0 : undefined}
            aria-label={onCardClick ? String(title) : undefined}
            className={`rounded-xl border transition-all duration-200 overflow-hidden flex flex-col justify-between group ${
              isSelected
                ? 'bg-indigo-950/40 border-indigo-500 shadow-lg ring-1 ring-indigo-500/40'
                : 'bg-slate-900/80 border-slate-800/90 hover:border-slate-700 hover:bg-slate-850 shadow-sm hover:shadow-md'
            } ${onCardClick ? 'cursor-pointer' : ''}`}
          >
            <div>
              {/* Image Preview / Header Area */}
              {thumbnail ? (
                <div className="relative aspect-video w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
                  <img
                    src={thumbnail}
                    alt=""
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  {onToggleSelect && (
                    <div
                      className="absolute top-2 left-2 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(item.id)}
                        className="rounded border-slate-700 bg-slate-900/90 text-indigo-600 focus:ring-indigo-500 cursor-pointer shadow-md"
                      />
                    </div>
                  )}
                  {priority && (
                    <div className="absolute top-2 right-2 z-10">
                      <PriorityBadge priority={priority} size="sm" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 pb-0 flex items-center justify-between">
                  {onToggleSelect && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelect(item.id)}
                        className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                  )}
                  {priority && <PriorityBadge priority={priority} size="sm" />}
                </div>
              )}

              {/* Card Body */}
              <div className="p-3.5 space-y-2">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="font-mono text-[11px] font-semibold text-indigo-400 truncate">
                    {code}
                  </span>
                  {status && <StatusBadge status={status} size="sm" />}
                </div>

                <h4 className="font-medium text-xs text-slate-100 line-clamp-2 leading-snug">
                  {title}
                </h4>

                {item.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {/* Extra metadata chips */}
                {extraFields.length > 0 && (
                  <div className="pt-2 space-y-1 border-t border-slate-800/60">
                    {extraFields.map((f) => (
                      <div
                        key={f.key}
                        className="flex items-center justify-between text-[10px] text-slate-400"
                      >
                        <span className="text-slate-500">{f.label}:</span>
                        <span className="font-mono text-slate-300 truncate max-w-[120px]">
                          {String(item[f.key])}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Card Footer */}
            <div className="p-3 pt-2 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              {department ? (
                <span className="text-slate-400 truncate max-w-[110px]">{department}</span>
              ) : item.assignee_name ? (
                <span className="text-slate-300 truncate max-w-[110px]">
                  👤 {item.assignee_name}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-slate-600 truncate">{item.id}</span>
              )}

              {/* Actions */}
              {actions.length > 0 && (
                <div
                  className="flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  {actions.map((act) => {
                    const isVisible = act.isVisible ? act.isVisible(item) : true;
                    if (!isVisible) return null;
                    const isDisabled =
                      typeof act.disabled === 'function' ? act.disabled(item) : Boolean(act.disabled);

                    return (
                      <button
                        key={act.id || act.label}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => act.action && act.action(item)}
                        title={act.label}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-30"
                      >
                        {act.icon ? act.icon : act.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
        })}
      </div>
      {typeof totalCount === 'number' && totalCount > pageSize && onPageChange && (
        <Pagination
          currentPage={page}
          totalCount={totalCount}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </>
  );
}
