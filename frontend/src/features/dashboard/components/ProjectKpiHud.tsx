import React from 'react';
import {
  Film,
  CheckSquare,
  Box,
  PlaySquare,
  Truck,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { DashboardSummaryKpis } from '../types';
import { Link } from 'react-router-dom';

export interface ProjectKpiHudProps {
  summary: DashboardSummaryKpis;
  projectId: string;
}

export const ProjectKpiHud: React.FC<ProjectKpiHudProps> = ({ summary, projectId }) => {
  return (
    <div id="project-kpi-hud" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. Sequence Shots Card */}
      <Link
        to={`/shots?project=${projectId}`}
        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-2 group block"
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase">Sequence Shots</span>
          <Film className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-white font-mono">{summary.total_shots}</span>
          <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {summary.shots_completion_pct}% cut
          </span>
        </div>
        <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1.5 border-t border-slate-800/80">
          <span className="text-emerald-300">Approved: {summary.approved_shots}</span>
          <span className="text-sky-300">WIP: {summary.in_progress_shots}</span>
        </div>
      </Link>

      {/* 2. Pipeline Tasks Card */}
      <Link
        to={`/tasks?project=${projectId}`}
        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/40 transition-all space-y-2 group block"
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase">Pipeline Tasks</span>
          <CheckSquare className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-white font-mono">{summary.total_tasks}</span>
          <span
            className={`text-[11px] font-mono flex items-center gap-1 ${
              summary.overdue_tasks > 0 ? 'text-amber-400 font-semibold' : 'text-slate-400'
            }`}
          >
            {summary.overdue_tasks > 0 ? (
              <>
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                {summary.overdue_tasks} Overdue
              </>
            ) : (
              'On Schedule'
            )}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1.5 border-t border-slate-800/80">
          <span className="text-emerald-300">Done: {summary.completed_tasks}</span>
          <span className="text-sky-300">Active: {summary.in_progress_tasks}</span>
        </div>
      </Link>

      {/* 3. Asset Matrix Card */}
      <Link
        to={`/assets?project=${projectId}`}
        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/40 transition-all space-y-2 group block"
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase">Production Assets</span>
          <Box className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-white font-mono">{summary.total_assets}</span>
          <span className="text-[11px] text-purple-300 font-mono">
            {summary.approved_assets} Released
          </span>
        </div>
        <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1.5 border-t border-slate-800/80">
          <span className="text-amber-300">WIP: {summary.in_progress_assets}</span>
          <span className={summary.needs_revision_assets > 0 ? 'text-rose-400' : 'text-slate-400'}>
            Rev: {summary.needs_revision_assets}
          </span>
        </div>
      </Link>

      {/* 4. Screening & Reviews Card */}
      <Link
        to={`/reviews?project=${projectId}`}
        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2 group block"
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase">Screening Room</span>
          <PlaySquare className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-white font-mono">
            {summary.total_reviews ?? (summary.pending_reviews + summary.approved_reviews + summary.changes_requested_reviews)}
          </span>
          <span className="text-[11px] text-cyan-300 font-mono">
            {summary.pending_reviews} In Queue
          </span>
        </div>
        <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1.5 border-t border-slate-800/80">
          <span className="text-emerald-300">Approved: {summary.approved_reviews}</span>
          <span className={summary.changes_requested_reviews > 0 ? 'text-amber-400' : 'text-slate-400'}>
            Changes: {summary.changes_requested_reviews}
          </span>
        </div>
      </Link>

      {/* 5. Client Deliveries Card */}
      <Link
        to={`/deliveries?project=${projectId}`}
        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-2 group block col-span-2 md:col-span-1"
      >
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-[10px] tracking-wider uppercase">Client Deliveries</span>
          <Truck className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold text-white font-mono">
            {summary.total_deliveries ?? (summary.delivered_deliveries + summary.upcoming_deliveries + summary.late_deliveries)}
          </span>
          <span
            className={`text-[11px] font-mono ${
              summary.late_deliveries > 0 ? 'text-rose-400 font-semibold' : 'text-emerald-400'
            }`}
          >
            {summary.late_deliveries > 0 ? `${summary.late_deliveries} Late` : `${summary.upcoming_deliveries} Upcoming`}
          </span>
        </div>
        <div className="text-[10px] text-slate-400 flex justify-between font-mono pt-1.5 border-t border-slate-800/80">
          <span className="text-slate-300">Pushed: {summary.delivered_deliveries}</span>
          <span className="text-indigo-300">Queued: {summary.upcoming_deliveries}</span>
        </div>
      </Link>
    </div>
  );
};
