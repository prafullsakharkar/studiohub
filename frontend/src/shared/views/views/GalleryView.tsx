import React from 'react';
import { Image, Film, FileText, Check } from 'lucide-react';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';

export interface GalleryViewProps<T = any> {
  data: T[];
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onItemClick?: (item: T) => void;
  emptyMessage?: string;
}

export function GalleryView<T extends { id: string }>({
  data,
  selectedIds = [],
  onToggleSelect,
  onItemClick,
  emptyMessage = 'No visual assets to display in gallery.',
}: GalleryViewProps<T>) {
  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-slate-500 italic text-xs bg-slate-900/40 rounded-xl border border-slate-800">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
      {data.map((item: any) => {
        const isSelected = selectedIds.includes(item.id);
        const title = item.name || item.title || item.code || `Item #${item.id}`;
        const code = item.code || item.slug || item.id;
        const thumbnail = item.thumbnail_url || item.avatar_url || item.preview_url || item.image_url;
        const status = item.status;
        const priority = item.priority;

        return (
          <div
            key={item.id}
            onClick={() => onItemClick && onItemClick(item)}
            className={`group relative rounded-xl overflow-hidden border transition-all duration-200 flex flex-col justify-between ${
              isSelected
                ? 'bg-indigo-950/50 border-indigo-500 ring-2 ring-indigo-500/50 shadow-lg'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm hover:shadow-md'
            } ${onItemClick ? 'cursor-pointer' : ''}`}
          >
            {/* Visual Canvas Area */}
            <div className="relative aspect-square w-full bg-slate-950 overflow-hidden flex items-center justify-center">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950 text-slate-600 group-hover:text-slate-500 transition-colors">
                  <Image className="w-8 h-8 stroke-[1.5] mb-1" />
                  <span className="font-mono text-[10px] text-slate-500 uppercase">
                    {item.type || 'Asset'}
                  </span>
                </div>
              )}

              {/* Selection Checkbox */}
              {onToggleSelect && (
                <div
                  className={`absolute top-2 left-2 z-10 transition-opacity ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
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

              {/* Priority badge */}
              {priority && (
                <div className="absolute top-2 right-2 z-10">
                  <PriorityBadge priority={priority} size="sm" />
                </div>
              )}

              {/* Hover Dark Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
            </div>

            {/* Card Info Footer */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[11px] font-semibold text-indigo-400 truncate">
                  {code}
                </span>
                {status && <StatusBadge status={status} size="sm" />}
              </div>

              <h5 className="font-medium text-xs text-slate-200 truncate" title={title}>
                {title}
              </h5>
            </div>
          </div>
        );
      })}
    </div>
  );
}
