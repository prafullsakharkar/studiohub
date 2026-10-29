import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { auditApi, auditKeys, changeLogsFor } from '@/api/audit/audit';
import type { ChangeLog } from '@/api/audit/audit';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { cn } from '@/shared/utils/cn';

const PAGE_SIZE = 20;

const TYPE_VARIANT: Record<string, 'success' | 'info' | 'error' | 'neutral'> = { create: 'success', update: 'info', delete: 'error' };

const show = (value: string | undefined) => (value === undefined || value === '' ? '—' : value);

/** What changed in one entry: field, old value, new value. A create lists the values it started with. */
const ChangeDiff: React.FC<{ log: ChangeLog }> = ({ log }) => {
  const fields = log.changed_fields.length > 0 ? log.changed_fields : Object.keys(log.after_values);
  return (
    <table className="w-full text-[11px]" aria-label={`Changes in ${log.target_name}`}>
      <thead>
        <tr className="text-left text-slate-500">
          <th scope="col" className="py-1 pr-3 font-medium">
            Field
          </th>
          <th scope="col" className="py-1 pr-3 font-medium">
            {log.change_type === 'create' ? '' : 'Before'}
          </th>
          <th scope="col" className="py-1 font-medium">
            {log.change_type === 'create' ? 'Value' : 'After'}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/70">
        {fields.map((field) => (
          <tr key={field}>
            <td className="py-1 pr-3 font-mono text-slate-300">{field}</td>
            <td className="py-1 pr-3 font-mono text-rose-300 break-all">{log.change_type === 'create' ? '' : show(log.before_values[field])}</td>
            <td className="py-1 font-mono text-emerald-300 break-all">{show(log.after_values[field])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export interface EntityHistoryProps {
  /** The model class name the backend records, e.g. `Department`, `Team`, `Person`, `Client`. */
  targetType: string;
  targetId: string;
  title?: string;
  className?: string;
}

/**
 * Who changed this record, when, and what: its ChangeLog rows (newest first) with a before/after diff,
 * plus any AuditLog events about it. Reading history needs `audit.view`; without it nothing is requested.
 *
 * AuditLog has no `target_id` filter (CR-03), but the compat list searches `target_id`, so the events
 * are fetched with `search=<id>` and kept only when `entity_id` really is this record.
 */
export const EntityHistory: React.FC<EntityHistoryProps> = ({ targetType, targetId, title = 'History', className }) => {
  const canView = useCan('audit.view');
  const [open, setOpen] = useState<string | null>(null);

  const changes = useInfiniteQuery({
    queryKey: [...auditKeys.all, 'history', targetType, targetId],
    enabled: canView && Boolean(targetId),
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => changeLogsFor(targetType, targetId, { page: pageParam, page_size: PAGE_SIZE }).then((page) => page),
    getNextPageParam: (last, all) => (last.next ? all.length + 1 : undefined),
  });
  const events = useQuery({
    queryKey: [...auditKeys.all, 'history-events', targetId],
    enabled: canView && Boolean(targetId),
    queryFn: async () => (await auditApi.auditLogs.list({ search: targetId, page_size: 50 })).results.filter((e) => e.entity_id === targetId),
  });

  if (!canView) {
    return (
      <p role="note" className={cn('rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400', className)}>
        Reading a record&apos;s history needs the <span className="font-mono text-slate-300">audit.view</span> permission.
      </p>
    );
  }

  const logs = changes.data?.pages.flatMap((p) => p.results) ?? [];

  return (
    <section aria-label={title} className={cn('space-y-3', className)}>
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <QueryBoundary
        isLoading={changes.isLoading}
        error={changes.error}
        onRetry={() => void changes.refetch()}
        entityName="history"
        isEmpty={logs.length === 0}
        empty={{ title: 'No recorded changes', description: 'Edits to this record appear here with who made them.' }}
      >
        <ol className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
              <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={open === log.id} onClick={() => setOpen(open === log.id ? null : log.id)}>
                <span className="flex items-center gap-2">
                  <Badge variant={TYPE_VARIANT[log.change_type] ?? 'neutral'}>{log.change_type}</Badge>
                  <span className="text-xs text-slate-200">{log.user_name || log.user_email || 'Unknown user'}</span>
                  {log.change_type === 'update' && <span className="text-[11px] text-slate-500">changed {log.changed_fields.join(', ')}</span>}
                </span>
                <time dateTime={log.created_at} className="text-[10px] font-mono text-slate-500">
                  {new Date(log.created_at).toLocaleString()}
                </time>
              </button>
              {open === log.id && (
                <div className="mt-2 border-t border-slate-800 pt-2">
                  <ChangeDiff log={log} />
                </div>
              )}
            </li>
          ))}
        </ol>
        {changes.hasNextPage && (
          <button type="button" disabled={changes.isFetchingNextPage} onClick={() => void changes.fetchNextPage()} className="text-[11px] text-cyan-300 hover:underline">
            {changes.isFetchingNextPage ? 'Loading…' : 'Load older changes'}
          </button>
        )}
      </QueryBoundary>

      {(events.data ?? []).length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs font-semibold text-slate-300">Audit events</h4>
          <ul className="text-[11px] text-slate-400 space-y-1">
            {(events.data ?? []).map((e) => (
              <li key={e.id}>
                <span className="font-mono text-slate-300">{e.action}</span> by {e.user_name || e.user_email}: {e.description}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
