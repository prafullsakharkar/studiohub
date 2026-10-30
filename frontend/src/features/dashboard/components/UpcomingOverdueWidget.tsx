import React from 'react';
import { Clock, AlertTriangle, CheckCircle2, Calendar } from 'lucide-react';
import { DashboardTasksData, DashboardDeliveriesData } from '../types';
import { upcomingDeliveryItems } from '../utils/dashboardMetrics';

export interface UpcomingOverdueWidgetProps {
  tasks: DashboardTasksData;
  deliveries: DashboardDeliveriesData;
}

export const UpcomingOverdueWidget: React.FC<UpcomingOverdueWidgetProps> = ({ tasks, deliveries }) => {
  // Listed rows are the most recent critical examples; the header count is
  // the exact backend-computed overdue-or-blocked union for the project.
  const overdueTasks = tasks.recent_tasks.filter((t) => t.is_overdue || t.status === 'Blocked');
  const criticalTotal = tasks.critical ?? overdueTasks.length;
  const upcomingDeliveries = upcomingDeliveryItems(deliveries);

  return (
    <div id="dashboard-upcoming-overdue" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Action Items &amp; Critical Watchlist</h2>
            <p className="text-[11px] text-slate-400">Time-sensitive deliverables and overdue items</p>
          </div>
        </div>
      </div>

      {/* Critical Overdue Section */}
      {criticalTotal > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-rose-400 uppercase font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Attention Needed ({criticalTotal})</span>
          </div>

          {overdueTasks.length === 0 ? (
            <div className="text-[11px] text-slate-400 font-mono">
              Critical items exist outside the recent task window — open All Tasks to triage.
            </div>
          ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {overdueTasks.slice(0, 3).map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-slate-200 font-medium font-sans truncate block">{task.title}</span>
                  <span className="text-[10px] text-rose-300">
                    {task.department} • {task.assignee_name || 'Unassigned'}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                  {task.status}
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>No overdue tasks or critical roadblocks for this project.</span>
        </div>
      )}

      {/* Upcoming Turnover Deliveries Section */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-mono text-indigo-400 uppercase font-semibold">
          <Calendar className="w-3.5 h-3.5" />
          <span>Upcoming Client Turnovers</span>
        </div>

        {upcomingDeliveries.length === 0 ? (
          <div className="text-xs text-slate-400 font-mono">No imminent package deliveries.</div>
        ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {upcomingDeliveries.slice(0, 3).map((delivery) => (
              <div
                key={delivery.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <span className="text-slate-200 font-medium font-sans truncate block">{delivery.package_name}</span>
                  <span className="text-[10px] text-slate-400">To: {delivery.recipient}</span>
                </div>
                <span className="text-[10px] text-indigo-400 shrink-0">{delivery.due_date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
