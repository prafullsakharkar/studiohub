import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Project } from '@/types/projects';
import {
  mockProjectMilestones,
  ProjectMilestone,
} from '@/mocks/db/production/projectDetails';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectScheduleTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectScheduleTab: React.FC<ProjectScheduleTabProps> = ({ project }) => {
  const [milestones, setMilestones] = useState<ProjectMilestone[]>(
    mockProjectMilestones.filter((m) => m.project_id === project.id).length > 0
      ? mockProjectMilestones.filter((m) => m.project_id === project.id)
      : mockProjectMilestones
  );
  const [isAddOpen, setIsAddOpen] = useState(false);

  const addNotification = useNotificationStore((state) => state.addNotification);

  const [formData, setFormData] = useState({
    title: '',
    phase: 'Lighting & Comp' as ProjectMilestone['phase'],
    due_date: '2026-10-15',
    owner_name: 'Alex Chen',
    deliverables_count: 50,
    notes: '',
  });

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    const newMs: ProjectMilestone = {
      id: `pms-${Date.now()}`,
      project_id: project.id,
      ...formData,
      status: 'Upcoming',
      progress_pct: 0,
    };
    setMilestones([...milestones, newMs]);
    setIsAddOpen(false);
    addNotification({
      type: 'success',
      title: 'Milestone Created',
      message: `Milestone "${formData.title}" added to show roadmap.`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Production Milestone Roadmap & Delivery Timeline
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Target Delivery Date: <strong className="text-indigo-300 font-mono">{project.delivery_date}</strong> (240 VFX Shots • ACEScg DCI 4K)
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Milestone
        </Button>
      </div>

      {/* Timeline Gantt / Sequence Stages */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase font-mono tracking-wider">
          Production Phase Sequencing
        </h4>

        <div className="space-y-4">
          {milestones.map((ms, index) => (
            <div
              key={ms.id}
              className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                      ms.status === 'Completed'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : ms.status === 'In Progress'
                        ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-white">{ms.title}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-indigo-300 border border-slate-800">
                        {ms.phase}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{ms.notes}</p>
                  </div>
                </div>

                <div className="flex items-center sm:flex-col sm:items-end justify-between gap-1 font-mono text-xs shrink-0">
                  <span className="font-bold text-white">Target: {ms.due_date}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                      ms.status === 'Completed'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : ms.status === 'In Progress'
                        ? 'bg-indigo-500/10 text-indigo-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {ms.status}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1 font-mono text-xs pt-2 border-t border-slate-800/80">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Deliverables: {ms.deliverables_count} items</span>
                  <span className="font-bold text-white">{ms.progress_pct}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      ms.status === 'Completed' ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                    style={{ width: `${ms.progress_pct}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                <span>Owner: <strong className="text-slate-200">{ms.owner_name}</strong></span>
                <span className="font-mono text-slate-500">ID: {ms.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Milestone Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Create Production Milestone"
        subtitle={`Schedule milestone for show ${project.name} (${project.code})`}
      >
        <form onSubmit={handleAddMilestone} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Milestone Title</label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Hero CG Assets Lock & Turntable Review"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Phase</label>
              <select
                value={formData.phase}
                onChange={(e) => setFormData({ ...formData, phase: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Turnover & Ingest">Turnover & Ingest</option>
                <option value="Layout & Previz">Layout & Previz</option>
                <option value="Asset Build">Asset Build</option>
                <option value="Animation & FX">Animation & FX</option>
                <option value="Lighting & Comp">Lighting & Comp</option>
                <option value="Final Color Grading">Final Color Grading</option>
                <option value="Delivery">Delivery</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Due Date</label>
              <input
                required
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Owner / Lead</label>
              <input
                type="text"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Deliverable Count</label>
              <input
                type="number"
                value={formData.deliverables_count}
                onChange={(e) => setFormData({ ...formData, deliverables_count: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description & Acceptance Criteria</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Milestone technical scope and required deliverable formats..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsAddOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Milestone
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
