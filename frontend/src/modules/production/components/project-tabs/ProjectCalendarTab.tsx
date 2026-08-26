import React, { useState } from 'react';
import {
  Calendar,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Flame,
  ArrowRight,
  Plus,
  Tv,
} from 'lucide-react';
import { Project } from '@/mocks/db/production/projects';
import { mockCalendarMilestones, CalendarMilestone } from '@/mocks/db/production/calendar';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectCalendarTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectCalendarTab: React.FC<ProjectCalendarTabProps> = ({ project, onNavigateTab }) => {
  const [milestones, setMilestones] = useState<CalendarMilestone[]>(
    mockCalendarMilestones.filter((m) => m.project_code === project.code || m.project_id === project.id).length > 0
      ? mockCalendarMilestones.filter((m) => m.project_code === project.code || m.project_id === project.id)
      : mockCalendarMilestones
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [newTitle, setNewTitle] = useState('');
  const [newCat, setNewCat] = useState<'Client Turnover' | 'Internal Milestone' | 'Vendor Turnover' | 'Final Delivery' | 'Dailies Screening' | 'Editorial Lock'>('Internal Milestone');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [shotsAffected, setShotsAffected] = useState(12);
  const [isCritical, setIsCritical] = useState(false);

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: CalendarMilestone = {
      id: `cal-${Date.now()}`,
      project_id: project.id,
      project_code: project.code,
      title: newTitle,
      category: newCat,
      start_date: startDate,
      end_date: endDate,
      status: 'Upcoming',
      progress_pct: 0,
      owner_name: 'Alex Chen',
      department_lead: 'Elena Rostova',
      deliverables_summary: `${shotsAffected} shots turnover milestone.`,
      shots_affected: shotsAffected,
      critical_path: isCritical,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMilestones([...milestones, newEntry]);
    setIsModalOpen(false);
    addNotification({
      type: 'success',
      title: 'Milestone Added',
      message: `Scheduled milestone ${newTitle}.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Production Schedule Milestones & Critical Path Deliveries
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Track key client turnovers, director screening locks, and VFX delivery gates
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Milestone
        </Button>
      </div>

      {/* Milestone Cards */}
      <div className="space-y-4">
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Flag className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-bold text-white">{milestone.title}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {milestone.category}
                    </span>
                    {milestone.critical_path && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-rose-400" /> Critical Path
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Lead: <span className="text-slate-200">{milestone.owner_name}</span> • Discipline:{' '}
                    <span className="text-indigo-300">{milestone.department_lead}</span> • Shots Impacted:{' '}
                    <span className="text-white font-bold">{milestone.shots_affected}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto font-mono">
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">DUE DATE</span>
                  <span className="text-sm font-bold text-white">{milestone.end_date}</span>
                </div>
                <StatusBadge status={milestone.status} />
              </div>
            </div>

            {/* Deliverables summary */}
            <p className="text-xs text-slate-300">{milestone.deliverables_summary}</p>

            {/* Progress Bar */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Milestone Progress</span>
                <span className="font-bold text-white">{milestone.progress_pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    milestone.progress_pct === 100
                      ? 'bg-emerald-500'
                      : milestone.progress_pct > 60
                      ? 'bg-indigo-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${milestone.progress_pct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Milestone Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Schedule Production Milestone"
        subtitle={`Register turnover gate for show ${project.code}`}
      >
        <form onSubmit={handleAddMilestone} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Milestone Title</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Sequence 010 Client Review Cut"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Milestone Category</label>
            <select
              value={newCat}
              onChange={(e) => setNewCat(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            >
              <option value="Client Turnover">Client Turnover</option>
              <option value="Internal Milestone">Internal Milestone</option>
              <option value="Vendor Turnover">Vendor Turnover</option>
              <option value="Final Delivery">Final Delivery</option>
              <option value="Dailies Screening">Dailies Screening</option>
              <option value="Editorial Lock">Editorial Lock</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Delivery Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Shots Impacted</label>
            <input
              type="number"
              min="1"
              value={shotsAffected}
              onChange={(e) => setShotsAffected(parseInt(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="critical_path_check"
              checked={isCritical}
              onChange={(e) => setIsCritical(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="critical_path_check" className="text-xs text-slate-300 select-none">
              Mark as Critical Path Delivery Gate
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Schedule Milestone
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
