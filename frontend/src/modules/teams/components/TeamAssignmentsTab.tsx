import React, { useState } from 'react';
import { CheckSquare, ListChecks, ArrowRight, Check } from 'lucide-react';
import { TeamEntity } from '@/types/organization';
import { useTasks, useTaskMutations } from '@/modules/tasks/hooks/useTasks';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { usePeople } from '@/modules/organization/hooks/useOrganizationData';

export const TeamAssignmentsTab: React.FC<{ team: TeamEntity }> = ({ team }) => {
  const { data: tasksData } = useTasks();
  const { updateTask } = useTaskMutations();
  const { data: peopleData } = usePeople();
  const allTasks = tasksData?.results || [];
  const allPeople = peopleData?.results || [];

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [targetAssigneeId, setTargetAssigneeId] = useState('');

  // Filter tasks belonging to team project or department
  const teamTasks = allTasks.filter(
    (t) =>
      t.project_code === team.current_project_code ||
      t.department?.toLowerCase() === team.department_name?.toLowerCase() ||
      t.department?.toLowerCase() === team.focus_discipline?.toLowerCase()
  );

  const teamMembers = allPeople.filter(
    (p) => (team.member_ids || []).includes(p.id) || p.team_id === team.id
  );

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    if (selectedTaskIds.length === teamTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(teamTasks.map((t) => t.id));
    }
  };

  const handleBulkAssign = async () => {
    if (!targetAssigneeId || selectedTaskIds.length === 0) return;
    const assignee = allPeople.find((p) => p.id === targetAssigneeId);
    if (!assignee) return;

    for (const taskId of selectedTaskIds) {
      await updateTask.mutateAsync({
        id: taskId,
        data: {
          assignee_id: assignee.id,
          assignee_name: assignee.full_name,
        },
      });
    }

    setSelectedTaskIds([]);
    setTargetAssigneeId('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-400" />
            Squad Work Deliverables & Task Board
          </h3>
          <p className="text-xs text-slate-400">
            Work items queued for {team.name} on show {team.current_project_code}.
          </p>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedTaskIds.length > 0 && (
        <div className="bg-indigo-950/40 border border-indigo-500/30 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-300">
              {selectedTaskIds.length} tasks selected
            </span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={targetAssigneeId}
              onChange={(e) => setTargetAssigneeId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
            >
              <option value="">-- Reassign to Squad Artist --</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role})
                </option>
              ))}
            </select>

            <Button
              size="xs"
              variant="primary"
              onClick={handleBulkAssign}
              disabled={!targetAssigneeId}
              isLoading={updateTask.isPending}
            >
              Apply Bulk Assign
            </Button>
          </div>
        </div>
      )}

      {/* Task Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 border-b border-slate-800 font-mono text-[10px] uppercase text-slate-400">
            <tr>
              <th className="py-3 px-4 w-8">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.length === teamTasks.length && teamTasks.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
              </th>
              <th className="py-3 px-4">Task Deliverable</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Current Assignee</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Priority</th>
              <th className="py-3 px-4">Logged / Est</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-sans">
            {teamTasks.map((task) => {
              const isSelected = selectedTaskIds.includes(task.id);
              return (
                <tr
                  key={task.id}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isSelected ? 'bg-indigo-950/20' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(task.id)}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="py-3 px-4 font-bold text-white">
                    <span>{task.title}</span>
                    <span className="text-[10px] font-mono text-indigo-400 block">{task.code}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400">{task.entity_code}</td>
                  <td className="py-3 px-4 text-slate-200">{task.assignee_name}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
