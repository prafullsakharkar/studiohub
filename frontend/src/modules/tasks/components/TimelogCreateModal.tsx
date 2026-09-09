import React, { useState } from 'react';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Timelog, Task, TimelogCategory } from '@/types/tasks';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { Clock, CheckSquare, DollarSign, Calendar, FileText } from 'lucide-react';

interface TimelogCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Timelog>) => Promise<any>;
  task?: Task;
  defaultDurationHours?: number;
  initialNotes?: string;
  isBillableDefault?: boolean;
}

export const TimelogCreateModal: React.FC<TimelogCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  task,
  defaultDurationHours = 1.0,
  initialNotes = '',
  isBillableDefault = true,
}) => {
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addActivity = useActivityStore((state) => state.addActivity);

  const [durationHours, setDurationHours] = useState<number>(defaultDurationHours);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [billable, setBillable] = useState<boolean>(isBillableDefault);
  const [activityCategory, setActivityCategory] = useState<string>('Direct Work');
  const [notes, setNotes] = useState<string>(initialNotes);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (durationHours <= 0) {
      addNotification({
        type: 'error',
        title: 'Validation Error',
        message: 'Duration must be greater than 0 hours.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Timelog> = {
        task_id: task?.id || 'task-001',
        task_code: task?.code || 'TSK-001',
        task_title: task?.title || 'Production Task',
        project_id: task?.project_id || 'proj-001',
        project_code: task?.project_code || 'NK99',
        project_name: task?.project_name || 'Cyberpunk 2099: Neo-Kyoto',
        person_id: user?.id || 'usr-001',
        person_name: user?.full_name || 'Alex Chen',
        person_avatar: user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        person_role: user?.role || 'Lead Artist',
        department: task?.department || 'FX & Simulation',
        duration_hours: Number(durationHours),
        date,
        billable,
        notes,
        status: 'Submitted',
        activity_category: activityCategory as TimelogCategory,
        hourly_rate_usd: 115,
      };

      await onSubmit(payload);

      addActivity({
        actor: {
          id: user?.id || 'usr-001',
          name: user?.full_name || 'Alex Chen',
          email: user?.email || 'artist@studiohub.vfx',
          role: user?.role || 'Lead Artist',
        },
        action: 'create',
        actionLabel: 'Time Logged',
        entity: {
          type: 'task',
          id: task?.id || 'task-001',
          code: task?.code || 'TSK-001',
          name: task?.title || 'Task',
          context: `${task?.project_code} / ${durationHours}h`,
        },
        description: `Logged ${durationHours}h on ${task?.code}: ${notes || 'No description'}`,
        tags: ['Timelog', billable ? 'Billable' : 'Non-Billable', activityCategory],
      });

      addNotification({
        type: 'success',
        title: 'Hours Logged Successfully',
        message: `Logged ${durationHours}h for ${task?.code || 'task'}.`,
      });

      onClose();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to Log Hours',
        message: err.message || 'An error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Log Time: ${task?.code || 'Task'}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {task && (
          <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-xs text-slate-300">
            <span className="font-semibold text-slate-100">{task.title}</span>
            <div className="flex items-center gap-2 mt-1 text-slate-400 font-mono">
              <span>{task.project_code}</span>
              <span>•</span>
              <span>{task.department}</span>
              <span>•</span>
              <span>{task.entity_code}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Duration (Hours) <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              max="24"
              required
              value={durationHours}
              onChange={(e) => setDurationHours(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Date <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Activity Category
            </label>
            <select
              value={activityCategory}
              onChange={(e) => setActivityCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Direct Work">Direct Work (DCC / Asset / Shot)</option>
              <option value="Simulation Run">Simulation Run / Caching</option>
              <option value="LookDev Tuning">LookDev & Shader Tuning</option>
              <option value="Lighting Setup">Lighting & HDRI Calibration</option>
              <option value="Dailies / Review">Dailies & Internal Review</option>
              <option value="Pipeline Debug">Pipeline Debug & Tooling</option>
              <option value="Meeting / Sync">Production Meeting / Sync</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-900 p-2.5 rounded-md border border-slate-700 hover:bg-slate-800 transition-colors">
              <input
                type="checkbox"
                checked={billable}
                onChange={(e) => setBillable(e.target.checked)}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Billable Client Work
              </span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Work Notes / Technical Summary
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Detail achievements, solver tweaks, cache frame ranges, or bugs resolved..."
            className="w-full bg-slate-900 border border-slate-700 rounded-md p-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting} leftIcon={<Clock className="w-4 h-4" />}>
            Submit Timelog
          </Button>
        </div>
      </form>
    </Modal>
  );
};
