import React, { useState } from 'react';
import { Users2, Check, ArrowRight, Shield } from 'lucide-react';
import { Person } from '@/types/organization';
import { useTeams } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';

export const PersonTeamsTab: React.FC<{
  person: Person;
  onAssignTeam?: (teamId: string, teamName: string) => void;
}> = ({ person, onAssignTeam }) => {
  const { data: teams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState(person.team_id || 'team-01');

  const handleSelect = (team: any) => {
    setSelectedTeam(team.id);
    if (onAssignTeam) {
      onAssignTeam(team.id, team.name);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users2 className="w-4 h-4 text-indigo-400" />
            Squad & Strike Pod Allocations
          </h3>
          <p className="text-xs text-slate-400">
            Teams represent sprint pods and sequence strike forces working on active deliverables.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(teams || []).map((team) => {
          const isCurrent = team.id === selectedTeam;
          return (
            <div
              key={team.id}
              onClick={() => handleSelect(team)}
              className={`rounded-xl border p-4 cursor-pointer transition-all ${
                isCurrent
                  ? 'border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-500/50'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">{team.name}</h4>
                    <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                      {team.code}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">Lead: {team.lead_name}</span>
                </div>
                {isCurrent && (
                  <Badge variant="primary" className="text-[10px] font-mono flex items-center gap-1">
                    <Check className="w-3 h-3" /> Squad Member
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-2">Discipline: {team.focus_discipline}</p>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Dept: {team.department_name}</span>
                <span className="font-mono text-indigo-300">Show: {team.current_project_code}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
