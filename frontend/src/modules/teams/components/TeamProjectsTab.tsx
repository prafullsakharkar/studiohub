import React, { useState } from 'react';
import { Film, ArrowUpRight, Check, Plus } from 'lucide-react';
import { TeamEntity } from '@/types/organization';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { useTeamMutations } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { useNavigate } from 'react-router-dom';

export const TeamProjectsTab: React.FC<{ team: TeamEntity }> = ({ team }) => {
  const { data: projectsData } = useProjects();
  const { updateTeam } = useTeamMutations();
  const { openTab } = useWorkspaceStore();
  const navigate = useNavigate();

  const projects = projectsData?.results || [];
  const currentProjectCode = team.current_project_code;

  const handleAssignProject = (proj: any) => {
    updateTeam.mutate({
      id: team.id,
      data: {
        current_project_code: proj.code,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Film className="w-4 h-4 text-indigo-400" />
            Active Show Deployment
          </h3>
          <p className="text-xs text-slate-400">
            Current show allocation for {team.name}. Select a show to re-assign squad deliverables.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((proj) => {
          const isCurrent = proj.code === currentProjectCode;
          return (
            <div
              key={proj.id}
              className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${
                isCurrent
                  ? 'border-indigo-500 bg-slate-900 shadow-md'
                  : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-white">{proj.name}</h4>
                      <span className="text-[10px] font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded">
                        {proj.code}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">{proj.type} • {proj.client_name}</span>
                  </div>
                  <Badge variant={isCurrent ? 'success' : 'outline'} className="text-[10px] font-mono">
                    {isCurrent ? 'Active Show' : 'Standby'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2">{proj.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  {isCurrent ? (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> Assigned Current Show
                    </span>
                  ) : (
                    <Button
                      size="xs"
                      variant="primary"
                      onClick={() => handleAssignProject(proj)}
                      isLoading={updateTeam.isPending}
                      className="text-[11px]"
                    >
                      Assign Squad to Show
                    </Button>
                  )}
                </div>

                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    openTab(
                      {
                        id: proj.id,
                        title: proj.name,
                        type: 'project',
                        code: proj.code,
                      },
                      proj.name
                    );
                    navigate('/workspace');
                  }}
                  rightIcon={<ArrowUpRight className="w-3 h-3" />}
                  className="text-[11px]"
                >
                  Open Show
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
