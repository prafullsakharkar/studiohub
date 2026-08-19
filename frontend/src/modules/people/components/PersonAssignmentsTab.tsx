import React from 'react';
import { CheckSquare, Clock, Calendar, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { Person } from '@/types/organization';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';

export const PersonAssignmentsTab: React.FC<{ person: Person }> = ({ person }) => {
  const { data: tasksData } = useTasks();
  const allTasks = tasksData?.results || [];

  // Filter tasks assigned to this person or mock related
  const personTasks = allTasks.filter(
    (t) => t.assignee_name?.toLowerCase().includes(person.full_name.toLowerCase()) || t.department === person.department_name
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            Active Tasks & Shot Assignments
          </h3>
          <p className="text-xs text-slate-400">
            Work queue, in-progress shots, simulation caches, and asset deliverables assigned to {person.full_name}.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
            <tr>
              <th className="py-3 px-4">Task Code / Entity</th>
              <th className="py-3 px-4">Discipline</th>
              <th className="py-3 px-4">Show</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Logged / Est</th>
              <th className="py-3 px-4">Due Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {personTasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{task.title}</span>
                    <span className="text-[10px] font-mono text-indigo-300 bg-slate-800 px-1 py-0.5 rounded">
                      {task.code}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{task.entity_code}</span>
                </td>
                <td className="py-3 px-4">{task.department}</td>
                <td className="py-3 px-4 font-mono font-bold text-indigo-300">{task.project_code}</td>
                <td className="py-3 px-4">
                  <StatusBadge status={task.status} />
                </td>
                <td className="py-3 px-4">
                  <PriorityBadge priority={task.priority} />
                </td>
                <td className="py-3 px-4 font-mono text-slate-300">
                  <span className="text-emerald-400 font-bold">{task.logged_hours}h</span> / {task.estimated_hours}h
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">{task.due_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
