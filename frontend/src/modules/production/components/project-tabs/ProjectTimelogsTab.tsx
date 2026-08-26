import React, { useState } from 'react';
import {
  Clock,
  DollarSign,
  User,
  Calendar,
  Plus,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
} from 'lucide-react';
import { Project } from '@/mocks/db/production/projects';
import { mockTimelogs, TimelogEntry } from '@/mocks/db/production/timelogs';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectTimelogsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectTimelogsTab: React.FC<ProjectTimelogsTabProps> = ({ project, onNavigateTab }) => {
  const [timelogs, setTimelogs] = useState<TimelogEntry[]>(
    mockTimelogs.filter((t) => t.project_code === project.code || t.project_id === project.id).length > 0
      ? mockTimelogs.filter((t) => t.project_code === project.code || t.project_id === project.id)
      : mockTimelogs
  );

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [formData, setFormData] = useState({
    artist_name: 'Elena Rostova',
    department: 'Compositing',
    entity_code: 'NK_010_0010',
    entity_type: 'Shot' as 'Shot' | 'Asset' | 'General Production',
    task_title: 'Lighting Match & Flare Integrations',
    hours_logged: 8.0,
    date_logged: new Date().toISOString().split('T')[0],
    is_overtime: false,
    activity_category: 'Direct Work' as any,
    description: 'Matched anamorphic flare dispersion against hero physical plate.',
  });

  const totalHours = timelogs.reduce((acc, t) => acc + t.hours_logged, 0);
  const totalCost = timelogs.reduce((acc, t) => acc + t.hours_logged * t.billing_rate_usd, 0);
  const overtimeHours = timelogs.filter((t) => t.is_overtime).reduce((acc, t) => acc + t.hours_logged, 0);

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: TimelogEntry = {
      id: `time-${Date.now()}`,
      project_id: project.id,
      project_code: project.code,
      artist_id: 'usr-003',
      artist_name: formData.artist_name,
      artist_avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      department: formData.department,
      entity_type: formData.entity_type,
      entity_code: formData.entity_code,
      task_title: formData.task_title,
      hours_logged: Number(formData.hours_logged),
      date_logged: formData.date_logged,
      is_overtime: formData.is_overtime,
      activity_category: formData.activity_category,
      description: formData.description,
      billing_rate_usd: 95,
      approved_by_name: 'Alex Chen',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTimelogs([newEntry, ...timelogs]);
    setIsLogModalOpen(false);
    addNotification({
      type: 'success',
      title: 'Timelog Logged',
      message: `Logged ${formData.hours_logged} hours for ${formData.entity_code}.`,
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
            Track actual creative man-hours against bid days, overtime rates, and departmental budgets
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
          <span className="text-[11px] text-emerald-400 font-mono">Within 85% bid envelope</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>OVERTIME SURCHARGE</span>
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-300 font-mono">{overtimeHours.toFixed(1)} hrs</p>
          <span className="text-[11px] text-slate-400 font-mono">Weekend / Crunch shifts</span>
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
          {timelogs.map((entry) => (
            <div
              key={entry.id}
              className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                {entry.artist_avatar ? (
                  <img
                    src={entry.artist_avatar}
                    alt={entry.artist_name}
                    className="w-10 h-10 rounded-xl object-cover bg-slate-950 border border-slate-800 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-mono font-bold shrink-0">
                    {entry.artist_name.charAt(0)}
                  </div>
                )}

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">{entry.artist_name}</span>
                    <span className="px-2 py-0.2 text-[10px] font-mono bg-slate-800 text-slate-300 rounded border border-slate-700">
                      {entry.department}
                    </span>
                    <span className="px-2 py-0.2 text-[10px] font-mono bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/30">
                      {entry.entity_code}
                    </span>
                    {entry.is_overtime && (
                      <span className="px-2 py-0.2 text-[10px] font-mono bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                        1.5x Overtime
                      </span>
                    )}
                  </div>

                  <p className="text-xs font-semibold text-slate-200">{entry.task_title}</p>
                  <p className="text-xs text-slate-400 italic line-clamp-1">{entry.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 self-end md:self-auto shrink-0 font-mono">
                <div className="text-right">
                  <span className="text-sm font-bold text-white block">{entry.hours_logged} hrs</span>
                  <span className="text-[11px] text-slate-400">{entry.date_logged}</span>
                </div>

                <div className="text-right">
                  <span className="text-xs text-emerald-400 font-bold block">
                    ${entry.hours_logged * entry.billing_rate_usd}
                  </span>
                  <span className="text-[10px] text-slate-500">${entry.billing_rate_usd}/hr</span>
                </div>

                <span className="px-2 py-1 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Approved
                </span>
              </div>
            </div>
          ))}
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
              <label className="text-xs font-semibold text-slate-300">Artist Name</label>
              <input
                type="text"
                required
                value={formData.artist_name}
                onChange={(e) => setFormData({ ...formData, artist_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Department</label>
              <input
                type="text"
                required
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Entity Code</label>
              <input
                type="text"
                required
                value={formData.entity_code}
                onChange={(e) => setFormData({ ...formData, entity_code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Hours Logged</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                required
                value={formData.hours_logged}
                onChange={(e) => setFormData({ ...formData, hours_logged: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Task Title</label>
            <input
              type="text"
              required
              value={formData.task_title}
              onChange={(e) => setFormData({ ...formData, task_title: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Activity Summary</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="overtime_check"
              checked={formData.is_overtime}
              onChange={(e) => setFormData({ ...formData, is_overtime: e.target.checked })}
              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="overtime_check" className="text-xs text-slate-300 select-none">
              Overtime / Crunch Shift (1.5x Multiplier)
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsLogModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Timelog
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
