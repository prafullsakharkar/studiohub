import React, { useState } from 'react';
import { Task } from '@/types/tasks';
import { Button } from '@/shared/components/Button';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  Calendar,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Save,
  Flag,
} from 'lucide-react';

interface TaskScheduleTabProps {
  task: Task;
  onUpdate: (data: Partial<Task>) => Promise<any>;
}

export const TaskScheduleTab: React.FC<TaskScheduleTabProps> = ({ task, onUpdate }) => {
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [startDate, setStartDate] = useState(task.schedule?.start_date || '2026-08-10');
  const [dueDate, setDueDate] = useState(task.schedule?.due_date || task.due_date || '2026-08-28');
  const [estimatedHours, setEstimatedHours] = useState(task.schedule?.estimated_hours || task.estimated_hours || 32);
  const [milestone, setMilestone] = useState(task.schedule?.milestone || 'First Client Temp');
  const [progressPercent, setProgressPercent] = useState(task.schedule?.progress_percent ?? 45);
  const [isSaving, setIsSaving] = useState(false);

  const loggedHours = task.schedule?.logged_hours || task.logged_hours || 0;
  const remainingHours = Math.max(0, estimatedHours - loggedHours);
  const isOverrun = loggedHours > estimatedHours;
  const isOverdue = new Date(dueDate).getTime() < Date.now() && task.status !== 'Approved';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdate({
        due_date: dueDate,
        estimated_hours: Number(estimatedHours),
        schedule: {
          start_date: startDate,
          due_date: dueDate,
          estimated_hours: Number(estimatedHours),
          logged_hours: loggedHours,
          progress_percent: Number(progressPercent),
          milestone,
          overrun_risk: isOverrun,
        },
      });

      addNotification({
        type: 'success',
        title: 'Schedule Updated',
        message: 'Task timeline and burnup budget saved.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to Save Schedule',
        message: err.message || 'An error occurred.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Schedule Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estimated Budget</span>
          <div className="text-2xl font-bold font-mono text-slate-100 mt-2">{estimatedHours} hrs</div>
          <span className="text-xs text-slate-500 mt-1">Total allocated artist capacity</span>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Actual Logged Time</span>
          <div className={`text-2xl font-bold font-mono mt-2 ${isOverrun ? 'text-rose-400' : 'text-emerald-400'}`}>
            {loggedHours} hrs
          </div>
          <span className="text-xs text-slate-500 mt-1">
            {isOverrun ? `${loggedHours - estimatedHours}h over budget` : `${remainingHours}h budget remaining`}
          </span>
        </div>

        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Completion Status</span>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-2">{progressPercent}%</div>
          <span className="text-xs text-slate-500 mt-1">Manual artist progress estimate</span>
        </div>
      </div>

      {/* Overrun / Overdue Warnings */}
      {(isOverrun || isOverdue) && (
        <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/60 flex items-center gap-3 text-sm text-rose-200">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <div>
            <span className="font-semibold block">Schedule Alert Triggered</span>
            <span className="text-xs text-rose-300">
              {isOverrun && isOverdue
                ? 'This task has exceeded its hour allocation and is past its scheduled delivery deadline.'
                : isOverrun
                ? 'Logged time has exceeded the estimated hour quota. Please check with production coordinator.'
                : 'Task delivery date is in the past.'}
            </span>
          </div>
        </div>
      )}

      {/* Main Schedule Form Box */}
      <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Schedule & Milestone Configuration</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Set deadlines, milestones, and estimated hours.
            </p>
          </div>
          <Button type="submit" variant="primary" isLoading={isSaving} leftIcon={<Save className="w-4 h-4" />}>
            Save Schedule
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Target Due Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Estimated Hours (Quota)
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Milestone Checkpoint
            </label>
            <input
              type="text"
              value={milestone}
              onChange={(e) => setMilestone(e.target.value)}
              placeholder="e.g. Director Temp Delivery"
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Progress Percentage ({progressPercent}%)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-3"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
