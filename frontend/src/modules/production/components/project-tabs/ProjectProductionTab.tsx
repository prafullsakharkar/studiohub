import React from 'react';
import {
  Film,
  Layers,
  Cpu,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  Clapperboard,
  Sliders,
  Sparkles,
  Users,
  Flame,
} from 'lucide-react';
import { Project } from '@/mocks/db/production/projects';
import { mockProjectSequences } from '@/mocks/db/production/projectDetails';
import { Badge } from '@/shared/components/Badge';

interface ProjectProductionTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectProductionTab: React.FC<ProjectProductionTabProps> = ({
  project,
  onNavigateTab,
}) => {
  const sequences = mockProjectSequences.filter((s) => s.project_id === project.id);
  const displaySequences = sequences.length > 0 ? sequences : mockProjectSequences;

  const departments = [
    { name: 'Previz & Layout', total: 240, approved: 236, in_progress: 4, pct: 98, color: 'bg-indigo-500' },
    { name: 'Modeling & Assets', total: 85, approved: 80, in_progress: 5, pct: 94, color: 'bg-purple-500' },
    { name: 'Rigging & CFX', total: 62, approved: 58, in_progress: 4, pct: 93, color: 'bg-blue-500' },
    { name: 'Character Animation', total: 180, approved: 142, in_progress: 38, pct: 78, color: 'bg-emerald-500' },
    { name: 'FX & Volumetric Sim', total: 165, approved: 110, in_progress: 55, pct: 66, color: 'bg-amber-500' },
    { name: 'Lighting & LookDev', total: 240, approved: 128, in_progress: 112, pct: 53, color: 'bg-rose-500' },
    { name: 'Final Compositing', total: 240, approved: 98, in_progress: 142, pct: 40, color: 'bg-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Production Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
          <span className="text-xs font-mono text-slate-400">Total Sequence Count</span>
          <div className="text-2xl font-bold font-mono text-white">3 Sequences / 240 Shots</div>
          <p className="text-[11px] text-slate-400 font-mono">Master Average: 80 shots per reel</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
          <span className="text-xs font-mono text-slate-400">Average Turnaround Velocity</span>
          <div className="text-2xl font-bold font-mono text-emerald-400">14.2 Shots / Week</div>
          <p className="text-[11px] text-emerald-400/80 font-mono">Ahead of baseline schedule +4 days</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2">
          <span className="text-xs font-mono text-slate-400">Render Farm Compute Dispatched</span>
          <div className="text-2xl font-bold font-mono text-indigo-400">142,500 Core Hours</div>
          <p className="text-[11px] text-indigo-300 font-mono">Karma XPU & Houdini Mantra Engine</p>
        </div>
      </div>

      {/* Sequence Breakdown Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <Film className="w-4 h-4 text-indigo-400" />
              Sequence Production Breakdown
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reel-by-reel progress, shot approvals, and supervisor lead assignments
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('shots')}
            className="text-xs font-mono text-indigo-400 hover:text-indigo-300"
          >
            Explore Shots →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {displaySequences.map((seq) => {
            const seqPct = Math.round((seq.approved_shots / seq.shot_count) * 100);
            return (
              <div
                key={seq.id}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-indigo-400">{seq.sequence_code}</span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                      seq.complexity === 'Extreme'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {seq.complexity} Complexity
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-white">{seq.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{seq.description}</p>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Approved: {seq.approved_shots} / {seq.shot_count}</span>
                    <span className="font-bold text-white">{seqPct}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${seqPct}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Lead: <strong className="text-slate-200">{seq.lead_artist}</strong></span>
                  <span className="font-mono text-slate-500">{seq.in_progress_shots} in flight</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Department Production Pipeline Progress */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
              Department Pipeline Progression
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('tasks')}
            className="text-xs font-mono text-indigo-400 hover:text-indigo-300"
          >
            Discipline Board →
          </button>
        </div>

        <div className="space-y-3">
          {departments.map((dept) => (
            <div key={dept.name} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                <span className="font-bold text-white font-mono">{dept.name}</span>
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span>Approved: <strong className="text-emerald-400">{dept.approved}</strong></span>
                  <span>In Progress: <strong className="text-amber-400">{dept.in_progress}</strong></span>
                  <span>Total Scope: <strong className="text-white">{dept.total}</strong></span>
                  <span className="font-bold text-indigo-400">{dept.pct}% Complete</span>
                </div>
              </div>

              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
                <div
                  className={`${dept.color} h-full rounded-full transition-all duration-500`}
                  style={{ width: `${dept.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
