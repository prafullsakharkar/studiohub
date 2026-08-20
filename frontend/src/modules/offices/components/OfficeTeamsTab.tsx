import React from 'react';
import { Users2, ExternalLink, Plus } from 'lucide-react';
import { Office } from '@/types/organization';
import { useTeams } from '@/modules/organization/hooks/useOrganizationData';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const OfficeTeamsTab: React.FC<{ office: Office }> = ({ office }) => {
    const { data: teams } = useTeams();
    const teamList = teams || [];

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users2 className="w-4 h-4 text-indigo-400" />
                        Squads Operating from {office.name}
                    </h3>
                    <p className="text-xs text-slate-400">
                        Specialized strike squads based at this facility node.
                    </p>
                </div>

                <Link to="/teams/new">
                    <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                        Add Squad
                    </Button>
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamList.length === 0 ? (
                    <div className="col-span-3 p-8 text-center rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
                        No squads registered at this facility yet.
                    </div>
                ) : (
                    teamList.map((team) => (
                        <div
                            key={team.id}
                            className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3 hover:border-slate-700 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm text-white bg-indigo-600">
                                    {team.code}
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-white">{team.name}</h4>
                                    <p className="text-xs text-slate-400">{team.focus_discipline}</p>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                                <Badge variant="outline" className="text-[10px] font-mono text-indigo-300">
                                    {team.member_count} Members
                                </Badge>
                                <Link to={`/teams/${team.id}`}>
                                    <Button size="xs" variant="outline" rightIcon={<ExternalLink className="w-3 h-3" />}>
                                        Open
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
