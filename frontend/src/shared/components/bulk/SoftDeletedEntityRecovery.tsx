import type React from 'react';
import { useState } from 'react';
import {
  Archive,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import type { EntityResolutionItem } from '@/types/production';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';

interface SoftDeletedEntityRecoveryProps<T = any> {
  entityType: 'Sequence' | 'Shot' | 'Asset' | 'Task' | string;
  items: EntityResolutionItem<T>[];
  onRecoverSelected: (codesToRecover: string[]) => void;
  onRecoverAll: () => void;
  onSkipAll: () => void;
  onCancel: () => void;
  className?: string;
}

export const SoftDeletedEntityRecovery: React.FC<SoftDeletedEntityRecoveryProps> = ({
  entityType,
  items,
  onRecoverSelected,
  onRecoverAll,
  onSkipAll,
  onCancel,
  className = '',
}) => {
  const softDeletedItems = items.filter((it) => it.state === 'SOFT_DELETED');
  const [selectedCodes, setSelectedCodes] = useState<string[]>(
    softDeletedItems.map((it) => it.code)
  );

  const toggleSelect = (code: string) => {
    if (selectedCodes.includes(code)) {
      setSelectedCodes(selectedCodes.filter((c) => c !== code));
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  const selectAll = () => setSelectedCodes(softDeletedItems.map((it) => it.code));
  const deselectAll = () => setSelectedCodes([]);

  if (softDeletedItems.length === 0) return null;

  return (
    <div
      className={`bg-slate-900 border border-purple-500/30 rounded-xl p-5 shadow-2xl space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
          <Archive className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">
              Archived {entityType}s Detected ({softDeletedItems.length})
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Recovery Decision Required
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            The following {entityType.toLowerCase()}s already exist in the studio database but are currently{' '}
            <strong className="text-purple-300 font-semibold">soft-deleted / archived</strong>. In accordance with studio VFX data integrity rules, you can restore them with their original IDs, relationships, and history, or skip them.
          </p>
        </div>
      </div>

      {/* Item List */}
      <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950/60">
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/80 border-b border-slate-800 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="select-all-archived"
              checked={selectedCodes.length === softDeletedItems.length && softDeletedItems.length > 0}
              onChange={(e) => (e.target.checked ? selectAll() : deselectAll())}
              className="rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500"
            />
            <label htmlFor="select-all-archived" className="cursor-pointer">
              Select All ({selectedCodes.length}/{softDeletedItems.length})
            </label>
          </div>
          <span className="text-[11px] text-slate-500">Archived Date & Context</span>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto">
          {softDeletedItems.map((item) => {
            const isChecked = selectedCodes.includes(item.code);
            const entity = item.existingEntity as any;
            const deletedDate = entity?.deleted_at
              ? new Date(entity.deleted_at).toLocaleDateString()
              : 'Previous Turnover';

            return (
              <div
                key={item.code}
                onClick={() => toggleSelect(item.code)}
                className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer transition-colors ${
                  isChecked ? 'bg-purple-950/20' : 'hover:bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelect(item.code)}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded bg-slate-900 border-slate-700 text-purple-500 focus:ring-purple-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-xs">
                        {item.code}
                      </span>
                      {entity?.name && (
                        <span className="text-xs text-slate-300">{entity.name}</span>
                      )}
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Archived
                      </span>
                    </div>
                    {item.message && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{item.message}</p>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] font-mono text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-600" />
                  <span>{deletedDate}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="text-slate-400 hover:text-white"
        >
          Cancel Operation
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onSkipAll}
            className="text-slate-300"
          >
            Skip All Archived
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={selectedCodes.length === 0}
            onClick={() => onRecoverSelected(selectedCodes)}
            className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white border-purple-500"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recover Selected ({selectedCodes.length})</span>
          </Button>

          {softDeletedItems.length > 1 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onRecoverAll}
              className="text-purple-300 border-purple-500/40 hover:bg-purple-500/10"
            >
              Recover All ({softDeletedItems.length})
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
