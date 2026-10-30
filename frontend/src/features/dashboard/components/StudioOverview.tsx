import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { analyticsApi } from '@/api/analytics/analytics';
import { QueryBoundary } from '@/components/system/QueryBoundary';

const Tile: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-left" title={hint}>
    <div className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">{label}</div>
    <div className="text-xl font-bold text-white font-mono mt-0.5">{value}</div>
  </div>
);

/**
 * The studio at a glance, across the projects the signed-in user belongs to (a platform administrator sees them all):
 * shots by state and the share of tasks approved per department. Both come straight from the analytics routes. Render
 * farm and storage figures are not shown: the server has no source for them and says so with nulls and zeros.
 */
export const StudioOverview: React.FC = () => {
  const kpis = useQuery({ queryKey: analyticsApi.keys.kpis, queryFn: ({ signal }) => analyticsApi.kpis(signal) });
  const departments = useQuery({ queryKey: analyticsApi.keys.departments, queryFn: ({ signal }) => analyticsApi.departments(signal) });
  const k = kpis.data;
  return (
    <section aria-label="Studio overview" className="w-full max-w-4xl mx-auto mt-10 space-y-4 text-left">
      <h2 className="text-sm font-bold text-white tracking-wide">Studio overview</h2>
      <QueryBoundary isLoading={kpis.isLoading} error={kpis.error} onRetry={() => void kpis.refetch()} entityName="studio figures">
        {k && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile label="Active projects" value={k.total_active_projects} />
            <Tile label="Shots" value={k.total_shots} />
            <Tile label="Approved" value={k.approved_shots} hint={`${k.approval_rate_percentage}% of all shots`} />
            <Tile label="Approval rate" value={`${k.approval_rate_percentage}%`} />
            <Tile label="In progress" value={k.in_progress_shots} />
            <Tile label="Pending review" value={k.pending_review_shots} />
            <Tile label="Artists with tasks" value={k.active_artists} hint="People with at least one assigned task" />
          </div>
        )}
      </QueryBoundary>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">Tasks approved by department</h3>
        <QueryBoundary isLoading={departments.isLoading} error={departments.error} onRetry={() => void departments.refetch()} entityName="department figures">
          {(departments.data ?? []).length === 0 ? (
            <p className="text-xs text-slate-400">No task has a department yet.</p>
          ) : (
            <ul className="space-y-2">
              {(departments.data ?? []).map((row) => (
                <li key={row.department} className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0 text-slate-200 truncate">{row.department}</span>
                  <span className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
                    <span className="block h-full bg-emerald-500" style={{ width: `${row.percentage}%` }} />
                  </span>
                  <span className="w-28 shrink-0 text-right font-mono text-slate-300">
                    {row.completed_tasks} of {row.total_tasks} · {row.percentage}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </div>
    </section>
  );
};
