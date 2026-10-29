import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import type React from 'react';
import type { StatusHistoryRow } from '@/api/production/work';
import { QueryBoundary } from '@/components/system/QueryBoundary';

export interface StatusHistoryProps {
  /** Distinct per record, e.g. `[...tasksApi.keys.detail(id), 'status-history']`. */
  queryKey: readonly unknown[];
  fetch: (signal?: AbortSignal) => Promise<StatusHistoryRow[]>;
}

/** Every status change of a shot, task or time log, newest first: who moved it, from where to where, and why. */
export const StatusHistory: React.FC<StatusHistoryProps> = ({ queryKey, fetch }) => {
  const rows = useQuery({ queryKey, queryFn: ({ signal }) => fetch(signal) });
  return (
    <QueryBoundary
      isLoading={rows.isLoading}
      error={rows.error}
      onRetry={() => void rows.refetch()}
      entityName="status history"
      isEmpty={(rows.data ?? []).length === 0}
      empty={{ title: 'No status changes yet', description: 'Moves between statuses are listed here as they happen.' }}
    >
      <ol aria-label="Status history" className="space-y-2">
        {(rows.data ?? []).map((row) => (
          <li key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-slate-200">
              <span>{row.from_status || '—'}</span>
              <ArrowRight className="h-3 w-3 text-slate-500" aria-label="to" />
              <span className="font-semibold">{row.to_status}</span>
              <span className="ml-auto text-[11px] text-slate-500">
                {row.actor_name || 'Someone'} · {new Date(row.changed_at).toLocaleString()}
              </span>
            </div>
            {row.reason && <p className="mt-1 text-[11px] text-slate-400">{row.reason}</p>}
          </li>
        ))}
      </ol>
    </QueryBoundary>
  );
};
