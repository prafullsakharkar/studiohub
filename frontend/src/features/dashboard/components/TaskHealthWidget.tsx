import React from 'react';
import { CheckSquare, AlertTriangle, ArrowUpRight, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardTasksData } from '../types';

export interface TaskHealthWidgetProps {
  tasksData: DashboardTasksData;
  projectId: string;
}

export const TaskHealthWidget: React.FC<TaskHealthWidgetProps> = ({ tasksData, projectId }) => {
  const navigate = useNavigate();
  const total = tasksData.total || 1;
  const completionRate = Math.round(((tasksData.completed) / total) * 100);

  return (
    <div id="dashboard-task-health-widget" className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">Task Health &amp; Work Velocity</h2>
            <p className="text-[11px] text-slate-400">Departmental workflow execution status</p>
          </div>
        </div>

        <Link
          to={`/tasks?project=${projectId}`}
          className="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-mono transition-colors"
        >
          All Tasks ({tasksData.total})
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Blocked Tasks Callout Alert */}
      {tasksData.blocked > 0 && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-rose-300 font-medium">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              <strong>{tasksData.blocked} Blocked Task{tasksData.blocked > 1 ? 's' : ''}</strong> require supervisor or dependency resolution
            </span>
          </div>
          <Link
            to={`/tasks?project=${projectId}&status=Blocked`}
            className="text-[11px] text-rose-400 hover:text-rose-200 font-mono underline ml-2 shrink-0"
          >
            Review Blockers
          </Link>
        </div>
      )}

      {/* Status Counters Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-slate-400 uppercase font-mono">Open</div>
          <div className="text-base font-bold text-slate-200 font-mono mt-0.5">{tasksData.open}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-sky-400 uppercase font-mono">In Progress</div>
          <div className="text-base font-bold text-sky-300 font-mono mt-0.5">{tasksData.in_progress}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-indigo-400 uppercase font-mono">Review</div>
          <div className="text-base font-bold text-indigo-300 font-mono mt-0.5">{tasksData.review}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-emerald-400 uppercase font-mono">Done</div>
          <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">{tasksData.completed}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-rose-400 uppercase font-mono">Blocked</div>
          <div className="text-base font-bold text-rose-400 font-mono mt-0.5">{tasksData.blocked}</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center">
          <div className="text-[10px] text-amber-400 uppercase font-mono">Overdue</div>
          <div className="text-base font-bold text-amber-400 font-mono mt-0.5">{tasksData.overdue}</div>
        </div>
      </div>

      {/* Recent Priority Tasks List */}
      <div className="space-y-2 pt-1">
        <h3 className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
          Active Critical Tasks
        </h3>

        {tasksData.recent_tasks.length === 0 ? (
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
            No active tasks recorded for this project.
          </div>
        ) : (
          <div className="space-y-1.5 font-mono text-xs">
            {tasksData.recent_tasks.slice(0, 4).map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-3 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      task.priority === 'Critical'
                        ? 'bg-rose-500 animate-pulse'
                        : task.priority === 'High'
                        ? 'bg-amber-400'
                        : 'bg-slate-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-slate-200 font-medium truncate font-sans text-xs">{task.title}</p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <span className="text-indigo-400">{task.department}</span>
                      <span>•</span>
                      <span>{task.assignee_name || 'Unassigned'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      task.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : task.status === 'In Progress'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                        : task.status === 'Blocked'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
