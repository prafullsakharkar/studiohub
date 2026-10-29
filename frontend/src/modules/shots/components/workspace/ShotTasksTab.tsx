import { useTaskMutations } from '@/modules/tasks/hooks/useTasks';
import React, { useState } from 'react';
import { Shot } from '@/types/production';
import { Task } from '@/types/production';
import { ProductionStatus } from '@/types/common';
import {
  CheckSquare,
  Plus,
  Clock,
  User,
  Filter,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { SearchInput } from '@/shared/components/SearchInput';
import { PermissionButton } from '@/core/permissions/PermissionComponents';
import { Link } from 'react-router-dom';

export interface ShotTasksTabProps {
  shot: Shot;
  tasks: Task[];
  onOpenCreateTask: () => void;
}

export const ShotTasksTab: React.FC<ShotTasksTabProps> = ({
  shot,
  tasks,
  onOpenCreateTask,
}) => {
  const { updateTask } = useTaskMutations();
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredTasks = tasks.filter((task) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = (task.title || (task as any).name)?.toLowerCase().includes(q);
      const matchCode = task.code?.toLowerCase().includes(q);
      const matchAssignee = task.assignee_name?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchAssignee) return false;
    }
    if (departmentFilter !== 'ALL' && task.department !== departmentFilter) {
      return false;
    }
    if (statusFilter !== 'ALL' && task.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleQuickStatusChange = async (task: Task, newStatus: ProductionStatus) => {
    await updateTask.mutateAsync({
      id: task.id,
      data: { status: newStatus },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header filter bar */}
      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <SearchInput
            className="w-full sm:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search tasks, artist, code..."
          />

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Departments</option>
            <option value="Compositing">Compositing</option>
            <option value="Animation">Animation</option>
            <option value="Lighting">Lighting</option>
            <option value="FX">FX</option>
            <option value="Layout">Layout</option>
            <option value="Matte Painting">Matte Painting</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Ready for Review">Ready for Review</option>
            <option value="Approved">Approved</option>
            <option value="On Hold">On Hold</option>
          </select>
        </div>

        <PermissionButton
          variant="primary"
          size="sm"
          permission="task.create"
          onClick={onOpenCreateTask}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Add Step / Task
        </PermissionButton>
      </div>

      {/* Tasks Table / Cards */}
      {filteredTasks.length === 0 ? (
        <Card className="border-slate-800 bg-slate-900/50 p-12 text-center">
          <CheckSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Tasks Found for this Shot</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
            Tasks represent pipeline steps like layout, rotoscoping, lighting, and comp passes.
          </p>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={onOpenCreateTask}
            className="mx-auto"
          >
            Create First Task
          </Button>
        </Card>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-semibold">Task / Step</th>
                  <th className="py-3 px-4 font-semibold">Department</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Priority</th>
                  <th className="py-3 px-4 font-semibold">Assignee</th>
                  <th className="py-3 px-4 font-semibold">Bids / Est.</th>
                  <th className="py-3 px-4 font-semibold text-right">Quick Transition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <Link
                        to={`/tasks/${task.id}`}
                        className="font-bold text-white hover:text-indigo-300 transition-colors flex items-center gap-2"
                      >
                        <span>{task.title || (task as any).name}</span>
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                          {task.code}
                        </span>
                      </Link>
                      {task.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 max-w-md">
                          {task.description}
                        </p>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-300">
                      {task.department || 'Compositing'}
                    </td>

                    <td className="py-3 px-4">
                      <StatusBadge status={task.status} />
                    </td>

                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          task.priority === 'Critical'
                            ? 'destructive'
                            : task.priority === 'High'
                            ? 'warning'
                            : 'neutral'
                        }
                        className="text-[10px] uppercase font-mono"
                      >
                        {task.priority || 'Medium'}
                      </Badge>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-200">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>{task.assignee_name || 'Unassigned'}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400">
                      {task.estimated_hours ? `${task.estimated_hours}h` : '—'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <select
                        value={task.status}
                        onChange={(e) =>
                          handleQuickStatusChange(task, e.target.value as ProductionStatus)
                        }
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2 py-1 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Ready for Review">Ready for Review</option>
                        <option value="Approved">Approved</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
