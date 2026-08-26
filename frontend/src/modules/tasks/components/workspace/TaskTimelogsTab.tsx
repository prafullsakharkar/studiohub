import React, { useState } from 'react';
import { Task, Timelog } from '@/types/tasks';
import { useTimelogs, useTimelogMutations } from '../../hooks/useTimelogs';
import { Button } from '@/shared/components/Button';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { TimelogCreateModal } from '../TimelogCreateModal';
import {
  Clock,
  Play,
  Pause,
  Plus,
  CheckCircle2,
  XCircle,
  Trash2,
  DollarSign,
  User,
  AlertCircle,
} from 'lucide-react';

interface TaskTimelogsTabProps {
  task: Task;
}

export const TaskTimelogsTab: React.FC<TaskTimelogsTabProps> = ({ task }) => {
  const { data: timelogsData, isLoading } = useTimelogs({ task_id: task.id });
  const { approveTimelog, rejectTimelog, deleteTimelog, createTimelog } = useTimelogMutations();
  const { isRunning, activeTaskId, startTimer, pauseTimer } = useTimerStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const timelogs = timelogsData?.results || [];
  const totalLoggedHours = timelogs.reduce((acc, log) => acc + log.duration_hours, 0);
  const billableHours = timelogs.filter((l) => l.billable).reduce((acc, l) => acc + l.duration_hours, 0);

  const isTimerActive = activeTaskId === task.id;

  const handleApprove = async (logId: string) => {
    try {
      await approveTimelog.mutateAsync({ id: logId });
      addNotification({
        type: 'success',
        title: 'Timelog Approved',
        message: 'Hours approved for studio payroll & client billing.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Approval Failed',
        message: err.message,
      });
    }
  };

  const handleReject = async (logId: string) => {
    try {
      await rejectTimelog.mutateAsync({ id: logId });
      addNotification({
        type: 'info',
        title: 'Timelog Rejected',
        message: 'Marked entry for artist revision.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Rejection Failed',
        message: err.message,
      });
    }
  };

  const handleDelete = async (logId: string) => {
    try {
      await deleteTimelog.mutateAsync(logId);
      addNotification({
        type: 'success',
        title: 'Timelog Deleted',
        message: 'Removed hour entry.',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: err.message,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Timelog Header & Summary Box */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Total Logged Time</span>
            <span className="text-2xl font-bold font-mono text-slate-100">{totalLoggedHours.toFixed(1)} hrs</span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Billable Hours</span>
            <span className="text-2xl font-bold font-mono text-emerald-400">{billableHours.toFixed(1)} hrs</span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-xs text-slate-400 uppercase tracking-wider block">Total Entries</span>
            <span className="text-2xl font-bold font-mono text-indigo-400">{timelogs.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isTimerActive && isRunning ? (
            <Button
              variant="outline"
              onClick={pauseTimer}
              leftIcon={<Pause className="w-4 h-4 text-amber-400" />}
            >
              Pause Timer
            </Button>
          ) : (
            <Button
              variant="outline"
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
              leftIcon={<Play className="w-4 h-4 text-emerald-400" />}
            >
              Start Timer
            </Button>
          )}

          <Button
            variant="primary"
            onClick={() => setIsCreateModalOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Log Hours Manually
          </Button>
        </div>
      </div>

      {/* Timelogs Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40 shadow-lg">
        <table className="w-full text-left text-sm text-slate-300 border-collapse">
          <thead className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
            <tr>
              <th className="p-3.5">Date</th>
              <th className="p-3.5">Person</th>
              <th className="p-3.5">Category</th>
              <th className="p-3.5">Duration</th>
              <th className="p-3.5">Billable</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Notes</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500">
                  Loading timelogs...
                </td>
              </tr>
            ) : timelogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                  No timelogs recorded for this task yet.
                </td>
              </tr>
            ) : (
              timelogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/40 transition-colors group">
                  {/* Date */}
                  <td className="p-3.5 text-xs font-mono font-semibold text-slate-200">
                    {log.date}
                  </td>

                  {/* Person */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      {log.person_avatar ? (
                        <img
                          src={log.person_avatar}
                          alt={log.person_name}
                          className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs shrink-0">
                          <User className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <span className="text-xs text-slate-200 truncate">{log.person_name}</span>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="p-3.5 text-xs">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80">
                      {log.activity_category || 'Direct Work'}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="p-3.5 text-xs font-mono font-bold text-slate-100">
                    {log.duration_hours} hrs
                  </td>

                  {/* Billable */}
                  <td className="p-3.5 text-xs">
                    {log.billable ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                        <DollarSign className="w-3.5 h-3.5" /> Billable
                      </span>
                    ) : (
                      <span className="text-slate-500">Non-billable</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="p-3.5 text-xs">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        log.status === 'Approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : log.status === 'Rejected'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>

                  {/* Notes */}
                  <td className="p-3.5 text-xs text-slate-400 max-w-xs truncate" title={log.notes}>
                    {log.notes || '—'}
                  </td>

                  {/* Actions */}
                  <td className="p-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {log.status !== 'Approved' && (
                        <button
                          onClick={() => handleApprove(log.id)}
                          className="p-1.5 rounded bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-800/60 transition-colors"
                          title="Approve timelog"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {log.status !== 'Rejected' && (
                        <button
                          onClick={() => handleReject(log.id)}
                          className="p-1.5 rounded bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/60 transition-colors"
                          title="Reject timelog"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(log.id)}
                        className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 border border-slate-700 transition-colors"
                        title="Delete timelog"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isCreateModalOpen && (
        <TimelogCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data) => createTimelog.mutateAsync(data)}
          task={task}
        />
      )}
    </div>
  );
};
