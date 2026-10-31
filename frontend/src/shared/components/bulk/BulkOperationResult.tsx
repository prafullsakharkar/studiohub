import type React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Download,
  Check,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { BulkOperationResponse } from '@/shared/components/bulk/types';
import { Button } from '@/shared/components/Button';

interface BulkOperationResultProps<T = any> {
  entityType: 'Sequence' | 'Shot' | 'Asset' | 'Task' | string;
  response: BulkOperationResponse<T>;
  onRetryFailed?: (failedCodes: string[]) => void;
  onDone: () => void;
  className?: string;
}

export const BulkOperationResult: React.FC<BulkOperationResultProps> = ({
  entityType,
  response,
  onRetryFailed,
  onDone,
  className = '',
}) => {
  const { summary, results, partial_success } = response;
  const failedItems = results.filter((r) => !r.success);
  const isCompleteSuccess = summary.failedCount === 0;

  const exportAuditLog = (format: 'json' | 'csv') => {
    let content = '';
    let filename = `bulk_${entityType.toLowerCase()}_result_${Date.now()}`;
    let mimeType = 'text/plain';

    if (format === 'json') {
      content = JSON.stringify(response, null, 2);
      filename += '.json';
      mimeType = 'application/json';
    } else {
      const headers = ['Index', 'Code', 'Success', 'ActionTaken', 'Error', 'SuggestedAction'];
      const rows = results.map((r) =>
        [
          r.index,
          `"${r.code}"`,
          r.success,
          `"${r.actionTaken}"`,
          `"${r.error || ''}"`,
          `"${r.suggestedAction || ''}"`,
        ].join(',')
      );
      content = [headers.join(','), ...rows].join('\n');
      filename += '.csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Result Status Banner */}
      <div
        className={`p-4 rounded-xl border flex items-center gap-3.5 ${
          isCompleteSuccess
            ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
            : partial_success
            ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
            : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isCompleteSuccess
              ? 'bg-emerald-500/20 text-emerald-400'
              : partial_success
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-rose-500/20 text-rose-400'
          }`}
        >
          {isCompleteSuccess ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : partial_success ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
        </div>

        <div>
          <h3 className="font-bold text-base text-white">
            {isCompleteSuccess
              ? `Bulk ${entityType} Operation Successful!`
              : partial_success
              ? `Operation Completed with ${summary.failedCount} Errors`
              : `Bulk Operation Encountered Errors`}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            {summary.createdCount} created · {summary.recoveredCount} recovered · {summary.skippedCount} skipped · {summary.failedCount} failed
          </p>
        </div>
      </div>

      {/* Results Audit Table */}
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/80">
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 font-semibold">
          <span>Execution Log Details</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportAuditLog('csv')}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> CSV
            </button>
            <button
              onClick={() => exportAuditLog('json')}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
            >
              <Download className="w-3 h-3" /> JSON
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-64 overflow-y-auto">
          {results.map((r, idx) => (
            <div
              key={idx}
              className={`p-3 text-xs font-mono flex items-start justify-between gap-4 ${
                !r.success ? 'bg-rose-950/20' : 'hover:bg-slate-900/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{r.code}</span>
                  <span
                    className={`px-2 py-0.2 rounded text-[10px] uppercase font-bold ${
                      r.actionTaken === 'created'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : r.actionTaken === 'recovered'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : r.actionTaken === 'updated'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : r.actionTaken === 'skipped'
                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    }`}
                  >
                    {r.actionTaken}
                  </span>
                </div>

                {r.error && (
                  <p className="text-rose-400 text-[11px] flex items-center gap-1">
                    <XCircle className="w-3 h-3 shrink-0" />
                    <span>{r.error}</span>
                  </p>
                )}

                {r.suggestedAction && (
                  <p className="text-slate-400 text-[11px]">
                    <strong className="text-amber-400 font-normal">Suggestion:</strong> {r.suggestedAction}
                  </p>
                )}
              </div>

              <div>
                {r.success ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        {failedItems.length > 0 && onRetryFailed ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onRetryFailed(failedItems.map((f) => f.code))}
            className="flex items-center gap-1.5 text-amber-300 border-amber-500/40 hover:bg-amber-500/10"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry Failed Rows ({failedItems.length})</span>
          </Button>
        ) : (
          <div />
        )}

        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={onDone}
          className="flex items-center gap-1.5"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Done & Refresh Workspace</span>
        </Button>
      </div>
    </div>
  );
};
