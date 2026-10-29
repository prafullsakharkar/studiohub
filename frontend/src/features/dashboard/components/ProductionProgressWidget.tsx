import React from 'react';
import { Layers, CheckCircle2, Clock, CircleDot, Info } from 'lucide-react';
import { DashboardProductionProgress } from '../types';

export interface ProductionProgressWidgetProps {
  production: DashboardProductionProgress;
  totalShots: number;
}

export const ProductionProgressWidget: React.FC<ProductionProgressWidgetProps> = ({
  production,
  totalShots,
}) => {
  const completedPct = totalShots > 0 ? Math.round((production.completed_shots / totalShots) * 100) : 0;
  const inProgressPct = totalShots > 0 ? Math.round((production.in_progress_shots / totalShots) * 100) : 0;
  const notStartedPct = Math.max(0, 100 - completedPct - inProgressPct);

  return (
    <div
      id="dashboard-production-progress"
      className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Overall Production Velocity &amp; Completion
            </h2>
            <p className="text-[11px] text-slate-400">
              Aggregated project milestone completion across all active sequences
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-1.5 self-start sm:self-auto font-mono">
          <span className="text-2xl font-black text-emerald-400 tracking-tight">
            {production.overall_progress_pct}%
          </span>
          <span className="text-xs text-slate-400 font-normal">Final Delivery Readiness</span>
        </div>
      </div>

      {/* Multi-Segment VFX Progress Bar */}
      <div className="space-y-2">
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden flex p-0.5 border border-slate-800">
          {/* Completed (Approved) */}
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-l-full transition-all duration-500"
            style={{ width: `${completedPct}%` }}
            title={`Completed / Final Approved: ${production.completed_shots} shots (${completedPct}%)`}
          />
          {/* In Progress */}
          <div
            className="bg-gradient-to-r from-sky-500 to-indigo-500 h-full transition-all duration-500"
            style={{ width: `${inProgressPct}%` }}
            title={`In Pipeline WIP: ${production.in_progress_shots} shots (${inProgressPct}%)`}
          />
          {/* Not Started / Queued */}
          <div
            className="bg-slate-800 h-full rounded-r-full transition-all duration-500"
            style={{ width: `${notStartedPct}%` }}
            title={`Queued / Not Started: ${production.not_started_shots} shots (${notStartedPct}%)`}
          />
        </div>

        {/* Legend Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shrink-0" />
            <span className="text-slate-300 font-semibold">Completed:</span>
            <span className="text-emerald-400">
              {production.completed_shots} ({completedPct}%)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400 shrink-0" />
            <span className="text-slate-300 font-semibold">In Progress:</span>
            <span className="text-sky-300">
              {production.in_progress_shots} ({inProgressPct}%)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-700 shrink-0" />
            <span className="text-slate-400">Queued:</span>
            <span className="text-slate-400">
              {production.not_started_shots} ({notStartedPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Methodology Footnote */}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Calculation: {production.methodology_note}</span>
      </div>
    </div>
  );
};
