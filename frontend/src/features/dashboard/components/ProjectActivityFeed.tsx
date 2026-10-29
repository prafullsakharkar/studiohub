import React from 'react';
import { Activity, Clock, CheckCircle2, Upload, AlertTriangle, MessageSquare } from 'lucide-react';
import { DashboardActivityItem } from '../types';
import { formatActivityTimestamp } from '../utils/dashboardMetrics';

export interface ProjectActivityFeedProps {
  activities: DashboardActivityItem[];
}

export const ProjectActivityFeed: React.FC<ProjectActivityFeedProps> = ({ activities }) => {
  return (
    <div id="dashboard-activity-feed" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Project Telemetry Stream</h2>
            <p className="text-[11px] text-slate-400">Audit timeline scoped strictly to current project</p>
          </div>
        </div>

        <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* Activity Timeline Items */}
      {activities.length === 0 ? (
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
          No recent activity logs recorded for this project context.
        </div>
      ) : (
        <div className="space-y-3 font-mono text-xs relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {activities.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-start gap-3 relative pl-1 group">
              <div className="w-5 h-5 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5 z-10 group-hover:border-indigo-400 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              </div>

              <div className="flex-1 min-w-0 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 group-hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-200 font-bold font-sans">{item.user_name}</span>
                    <span className="text-indigo-400 text-[11px]">{item.action}</span>
                    {item.entity_code && (
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px]">
                        {item.entity_code}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0">
                    {formatActivityTimestamp(item.timestamp)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 font-sans mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
