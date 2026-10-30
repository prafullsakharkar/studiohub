import React from 'react';
import { Calendar, Clock, AlertCircle, CheckCircle2, ArrowRight, Flag } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { milestonesApi } from '@/api/scheduling/scheduling';
import { useCan } from '@/core/permissions/useCan';
import { DashboardScheduleData } from '../types';
import { milestoneState } from '../utils/dashboardMetrics';

export interface ScheduleMilestonesWidgetProps {
  schedule: DashboardScheduleData;
  /** The project whose own milestones are listed (the schedule's built-in phases are not real, CR-30). */
  projectId: string;
}

export const ScheduleMilestonesWidget: React.FC<ScheduleMilestonesWidgetProps> = ({ schedule, projectId }) => {
  // The dashboard payload's `schedule.milestones` are five fixed phase names at fractions of the span; the project's
  // real milestones come from Scheduling. Reading them needs schedule.view.
  const canView = useCan('schedule.view');
  const milestones = useQuery({ queryKey: ['dashboard', 'milestones', projectId], queryFn: ({ signal }) => milestonesApi.list({ project_id: projectId, ordering: 'due_date' }, signal).then((p) => p.results), enabled: canView && Boolean(projectId) });
  const percentElapsed = schedule.days_total > 0
    ? Math.min(100, Math.round((schedule.days_elapsed / schedule.days_total) * 100))
    : 0;

  return (
    <div id="dashboard-schedule-widget" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Schedule &amp; Production Milestones</h2>
            <p className="text-[11px] text-slate-400">Calendar timeline &amp; delivery target tracking</p>
          </div>
        </div>

        {/* Days Remaining Counter */}
        <div className="flex items-baseline gap-1 font-mono">
          <span
            className={`text-xl font-black ${
              schedule.days_remaining < 30 ? 'text-amber-400' : 'text-slate-200'
            }`}
          >
            {schedule.days_remaining > 0 ? schedule.days_remaining : 0}
          </span>
          <span className="text-[11px] text-slate-400">Days to Delivery</span>
        </div>
      </div>

      {/* Timeline Meter */}
      <div className="space-y-1.5 font-mono text-xs">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Start: {schedule.start_date || 'TBD'}</span>
          <span className="text-amber-400 font-semibold">{percentElapsed}% timeline elapsed</span>
          <span>Target: {schedule.delivery_date || 'TBD'}</span>
        </div>

        <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              schedule.is_delayed
                ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400'
            }`}
            style={{ width: `${percentElapsed}%` }}
          />
        </div>
      </div>

      {/* Next Upcoming Deadline Highlight */}
      {schedule.next_deadline && (
        <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-indigo-300">
            <Flag className="w-4 h-4 text-indigo-400 shrink-0" />
            <div>
              <span className="font-semibold text-white">{schedule.next_deadline.title}</span>
              <span className="text-indigo-400 text-[11px] ml-2">({schedule.next_deadline.type})</span>
            </div>
          </div>
          <span className="font-mono text-indigo-300 text-[11px] bg-indigo-500/20 px-2 py-0.5 rounded-full">
            {schedule.next_deadline.days_away} days away
          </span>
        </div>
      )}

      {/* Milestones List */}
      <div className="space-y-2 pt-1">
        <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
          Project Milestones
        </h3>

        {!canView ? (
          <p className="text-xs text-slate-400">Milestones are visible to people who can view the schedule.</p>
        ) : milestones.isLoading ? (
          <p className="text-xs text-slate-400">Loading milestones…</p>
        ) : milestones.error ? (
          <p role="alert" className="text-xs text-rose-300">The milestones could not be loaded.</p>
        ) : (milestones.data ?? []).length === 0 ? (
          <p className="text-xs text-slate-400">
            This project has no milestones yet.{' '}
            <Link to={`/scheduling/milestones/new?project_id=${projectId}`} className="text-indigo-400 hover:underline">
              Add one
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            {(milestones.data ?? []).map((milestone) => {
              const state = milestoneState(milestone);
              return (
                <div key={milestone.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {state === 'completed' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : state === 'in_progress' ? (
                      <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : state === 'overdue' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />
                    )}
                    <span className="text-slate-200 truncate font-sans text-xs">{milestone.name}</span>
                  </div>
                  <span className={`text-[10px] shrink-0 ${state === 'overdue' ? 'text-rose-300' : 'text-slate-400'}`}>{milestone.due_date}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
