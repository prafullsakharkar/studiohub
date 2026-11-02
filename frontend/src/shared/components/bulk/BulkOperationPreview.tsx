import type React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { EntityResolutionItem } from '@/shared/components/bulk/types';
import { Button } from '@/shared/components/Button';

interface BulkOperationPreviewProps<T = any> {
  entityType: 'Sequence' | 'Shot' | 'Asset' | 'Task' | string;
  items: EntityResolutionItem<T>[];
  onBack: () => void;
  onExecute: () => void;
  isExecuting: boolean;
  className?: string;
}

export const BulkOperationPreview: React.FC<BulkOperationPreviewProps> = ({
  entityType,
  items,
  onBack,
  onExecute,
  isExecuting,
  className = '',
}) => {
  const toCreate = items.filter((it) => it.userAction === 'create' || (!it.userAction && it.state === 'NEW'));
  const toRecover = items.filter((it) => it.userAction === 'recover');
  const toSkip = items.filter((it) => it.userAction === 'skip' || it.state === 'INVALID');

  const totalActionable = toCreate.length + toRecover.length;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Execution Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Create Card */}
        <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <PlusCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {toCreate.length}
            </div>
            <div className="text-xs font-mono text-slate-400">New {entityType}s to Create</div>
          </div>
        </div>

        {/* Recover Card */}
        <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-purple-300">
              {toRecover.length}
            </div>
            <div className="text-xs font-mono text-slate-400">Archived to Recover</div>
          </div>
        </div>

        {/* Skip Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-400">
              {toSkip.length}
            </div>
            <div className="text-xs font-mono text-slate-500">Skipped / Excluded</div>
          </div>
        </div>
      </div>

      {/* Item Action Matrix */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 font-semibold">
          <span>Planned Batch Execution Matrix</span>
          <span className="text-slate-500">{items.length} items evaluated</span>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-60 overflow-y-auto">
          {items.map((item, idx) => {
            const isCreate = item.userAction === 'create' || (!item.userAction && item.state === 'NEW');
            const isRecover = item.userAction === 'recover';
            const isSkip = !isCreate && !isRecover;

            return (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-2 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{item.code}</span>
                  {(item.proposedData as any)?.name && (
                    <span className="text-slate-400 text-[11px]">
                      - {(item.proposedData as any).name}
                    </span>
                  )}
                </div>

                <div>
                  {isCreate && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Create New
                    </span>
                  )}
                  {isRecover && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/30">
                      Recover Archived
                    </span>
                  )}
                  {isSkip && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      Skip
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Safety Notice */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/30 text-xs font-mono text-indigo-300">
        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
        <span>
          Audit logs will be generated for every entity created or recovered. Duplicate codes are safely guarded.
        </span>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onBack}
          disabled={isExecuting}
        >
          Back to Grid
        </Button>

        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={onExecute}
          disabled={isExecuting || totalActionable === 0}
          className="flex items-center gap-1.5"
        >
          {isExecuting ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Executing Pipeline...</span>
            </>
          ) : (
            <>
              <span>Execute Bulk Operation ({totalActionable})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
