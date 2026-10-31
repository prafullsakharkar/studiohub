import type React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Archive,
  Copy,
  XCircle,
  PlusCircle,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import type { EntityResolutionItem, EntityResolutionState, ResolutionUserAction } from '@/shared/components/bulk/types';
import { Badge } from '@/shared/components/Badge';

interface ExistingEntityResolverProps<T = any> {
  items: EntityResolutionItem<T>[];
  activeFilter?: EntityResolutionState | 'ALL';
  onActionChange: (code: string, action: ResolutionUserAction) => void;
  onRemoveItem: (code: string) => void;
  className?: string;
}

export const ExistingEntityResolver: React.FC<ExistingEntityResolverProps> = ({
  items,
  activeFilter = 'ALL',
  onActionChange,
  onRemoveItem,
  className = '',
}) => {
  const filteredItems = items.filter((it) => {
    if (activeFilter === 'ALL') return true;
    return it.state === activeFilter;
  });

  const getStateBadge = (state: EntityResolutionState) => {
    switch (state) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <PlusCircle className="w-3 h-3" /> New
          </span>
        );
      case 'SOFT_DELETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30">
            <Archive className="w-3 h-3" /> Soft-Deleted
          </span>
        );
      case 'EXISTS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Active Exists
          </span>
        );
      case 'DUPLICATE_IN_REQUEST':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/10 text-rose-300 border border-rose-500/30">
            <Copy className="w-3 h-3" /> Batch Dup
          </span>
        );
      case 'INVALID':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <XCircle className="w-3 h-3" /> Invalid
          </span>
        );
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
        <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs font-mono text-slate-400 font-semibold">
          <div className="col-span-3">Code / Identifier</div>
          <div className="col-span-3">Detected Status</div>
          <div className="col-span-4">Proposed Action</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 font-mono">
              No items match the selected filter.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const errors = item.errors || [];
              const warnings = item.warnings || [];

              return (
                <div
                  key={`${item.code}-${idx}`}
                  className={`grid grid-cols-12 gap-2 items-center px-4 py-2.5 text-xs font-mono transition-colors ${
                    item.state === 'INVALID' || item.state === 'DUPLICATE_IN_REQUEST'
                      ? 'bg-rose-950/10'
                      : item.state === 'SOFT_DELETED'
                      ? 'bg-purple-950/10'
                      : 'hover:bg-slate-900/40'
                  }`}
                >
                  {/* Code */}
                  <div className="col-span-3 flex items-center gap-2">
                    <span className="font-bold text-white text-xs">{item.code}</span>
                    {(item.proposedData as any)?.name && (
                      <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
                        ({(item.proposedData as any).name})
                      </span>
                    )}
                  </div>

                  {/* Detected State */}
                  <div className="col-span-3">
                    {getStateBadge(item.state)}
                  </div>

                  {/* Proposed Action Selector */}
                  <div className="col-span-4 flex items-center gap-1.5">
                    {item.state === 'SOFT_DELETED' ? (
                      <select
                        value={item.userAction}
                        onChange={(e) =>
                          onActionChange(item.code, e.target.value as ResolutionUserAction)
                        }
                        className="bg-slate-900 border border-purple-500/40 rounded px-2 py-1 text-xs text-purple-300 focus:ring-1 focus:ring-purple-500"
                      >
                        <option value="recover">Recover Existing Entity</option>
                        <option value="skip">Skip This Item</option>
                      </select>
                    ) : item.state === 'EXISTS' ? (
                      <select
                        value={item.userAction}
                        onChange={(e) =>
                          onActionChange(item.code, e.target.value as ResolutionUserAction)
                        }
                        className="bg-slate-900 border border-amber-500/40 rounded px-2 py-1 text-xs text-amber-300 focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="skip">Skip (Already Active)</option>
                        <option value="update_existing">Update Existing Entity</option>
                      </select>
                    ) : item.state === 'NEW' ? (
                      <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Will Create New
                      </span>
                    ) : (
                      <span className="text-rose-400 text-[11px]">
                        {errors[0] || warnings[0] || 'Requires manual correction'}
                      </span>
                    )}
                  </div>

                  {/* Remove Button */}
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.code)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                      title="Remove from batch"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
