import React from 'react';
import { Link } from 'react-router-dom';
import { Task } from '@/types/tasks';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  Film,
  Box,
  Layers,
  Clock,
  Calendar,
  User,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  ExternalLink,
  GitCommit,
  Tag,
} from 'lucide-react';

interface TaskOverviewTabProps {
  task: Task;
  onUpdate: (data: Partial<Task>) => Promise<any>;
  onOpenLogModal: () => void;
}

export const TaskOverviewTab: React.FC<TaskOverviewTabProps> = ({
  task,
  onUpdate,
  onOpenLogModal,
}) => {
  const { isRunning, activeTaskId, startTimer, pauseTimer } = useTimerStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const isTimerActive = activeTaskId === task.id;
  const estimated = task.schedule?.estimated_hours || task.estimated_hours || 24;
  const logged = task.schedule?.logged_hours || task.logged_hours || 0;
  const progress = Math.min(100, Math.round((logged / estimated) * 100)) || 0;
  const isOverrun = logged > estimated;

  return (
    <div className="space-y-6">
      {/* Top Stat Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status & Phase</span>
          <div className="mt-2 flex items-center justify-between">
            <StatusBadge status={task.status} />
            <span className="text-xs font-mono text-slate-400">Step {task.workflow?.step_number || 1}/{task.workflow?.total_steps || 4}</span>
          </div>
          <span className="text-xs text-slate-500 mt-2 truncate">{task.workflow?.stage_name || 'Production'}</span>
        </div>

        {/* Priority Card */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Priority Level</span>
          <div className="mt-2 flex items-center justify-between">
            <PriorityBadge priority={task.priority} />
            {task.priority === 'Critical' && (
              <span className="text-xs text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> High Urgency
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500 mt-2 truncate">Milestone: {task.schedule?.milestone || 'Temp Delivery'}</span>
        </div>

        {/* Schedule & Due Date */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Target Due Date</span>
          <div className="mt-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-bold font-mono text-slate-100">
              {task.schedule?.due_date || task.due_date || 'Not Set'}
            </span>
          </div>
          <span className="text-xs text-slate-500 mt-2">
            Starts: {task.schedule?.start_date || '2026-08-10'}
          </span>
        </div>

        {/* Hours & Burnup */}
        <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Hours Burnup</span>
            <span className={`text-xs font-mono font-bold ${isOverrun ? 'text-rose-400' : 'text-emerald-400'}`}>
              {progress}%
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs mb-1 font-mono text-slate-300">
              <span>{logged}h logged</span>
              <span className="text-slate-500">/ {estimated}h est</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverrun ? 'bg-rose-500' : progress >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${Math.min(100, progress)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Target Entity & Context Banner */}
      <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl text-indigo-400 shrink-0 mt-0.5">
            {task.entity_type === 'Shot' ? (
              <Film className="w-6 h-6 text-cyan-400" />
            ) : task.entity_type === 'Asset' ? (
              <Box className="w-6 h-6 text-amber-400" />
            ) : (
              <Layers className="w-6 h-6 text-indigo-400" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {task.entity_type.toUpperCase()}: {task.entity_code}
              </span>
              <span className="text-xs text-slate-400 font-mono">Project {task.project_code}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-100 mt-1">
              {task.entity_name || task.entity_code}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Production context: {task.project_name || 'Cyberpunk 2099: Neo-Kyoto'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {task.entity_type === 'Shot' && (
            <Link
              to={`/projects/${task.project_id}/shots`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Film className="w-3.5 h-3.5 text-cyan-400" />
              <span>View Shot Workspace</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
          )}
          {task.entity_type === 'Asset' && (
            <Link
              to={`/assets/${task.entity_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Box className="w-3.5 h-3.5 text-amber-400" />
              <span>View Asset Workspace</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </Link>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Description & Execution Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brief & Notes */}
          <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
            <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-3">
              Task Brief & Technical Objectives
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {task.description || 'No detailed brief has been provided for this task.'}
            </p>

            {task.tags && task.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                {task.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline Workflow Stage Card */}
          <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Pipeline Workflow Progress
              </h4>
              <span className="text-xs font-mono text-indigo-400 font-bold">
                {task.workflow?.pipeline_template || 'VFX Standard Pipeline'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[
                { step: 1, name: 'Setup & Ingest', done: (task.workflow?.step_number || 1) >= 1 },
                { step: 2, name: task.workflow?.step_name || 'Working Pass', done: (task.workflow?.step_number || 1) >= 2 },
                { step: 3, name: 'Lead Dailies', done: (task.workflow?.step_number || 1) >= 3 },
                { step: 4, name: 'Final Signoff', done: (task.workflow?.step_number || 1) >= 4 },
              ].map((s) => (
                <div
                  key={s.step}
                  className={`p-3 rounded-lg border flex flex-col justify-between ${
                    s.done
                      ? 'bg-indigo-950/20 border-indigo-500/40 text-slate-100'
                      : 'bg-slate-950/30 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase font-mono">Step 0{s.step}</span>
                    {s.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <span className="text-xs font-semibold mt-2">{s.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Assigned Team, DCC, Timelog Quick Launcher */}
        <div className="space-y-6">
          {/* Active Timer Launcher Box */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/80 p-5 rounded-xl border border-indigo-500/30 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Live Time Tracker
              </span>
              {isTimerActive && isRunning && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>

            <p className="text-xs text-slate-300 mb-4">
              Track active artist hours automatically or log completed work sessions directly to production timelogs.
            </p>

            <div className="flex flex-col gap-2.5">
              {isTimerActive && isRunning ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={pauseTimer}
                  leftIcon={<Pause className="w-4 h-4 text-amber-400" />}
                >
                  Pause Live Timer
                </Button>
              ) : (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    startTimer({
                      id: task.id,
                      code: task.code,
                      title: task.title,
                      project_id: task.project_id,
                      project_code: task.project_code,
                      project_name: task.project_name,
                      department: task.department,
                    });
                    addNotification({
                      type: 'info',
                      title: 'Timer Started',
                      message: `Tracking time for ${task.code}`,
                    });
                  }}
                  leftIcon={<Play className="w-4 h-4" />}
                >
                  Start Task Timer
                </Button>
              )}

              <Button
                variant="ghost"
                className="w-full"
                onClick={onOpenLogModal}
                leftIcon={<Clock className="w-4 h-4" />}
              >
                Log Manual Hours
              </Button>
            </div>
          </div>

          {/* Assignee & Team Card */}
          <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Production Personnel
            </h4>

            {/* Assignee */}
            <div className="flex items-center gap-3">
              {task.assignee_avatar ? (
                <img
                  src={task.assignee_avatar}
                  alt={task.assignee_name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="text-xs text-slate-400 block">Lead Assignee</span>
                <span className="text-sm font-semibold text-slate-100">
                  {task.assignee_name || 'Unassigned'}
                </span>
                <span className="text-xs text-indigo-400 block">{task.assignee_role || 'Artist'}</span>
              </div>
            </div>

            {/* Reviewer */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-800/80">
              {task.reviewer_avatar ? (
                <img
                  src={task.reviewer_avatar}
                  alt={task.reviewer_name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs border border-slate-700 shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
              <div>
                <span className="text-[11px] text-slate-400 block">Reviewer / Lead</span>
                <span className="text-xs font-semibold text-slate-200">
                  {task.reviewer_name || 'Supervisor'}
                </span>
              </div>
            </div>

            {/* Team & Vendor */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Team:</span>
                <span className="font-semibold">{task.team_name || 'Alpha FX Squad'}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">Vendor:</span>
                <span className="font-semibold text-amber-300">
                  {task.vendor_name || 'In-House Studio'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-500">DCC Software:</span>
                <span className="font-mono text-indigo-300">{task.software}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
