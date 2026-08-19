import React from 'react';
import { Users2, ArrowRight, Shield, Plus } from 'lucide-react';
import { DepartmentEntity } from '@/types/organization';
import { useTeams } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const DeptTeamsTab: React.FC<{ dept: DepartmentEntity }> = ({ dept }) => {
  const { data: teams } = useTeams();
  const deptTeams = (teams || []).filter((t) => t.department_id === dept.id || t.department_name === dept.name);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Users2 className="w-4 h-4 text-indigo-400" />
            Specialized Strike Squads & Sub-Teams
          </h3>
          <p className="text-xs text-slate-400">
            Strike pods operating under {dept.name} discipline.
          </p>
        </div>

        <Link to="/teams/new">
          <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Create Team Squad
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {deptTeams.length === 0 ? (
          <div className="col-span-2 p-8 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            No dedicated squads registered under this department yet.
          </div>
        ) : (
          deptTeams.map((team) => (
            <div
              key={team.id}
              className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3 hover:border-slate-700 transition-colors"
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
                <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                  {team.member_count} members
                </Badge>
              </div>

              <div className="text-xs text-slate-400">
                <span>Discipline: </span>
                <span className="text-slate-200">{team.focus_discipline}</span>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-400">Project: {team.current_project_code}</span>
                <Link to={`/teams/${team.id}`}>
                  <Button size="xs" variant="ghost" rightIcon={<ArrowRight className="w-3 h-3" />}>
                    View Squad
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
