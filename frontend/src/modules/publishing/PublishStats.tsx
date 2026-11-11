import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { JOB_STATUSES, publishApi } from '@/api/publishing/publishing';
import { formatNumber } from '@/core/locale/studioLocale';
import { cn } from '@/shared/utils/cn';

const RUNNING = new Set(['Pending', 'Validating', 'Validated', 'Exporting']);

/**
 * How the export jobs stand, for the project the list is narrowed to (or all of them): the total, the ones still running,
 * the exported ones, the failed ones and the cancelled ones, and the share of finished jobs that succeeded. One small
 * request per status: the server counts, the page does not download the jobs.
 */
export const PublishStats: React.FC<{ filters: Record<string, unknown> }> = ({ filters }) => {
  const project = filters.project_id ? String(filters.project_id) : undefined;
  const counts = useQuery({
    queryKey: [...publishApi.keys.lists(), 'stats', project ?? 'all'],
    queryFn: async ({ signal }) => {
      const base = project ? { project_id: project } : {};
      const entries = await Promise.all(JOB_STATUSES.map(async (status) => [status, (await publishApi.list({ ...base, job_status: status, page_size: 1 }, signal)).count] as const));
      return Object.fromEntries(entries) as Record<(typeof JOB_STATUSES)[number], number>;
    },
  });
  if (counts.isLoading || !counts.data) return null;
  const c = counts.data;
  const total = JOB_STATUSES.reduce((sum, status) => sum + c[status], 0);
  const running = JOB_STATUSES.filter((s) => RUNNING.has(s)).reduce((sum, status) => sum + c[status], 0);
  const finished = c.Exported + c.Failed;
  const tiles: ReadonlyArray<{ label: string; value: string; tone?: string }> = [
    { label: 'Jobs', value: formatNumber(total) },
    { label: 'Running', value: formatNumber(running), tone: running > 0 ? 'text-sky-300' : undefined },
    { label: 'Exported', value: formatNumber(c.Exported), tone: 'text-emerald-300' },
    { label: 'Failed', value: formatNumber(c.Failed), tone: c.Failed > 0 ? 'text-rose-300' : undefined },
    { label: 'Cancelled', value: formatNumber(c.Cancelled) },
    { label: 'Success rate', value: finished > 0 ? `${Math.round((c.Exported / finished) * 100)}%` : '—' },
  ];
  return (
    <dl aria-label="Job summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">{t.label}</dt>
          <dd className={cn('mt-1 font-mono text-xl text-slate-100', t.tone)}>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
};
