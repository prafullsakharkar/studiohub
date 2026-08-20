import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Team } from '@/types/organization';
import { Badge } from '@/shared/components/Badge';

export const TeamUtilizationTab: React.FC<{ team: Team }> = ({ team }) => {
    const weeks = [
        { week: 'Sprint W32', rate: 72, tasksCompleted: 18, hours: 118 },
        { week: 'Sprint W33', rate: 80, tasksCompleted: 24, hours: 132 },
        { week: 'Sprint W34', rate: 86, tasksCompleted: 29, hours: 148 },
        { week: 'Sprint W35 (Current)', rate: team.capacity_utilization || 78, tasksCompleted: 21, hours: 126 },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-indigo-400" />
                        Historical Utilization & Output Metrics
                    </h3>
                    <p className="text-xs text-slate-400">
                        Efficiency trends, task throughput, and burn rates over recent production sprints.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {weeks.map((w) => (
                    <div key={w.week} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white">{w.week}</span>
                            <Badge
                                variant={w.rate > 90 ? 'warning' : 'success'}
                                className="font-mono text-[10px]"
                            >
                                {w.rate}%
                            </Badge>
                        </div>
                        <div className="space-y-1 text-xs text-slate-400 font-mono">
                            <div className="flex justify-between">
                                <span>Completed:</span>
                                <span className="text-white">{w.tasksCompleted} tasks</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Logged:</span>
                                <span className="text-emerald-400">{w.hours} hrs</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
