import React from 'react';
import { Film, ArrowUpRight, Plus, Check } from 'lucide-react';
import { Office } from '@/types/organization';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { useWorkspaceStore } from '@/core/workspace/useWorkspaceStore';
import { useNavigate } from 'react-router-dom';

export const OfficeProjectsTab: React.FC<{
    office: Office;
    onAssignProject?: (projectCode: string) => void;
    onRemoveProject?: (projectCode: string) => void;
}> = ({ office, onAssignProject, onRemoveProject }) => {
    const { data: projectsData } = useProjects();
    const { openTab } = useWorkspaceStore();
    const navigate = useNavigate();

    const assigned = office.assigned_projects || [];
    const allProjects = projectsData?.results || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Film className="w-4 h-4 text-indigo-400" />
                        Active Production Shows Hosted at {office.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                        Shows with render pipelines, review rooms, or crew stationed at this facility.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allProjects.map((proj) => {
                    const isAssigned = assigned.includes(proj.code);
                    return (
                        <div
                            key={proj.id}
                            className={`rounded-xl border p-4 transition-all flex flex-col justify-between ${isAssigned
                                ? 'border-indigo-500/60 bg-slate-900/90 shadow-sm'
                                : 'border-slate-800 bg-slate-950/40 opacity-75'
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
                                    <Badge variant={isAssigned ? 'success' : 'outline'} className="text-[10px] font-mono">
                                        {isAssigned ? 'Hosted' : 'Not Hosted'}
                                    </Badge>
                                </div>
                                <p className="text-xs text-slate-400 mt-2 line-clamp-2">{proj.description}</p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {isAssigned ? (
                                        <Button
                                            size="xs"
                                            variant="danger"
                                            onClick={() => onRemoveProject && onRemoveProject(proj.code)}
                                            className="text-[11px]"
                                        >
                                            Remove Hosting
                                        </Button>
                                    ) : (
                                        <Button
                                            size="xs"
                                            variant="primary"
                                            onClick={() => onAssignProject && onAssignProject(proj.code)}
                                            leftIcon={<Plus className="w-3 h-3" />}
                                            className="text-[11px]"
                                        >
                                            Assign Show
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
