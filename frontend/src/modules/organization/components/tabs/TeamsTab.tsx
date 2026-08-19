import React, { useState } from 'react';
import { Users, Film, Plus, Sparkles, CheckCircle2 } from 'lucide-react';
import { Organization, Team } from '@/types/organization';
import { mockTeams } from '@/mocks/db/organization/organization';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const TeamsTab: React.FC<{ org: Organization }> = ({ org }) => {
  const [teams, setTeams] = useState<Team[]>(mockTeams);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Active Production Squads & Show Pods
          </h2>
          <p className="text-xs text-slate-400">
            Dedicated cross-functional teams assigned to major cinematic milestones, hero character builds, and complex environment assets.
          </p>
        </div>

        <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
          Form New Squad
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams.map((team) => (
          <div
            key={team.id}
            className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3.5 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-white">{team.name}</h3>
                <span className="text-[11px] text-indigo-300 font-mono">Lead: {team.lead_name}</span>
              </div>
              <Badge variant="info" className="text-[9px] font-mono">
                {team.member_count} Members
              </Badge>
            </div>

            <p className="text-xs text-slate-400">Focus Discipline: {team.focus_discipline}</p>

            <div className="space-y-1 text-xs">
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Assigned Show</span>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-indigo-500/30 text-indigo-300">
                  {team.current_project_code}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Department: {team.department_name}</span>
              <span className="text-indigo-400 hover:underline cursor-pointer">Manage Squad</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
