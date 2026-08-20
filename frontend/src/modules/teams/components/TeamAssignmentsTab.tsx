import React from 'react';
import { ClipboardList, ExternalLink } from 'lucide-react';
import { Team } from '@/types/organization';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Link } from 'react-router-dom';

export const TeamAssignmentsTab: React.FC<{ team: Team }> = ({ team }) => {
    const { data: tasksData } = useTasks();
    const allTasks = tasksData?.results || [];

    const teamTasks = allTasks.filter(
        (t) =>
            t.department?.toLowerCase() === team.department_name.toLowerCase() ||
            t.department?.toLowerCase() === team.focus_discipline.toLowerCase()
    );

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-indigo-400" />
                        Squad Assignments & Task Queue
                    </h3>
                    <p className="text-xs text-slate-400">
                        Current work deliverables and supervisor review backlog for {team.name}.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
                        <tr>
                            <th className="py-3 px-4">Task Code</th>
                            <th className="py-3 px-4">Entity</th>
                            <th className="py-3 px-4">Assignee</th>
                            <th className="py-3 px-4">Show</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Priority</th>
                            <th className="py-3 px-4">Hours (Act / Est)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                        {teamTasks.map((task) => (
                            <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-3 px-4 font-bold text-white">
                                    <span>{task.title}</span>
                                    <span className="text-[10px] font-mono text-indigo-400 block">{task.code}</span>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-400">{task.entity_code}</td>
                                <td className="py-3 px-4 text-slate-200">{task.assignee_name}</td>
                                <td className="py-3 px-4 font-mono text-indigo-300">{task.project_code}</td>
                                <td className="py-3 px-4">
                                    <StatusBadge status={task.status} />
                                </td>
                                <td className="py-3 px-4">
                                    <PriorityBadge priority={task.priority} />
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-300">
                                    <span className="text-emerald-400 font-bold">{task.logged_hours}h</span> / {task.estimated_hours}h
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-end">
                <Link to="/tasks">
                    <Button size="xs" variant="outline" rightIcon={<ExternalLink className="w-3 h-3" />}>
                        Open Full Task Board
                    </Button>
                </Link>
            </div>
        </div>
    );
};
