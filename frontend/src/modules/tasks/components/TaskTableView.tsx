import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Task } from '@/types/tasks';
import { ProductionStatus, PriorityLevel, Department } from '@/types/common';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { mockUsers } from '@/mocks/db/identity/users';
import { mockTeams } from '@/mocks/db/organization/organization';
import {
  Play,
  Pause,
  Clock,
  User,
  Film,
  Box,
  Layers,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Edit2,
  Trash2,
  Archive,
  ArrowUpDown,
  Building,
} from 'lucide-react';

interface TaskTableViewProps {
  tasks: Task[];
  selectedTaskIds: string[];
  onToggleSelect: (taskId: string) => void;
  onSelectAll: (allIds: string[]) => void;
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<any>;
  onDeleteTask: (id: string) => Promise<any>;
  onOpenLogHours?: (task: Task) => void;
}

export const TaskTableView: React.FC<TaskTableViewProps> = ({
  tasks,
  selectedTaskIds,
  onToggleSelect,
  onSelectAll,
  onUpdateTask,
  onDeleteTask,
  onOpenLogHours,
}) => {
  const { isRunning, activeTaskId, startTimer, pauseTimer, resumeTimer } = useTimerStore();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const [sortField, setSortField] = useState<keyof Task>('code');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

  const handleSort = (field: keyof Task) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'due_date' || sortField === 'schedule') {
      valA = a.schedule?.due_date || a.due_date || '';
      valB = b.schedule?.due_date || b.due_date || '';
    }

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (typeof valA === 'string' && typeof valB === 'string') {
      return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
    return 0;
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg">
      <table className="w-full text-left text-sm text-slate-300 border-collapse">
        <thead className="bg-slate-900/90 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800 select-none">
          <tr>
            <th className="p-3 w-10 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => onSelectAll(allSelected ? [] : tasks.map((t) => t.id))}
                className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
              />
            </th>
            <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleSort('code')}>
              <div className="flex items-center gap-1.5">
                <span>Task Code & Title</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="p-3">Project / Entity</th>
            <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleSort('department')}>
              <div className="flex items-center gap-1.5">
                <span>Department</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleSort('status')}>
              <div className="flex items-center gap-1.5">
                <span>Status</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleSort('priority')}>
              <div className="flex items-center gap-1.5">
                <span>Priority</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="p-3">Assignee</th>
            <th className="p-3 cursor-pointer hover:text-slate-200" onClick={() => handleSort('due_date')}>
              <div className="flex items-center gap-1.5">
                <span>Due Date</span>
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
              </div>
            </th>
            <th className="p-3">Hours Progress</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60">
          {sortedTasks.map((task) => {
            const isSelected = selectedTaskIds.includes(task.id);
            const isTaskTimerActive = activeTaskId === task.id;
            const estimated = task.schedule?.estimated_hours || task.estimated_hours || 24;
            const logged = task.schedule?.logged_hours || task.logged_hours || 0;
            const progress = Math.min(100, Math.round((logged / estimated) * 100)) || 0;
            const isOverrun = logged > estimated;

            return (
              <tr
                key={task.id}
                className={`hover:bg-slate-800/40 transition-colors group ${
                  isSelected ? 'bg-indigo-950/20' : ''
                }`}
              >
                {/* Checkbox */}
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(task.id)}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                </td>

                {/* Code & Title */}
                <td className="p-3 max-w-xs">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/tasks/${task.id}`}
                      className="font-mono text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline shrink-0"
                    >
                      {task.code}
                    </Link>
                    {task.software && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60 truncate">
                        {task.software.split(' ')[0]}
                      </span>
                    )}
                  </div>
                  <Link
                    to={`/tasks/${task.id}`}
                    className="font-medium text-slate-100 hover:text-indigo-300 transition-colors text-sm line-clamp-1 mt-0.5 block"
                    title={task.title}
                  >
                    {task.title}
                  </Link>
                </td>

                {/* Project / Entity */}
                <td className="p-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-slate-300">{task.project_code}</span>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      {task.entity_type === 'Shot' ? (
                        <Film className="w-3 h-3 text-cyan-400 shrink-0" />
                      ) : task.entity_type === 'Asset' ? (
                        <Box className="w-3 h-3 text-amber-400 shrink-0" />
                      ) : (
                        <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">{task.entity_code}</span>
                    </div>
                  </div>
                </td>

                {/* Department */}
                <td className="p-3 text-xs">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                    {task.department}
                  </span>
                </td>

                {/* Status Dropdown */}
                <td className="p-3">
                  <select
                    value={task.status}
                    onChange={(e) =>
                      onUpdateTask(task.id, { status: e.target.value as ProductionStatus })
                    }
                    className="text-xs bg-slate-800/90 border border-slate-700 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Retake">Retake</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Omitted">Omitted</option>
                  </select>
                </td>

                {/* Priority Dropdown */}
                <td className="p-3">
                  <select
                    value={task.priority}
                    onChange={(e) =>
                      onUpdateTask(task.id, { priority: e.target.value as PriorityLevel })
                    }
                    className="text-xs bg-slate-800/90 border border-slate-700 rounded-md px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </td>

                {/* Assignee */}
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    {task.assignee_avatar ? (
                      <img
                        src={task.assignee_avatar}
                        alt={task.assignee_name}
                        className="w-6 h-6 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 text-xs border border-slate-700 shrink-0">
                        <User className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <span className="text-xs text-slate-200 truncate max-w-[120px]">
                      {task.assignee_name || 'Unassigned'}
                    </span>
                  </div>
                </td>

                {/* Due Date */}
                <td className="p-3 text-xs">
                  <span
                    className={`font-mono ${
                      new Date(task.schedule?.due_date || task.due_date || '').getTime() < Date.now() &&
                      task.status !== 'Approved'
                        ? 'text-rose-400 font-semibold'
                        : 'text-slate-300'
                    }`}
                  >
                    {task.schedule?.due_date || task.due_date || '—'}
                  </span>
                </td>

                {/* Hours Progress Bar */}
                <td className="p-3 min-w-[140px]">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className={`font-mono font-medium ${isOverrun ? 'text-rose-400' : 'text-slate-300'}`}>
                      {logged}h / {estimated}h
                    </span>
                    <span className="text-slate-400 font-mono">{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isOverrun
                          ? 'bg-rose-500'
                          : progress >= 100
                          ? 'bg-emerald-500'
                          : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </td>

                {/* Actions */}
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {/* Timer Trigger */}
                    {isTaskTimerActive && isRunning ? (
                      <button
                        onClick={pauseTimer}
                        className="p-1.5 rounded-md bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-colors"
                        title="Pause active timer"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          startTimer({
                            id: task.id,
                            code: task.code,
                            title: task.title,
                            project_id: task.project_id,
                            project_code: task.project_code,
                            project_name: task.project_name,
                            department: task.department,
                          });
                          addNotification({
                            type: 'info',
                            title: 'Timer Started',
                            message: `Tracking time for ${task.code} - ${task.title}`,
                          });
                        }}
                        className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-emerald-950/40 border border-slate-700/80 transition-colors"
                        title="Start timer for this task"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {onOpenLogHours && (
                      <button
                        onClick={() => onOpenLogHours(task)}
                        className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-indigo-300 hover:bg-slate-700 border border-slate-700/80 transition-colors"
                        title="Log hours manually"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <Link
                      to={`/tasks/${task.id}`}
                      className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 border border-slate-700/80 transition-colors"
                      title="Open Task Workspace"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
