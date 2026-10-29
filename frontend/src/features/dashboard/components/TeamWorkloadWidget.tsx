import React from 'react';
import { Users, AlertTriangle, CheckCircle } from 'lucide-react';
import { DashboardWorkloadData } from '../types';

export interface TeamWorkloadWidgetProps {
  workload: DashboardWorkloadData;
}

export const TeamWorkloadWidget: React.FC<TeamWorkloadWidgetProps> = ({ workload }) => {
  return (
    <div id="dashboard-workload-widget" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Key Artist Roster &amp; Workload</h2>
            <p className="text-[11px] text-slate-400">Capacity &amp; task volume across craft departments</p>
          </div>
        </div>

        <span className="text-xs font-mono text-slate-400">
          {workload.team_members.length} Artists Active
        </span>
      </div>

      {/* Artists Roster Table */}
      {workload.team_members.length === 0 ? (
        <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
          No artists currently assigned to this project.
        </div>
      ) : (
        <div className="space-y-2">
          {workload.team_members.slice(0, 5).map((artist) => (
            <div
              key={artist.id}
              className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors text-xs font-mono"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {artist.avatar_url ? (
                  <img
                    src={artist.avatar_url}
                    alt={artist.name}
                    className="w-7 h-7 rounded-full object-cover border border-slate-700 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                    {artist.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-slate-200 font-medium truncate font-sans text-xs">{artist.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <span className="text-purple-400">{artist.department}</span>
                    <span>•</span>
                    <span>{artist.role}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-slate-300 font-bold">{artist.assigned_count} Tasks</div>
                  <div className="text-[10px] text-slate-500">
                    {artist.in_progress_count} WIP •{' '}
                    <span className={artist.overdue_count > 0 ? 'text-amber-400 font-bold' : ''}>
                      {artist.overdue_count} Overdue
                    </span>
                  </div>
                </div>

                {/* Workload Indicator Badge */}
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    artist.workload_level === 'overloaded'
                      ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                      : artist.workload_level === 'high'
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {artist.workload_level}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
