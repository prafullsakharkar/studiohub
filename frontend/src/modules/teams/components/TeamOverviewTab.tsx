import React from 'react';
import { Users2, Shield, FolderGit2, Clock, BarChart3, CheckSquare, Award } from 'lucide-react';
import { TeamEntity } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const TeamOverviewTab: React.FC<{ team: TeamEntity }> = ({ team }) => {
  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Squad Size</span>
          <div className="flex items-center gap-2 mt-1">
            <Users2 className="w-5 h-5 text-indigo-400" />
            <span className="text-2xl font-bold font-mono text-white">{team.member_count}</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Dedicated crew members</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Weekly Quota</span>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span className="text-2xl font-bold font-mono text-white">{team.capacity_hours_weekly || 160}h</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Total burn capacity</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Show</span>
          <div className="flex items-center gap-2 mt-1">
            <FolderGit2 className="w-5 h-5 text-indigo-400" />
            <span className="text-lg font-bold font-mono text-white truncate">{team.current_project_code}</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Primary production assignment</span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <span className="text-[10px] uppercase font-mono text-slate-500 block">Efficiency</span>
          <div className="flex items-center gap-2 mt-1">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <span className="text-2xl font-bold font-mono text-white">{team.utilization_percentage || 85}%</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Current sprint utilization</span>
        </div>
      </div>

      {/* Details Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-indigo-400" />
          Squad Mandate & Discipline Focus
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          {team.description || 'Specialized production squad executing high-complexity sequence deliverables and asset builds.'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Supervisory Lead</span>
            <span className="text-xs font-bold text-white block mt-1">{team.lead_name}</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Parent Discipline</span>
            <span className="text-xs font-bold text-indigo-300 block mt-1">{team.department_name} ({team.focus_discipline})</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block">Squad Code</span>
            <span className="text-xs font-mono text-slate-300 block mt-1">{team.code}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
