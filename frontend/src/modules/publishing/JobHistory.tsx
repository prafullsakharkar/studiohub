import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link } from 'react-router-dom';
import { publishApi } from '@/api/publishing/publishing';
import type { Publish } from '@/api/publishing/publishing';
import { formatDateTime } from '@/core/locale/studioLocale';
import { fetchAllRows } from '@/shared/data/listing';
import { cn } from '@/shared/utils/cn';
import { JobStatusBadge } from './jobs';

/**
 * Every export job for the same shot or asset, newest first: what was exported, when, with which tool and how it ended.
 * The server does not say which job a republish was made from, so this is the history of the shot or asset, not a chain.
 */
export const JobHistory: React.FC<{ job: Publish }> = ({ job }) => {
  const named = Boolean(job.entity_code);
  const jobs = useQuery({
    queryKey: [...publishApi.keys.lists(), 'history', job.project ?? 'none', job.entity_type, job.entity_code],
    queryFn: ({ signal }) => fetchAllRows(publishApi.list, { ...(job.project ? { project_id: job.project } : {}), search: job.entity_code }, { signal }),
    enabled: named,
    select: (rows) => rows.filter((r) => r.entity_code === job.entity_code && r.entity_type === job.entity_type).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  });
  if (!named) return <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">This job names no shot or asset, so there is no history to show.</p>;
  const rows = jobs.data ?? [];
  return (
    <section aria-label="Job history" className="space-y-3">
      <p className="text-xs text-slate-400">{`Export jobs for ${job.entity_type.toLowerCase()} ${job.entity_code}, newest first. A republish is a new job; the server does not record which job it came from.`}</p>
      {jobs.isLoading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-800 p-4 text-xs text-slate-500">No other export jobs.</p>
      ) : (
        <ol aria-label={`Jobs for ${job.entity_code}`} className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} aria-current={row.id === job.id ? 'true' : undefined} className={cn('grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 rounded-lg border bg-slate-900/50 px-3 py-2 text-xs', row.id === job.id ? 'border-cyan-500/50' : 'border-slate-800')}>
              <span className="min-w-0">
                {row.id === job.id ? (
                  <span className="font-semibold text-slate-100">{row.code} · {row.name}</span>
                ) : (
                  <Link to={`/publishing/${row.id}`} className="font-semibold text-cyan-300 hover:underline">
                    {row.code} · {row.name}
                  </Link>
                )}
                {row.id === job.id && <span className="ml-2 text-[11px] text-cyan-300">This job</span>}
              </span>
              <span className="font-mono text-[11px] text-slate-400">{`${row.dcc_tool_display}${row.dcc_version ? ` ${row.dcc_version}` : ''}`}</span>
              <span className="font-mono text-[11px] text-slate-500">{formatDateTime(row.created_at)}</span>
              <JobStatusBadge status={row.job_status} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
