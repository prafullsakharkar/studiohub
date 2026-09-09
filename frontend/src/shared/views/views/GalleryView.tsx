import React, { useState } from 'react';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Eye, ExternalLink, Maximize2, Check, Film, Layers } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';

interface GalleryViewProps<T = any> {
  data: T[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onItemClick?: (item: T) => void;
  emptyMessage?: string;
}

export function GalleryView<T extends { id: string }>({
  data,
  selectedIds,
  onToggleSelect,
  onItemClick,
  emptyMessage = 'No visual plates or assets to preview.',
}: GalleryViewProps<T>) {
  const [inspectItem, setInspectItem] = useState<any | null>(null);

  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-xs text-slate-500 bg-slate-900/40 rounded-xl border border-slate-800">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {data.map((item: any) => {
          const isSelected = selectedIds.includes(item.id);
          const title = item.name || item.title || item.code || `Item #${item.id}`;
          const code = item.code || item.slug || item.id;
          const thumbnail =
            item.thumbnail_url ||
            item.avatar_url ||
            item.banner_url ||
            'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80';
          const status = item.status;
          const frameCount = item.frame_count;

          return (
            <div
              key={item.id}
              onClick={() => onItemClick && onItemClick(item)}
              className={`rounded-xl overflow-hidden border transition-all flex flex-col justify-between group cursor-pointer ${
                isSelected
                  ? 'bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500 shadow-xl'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:shadow-lg'
              }`}
            >
              {/* Media Plate */}
              <div className="aspect-video bg-slate-950 relative overflow-hidden">
                <img
                  src={thumbnail}
                  alt={title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />

                {/* Gradient vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/40 opacity-80 group-hover:opacity-60 transition-opacity" />

                {/* Top badges */}
                <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                  <div
                    className="pointer-events-auto"
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

                  {status && (
                    <div className="pointer-events-auto">
                      <StatusBadge status={status} size="sm" />
                    </div>
                  )}
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between pointer-events-none">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-white bg-black/70 px-1.5 py-0.5 rounded backdrop-blur border border-white/10">
                      {code}
                    </span>
                    {frameCount && (
                      <span className="ml-1.5 font-mono text-[10px] text-slate-300 bg-black/60 px-1 py-0.5 rounded backdrop-blur">
                        {frameCount}f
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectItem(item);
                    }}
                    className="pointer-events-auto p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-slate-200 backdrop-blur border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Zoom Plate Inspection"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Footer Info */}
              <div className="p-3 bg-slate-900 space-y-1">
                <h5 className="text-xs font-semibold text-slate-200 truncate">
                  {title}
                </h5>
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>{item.project_code || item.department || 'VFX Plate'}</span>
                  {item.current_version && <span>{item.current_version}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Plate Zoom Modal */}
      {inspectItem && (
        <Modal
          isOpen={!!inspectItem}
          onClose={() => setInspectItem(null)}
          title={`Plate Inspection: ${inspectItem.code || inspectItem.id}`}
          size="2xl"
        >
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded-xl overflow-hidden border border-slate-800 relative">
              <img
                src={
                  inspectItem.thumbnail_url ||
                  inspectItem.avatar_url ||
                  inspectItem.banner_url ||
                  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&auto=format&fit=crop&q=80'
                }
                alt=""
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Code</span>
                <span className="text-indigo-400 font-bold">{inspectItem.code}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span className="text-slate-300">{inspectItem.status || 'Active'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Project</span>
                <span className="text-slate-300">{inspectItem.project_code || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Frame Count</span>
                <span className="text-slate-300">{inspectItem.frame_count || 148} frames</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
