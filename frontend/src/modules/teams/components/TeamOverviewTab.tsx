import React from 'react';
import { Users, Target, Cpu, Film, ShieldCheck } from 'lucide-react';
import { Team } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const TeamOverviewTab: React.FC<{ team: Team }> = ({ team }) => {
    return (
        <div className="space-y-6">
            {/* Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center font-mono font-bold text-xl text-white shadow-md ring-2 ring-indigo-500/30 bg-indigo-600">
                        {team.code}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-white">{team.name}</h2>
                            <Badge variant="outline" className="font-mono text-[10px] text-indigo-300">
                                {team.code}
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 max-w-xl">
                            Specialized strike squad under {team.department_name} focused on {team.focus_discipline}.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                    <div className="text-center px-3 border-r border-slate-800">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Squad Size</span>
                        <span className="text-lg font-bold font-mono text-indigo-400">{team.member_count}</span>
                    </div>
                    <div className="text-center px-3 border-r border-slate-800">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Active Show</span>
                        <span className="text-lg font-bold font-mono text-emerald-400">{team.current_project_code}</span>
                    </div>
                    <div className="text-center px-3">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Utilization</span>
                        <span className="text-lg font-bold font-mono text-amber-400">{team.capacity_utilization || 78}%</span>
                    </div>
                </div>
            </div>

            {/* Grid of Key Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Squad Lead */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                    <h3 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> Squad Leadership
                    </h3>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
                        <img
                            src={team.lead_avatar}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover ring-1 ring-slate-700"
                        />
                        <div>
                            <span className="font-bold text-sm text-white block">{team.lead_name}</span>
                            <span className="text-xs text-slate-400 font-mono">Team Lead / Squad Captain</span>
                        </div>
                    </div>

                    <div className="divide-y divide-slate-800/80 text-xs pt-1">
                        <div className="py-2 flex items-center justify-between">
                            <span className="text-slate-400">Squad Identifier</span>
                            <span className="font-mono text-white">{team.id}</span>
                        </div>
                        <div className="py-2 flex items-center justify-between">
                            <span className="text-slate-400">Parent Department</span>
                            <span className="text-indigo-300 font-mono">{team.department_name}</span>
                        </div>
                    </div>
                </div>

                {/* Focus Discipline */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                    <h3 className="text-xs font-bold font-mono uppercase text-indigo-300 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" /> Focus Discipline & Scope
                    </h3>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200">
                            {team.focus_discipline}
                        </span>
                    </div>

                    <div className="pt-3 border-t border-slate-800 space-y-2">
                        <span className="text-[10px] uppercase font-mono text-slate-500 block">Assigned Active Shows</span>
                        <div className="flex flex-wrap gap-1.5">
                            {(team.assigned_projects || [team.current_project_code]).map((proj) => (
                                <span
                                    key={proj}
                                    className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-950/60 border border-indigo-500/40 text-indigo-300"
                                >
                                    {proj}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
