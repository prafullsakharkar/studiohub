import React, { useState } from 'react';
import {
  Clock,
  DollarSign,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { Timelog, TimelogCategory } from '@/types/tasks';
import { useTimelogs, useTimelogMutations } from '@/modules/tasks/hooks/useTimelogs';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectTimelogsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

const ACTIVITY_CATEGORIES: TimelogCategory[] = [
  'Direct Work',
  'Revisions',
  'Dailies / Meetings',
  'Pipeline Debug',
  'Simulation Run',
  'Lighting Setup',
  'LookDev Tuning',
  'Plate Prep & Clean',
];

const statusBadge = (status: string) => {
  if (status === 'Approved') {
    return (
      <span className="px-2 py-1 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Approved
      </span>
    );
  }
  if (status === 'Rejected') {
    return (
      <span className="px-2 py-1 rounded text-[10px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Rejected
      </span>
    );
  }
  return (
    <span className="px-2 py-1 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
      {status}
    </span>
  );
};

export const ProjectTimelogsTab: React.FC<ProjectTimelogsTabProps> = ({ project, onNavigateTab }) => {
  const { data: timelogsData, isLoading } = useTimelogs({
    project_id: project.id,
    page_size: 50,
  });
  const timelogs: Timelog[] = (timelogsData as any)?.results ?? timelogsData ?? [];

  const { data: tasksData } = useTasks({ project_id: project.id, page_size: 100 });
  const projectTasks = (tasksData as any)?.results ?? tasksData ?? [];

  const { createTimelog, isCreating } = useTimelogMutations();
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    task_id: '',
    duration_hours: 8.0,
    date: new Date().toISOString().split('T')[0],
    activity_category: 'Direct Work' as TimelogCategory,
    notes: '',
  });

  const totalHours = timelogs.reduce((acc, t) => acc + t.duration_hours, 0);
  const billableHours = timelogs.filter((t) => t.billable).reduce((acc, t) => acc + t.duration_hours, 0);
  const totalCost = timelogs.reduce((acc, t) => acc + t.duration_hours * (t.hourly_rate_usd || 115), 0);

  const handleLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTask = projectTasks.find((t) => t.id === formData.task_id);
    if (!selectedTask) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Please select a task to log hours against.',
      });
      return;
    }

    await createTimelog.mutateAsync({
      task_id: selectedTask.id,
      task_code: selectedTask.code,
      task_title: selectedTask.title,
      project_id: project.id,
      project_code: project.code,
      project_name: project.name,
      person_id: user?.id || '',
      person_name: user?.full_name || '',
      person_avatar: user?.avatar_url,
      person_role: user?.role,
      department: selectedTask.department || '',
      duration_hours: Number(formData.duration_hours),
      date: formData.date,
      billable: true,
      notes: formData.notes,
      status: 'Submitted',
      activity_category: formData.activity_category,
      hourly_rate_usd: 115,
    } as Partial<Timelog>);

    setIsLogModalOpen(false);
    addNotification({
      type: 'success',
      title: 'Timelog Logged',
      message: `Logged ${formData.duration_hours} hours for ${selectedTask.code}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-400" />
            Artist Timelogs & Production Burn-Down Analytics
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Track actual creative man-hours against bid days, billable rates, and departmental budgets
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsLogModalOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Log Man-Hours
        </Button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>TOTAL HOURS LOGGED</span>
            <Clock className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono">{totalHours.toFixed(1)} hrs</p>
          <span className="text-[11px] text-slate-400 font-mono">{timelogs.length} entries recorded</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>BILLABLE HOURS</span>
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 font-mono">{billableHours.toFixed(1)} hrs</p>
          <span className="text-[11px] text-slate-400 font-mono">Client-invoicable work</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>ESTIMATED PAYROLL BURN</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono">
            ${totalCost.toLocaleString('en-US', { minimumFractionDigits: 0 })}
          </p>
          <span className="text-[11px] text-slate-400 font-mono">Direct Labor Cost</span>
        </div>
      </div>

      {/* Timelogs Table */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono px-1">
          Recent Timesheet Entries ({timelogs.length})
        </h4>

        <div className="space-y-2">
          {isLoading && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-400">
              Loading timelogs…
            </div>
          )}
          {timelogs.map((entry) => (
            <div
              key={entry.id}
              className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                {entry.person_avatar ? (
                  <img
                    src={entry.person_avatar}
                    alt={entry.person_name}
                    className="w-10 h-10 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-mono font-bold shrink-0">
                    {(entry.person_name || '?').charAt(0)}
                  </div>
                )}

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{entry.person_name || 'Unknown'}</span>
                    <span className="px-2 py-0.2 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {entry.department || '—'}
                    </span>
                    <span className="px-2 py-0.2 text-[10px] font-mono bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                      {entry.task_code}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-200">{entry.task_title}</p>
                  <p className="text-xs text-slate-400 italic line-clamp-1">{entry.notes || '—'}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end md:self-auto shrink-0 font-mono">
                <div className="text-right">
                  <span className="text-sm font-bold text-white block">{entry.duration_hours} hrs</span>
                  <span className="text-[11px] text-slate-400">{entry.date}</span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-emerald-400 font-bold block">
                    ${(entry.duration_hours * (entry.hourly_rate_usd || 115)).toLocaleString('en-US')}
                  </span>
                  <span className="text-[10px] text-slate-500">${entry.hourly_rate_usd || 115}/hr</span>
                </div>

                {statusBadge(entry.status)}
              </div>
            </div>
          ))}
          {!isLoading && timelogs.length === 0 && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center text-xs text-slate-500">
              No timelogs recorded for this project yet.
            </div>
          )}
        </div>
      </div>

      {/* Log Hours Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Log Work Hours / Timesheet"
        subtitle={`Record task progress for show ${project.code}`}
      >
        <form onSubmit={handleLogSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Task</label>
              <select
                required
                value={formData.task_id}
                onChange={(e) => setFormData({ ...formData, task_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              >
                <option value="">— Select Task —</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code}: {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Hours Logged</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                required
                value={formData.duration_hours}
                onChange={(e) => setFormData({ ...formData, duration_hours: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Date</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Activity Category</label>
              <select
                value={formData.activity_category}
                onChange={(e) => setFormData({ ...formData, activity_category: e.target.value as TimelogCategory })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Activity Summary</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsLogModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={isCreating}>
              Save Timelog
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
