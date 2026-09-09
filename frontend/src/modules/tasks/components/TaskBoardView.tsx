import React from 'react';
import { Link } from 'react-router-dom';
import { Task } from '@/types/tasks';
import { ProductionStatus, PriorityLevel } from '@/types/common';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  Play,
  Pause,
  Clock,
  User,
  Film,
  Box,
  Layers,
  ArrowRight,
  ArrowLeft,
  Calendar,
  AlertCircle,
} from 'lucide-react';

interface TaskBoardViewProps {
  tasks: Task[];
  onUpdateTask: (id: string, data: Partial<Task>) => Promise<any>;
  onOpenLogHours?: (task: Task) => void;
}

const LANES: { status: ProductionStatus; title: string; color: string; border: string }[] = [
  { status: 'Not Started', title: 'Not Started', color: 'bg-slate-500/10 text-slate-400', border: 'border-slate-700' },
  { status: 'In Progress', title: 'In Progress', color: 'bg-indigo-500/10 text-indigo-400', border: 'border-indigo-500/30' },
  { status: 'Pending Review', title: 'Pending Review', color: 'bg-amber-500/10 text-amber-400', border: 'border-amber-500/30' },
  { status: 'Approved', title: 'Approved', color: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/30' },
  { status: 'Retake', title: 'Retake', color: 'bg-rose-500/10 text-rose-400', border: 'border-rose-500/30' },
  { status: 'On Hold', title: 'On Hold', color: 'bg-purple-500/10 text-purple-400', border: 'border-purple-500/30' },
];

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({
  tasks,
  onUpdateTask,
  onOpenLogHours,
}) => {
  const { isRunning, activeTaskId, startTimer, pauseTimer } = useTimerStore();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const getNextStatus = (current: ProductionStatus): ProductionStatus => {
    switch (current) {
      case 'Not Started':
        return 'In Progress';
      case 'In Progress':
        return 'Pending Review';
      case 'Pending Review':
        return 'Approved';
      default:
        return 'In Progress';
    }
  };

  const getPrevStatus = (current: ProductionStatus): ProductionStatus => {
    switch (current) {
      case 'Approved':
        return 'Pending Review';
      case 'Pending Review':
        return 'In Progress';
      case 'In Progress':
        return 'Not Started';
      case 'Retake':
        return 'In Progress';
      default:
        return 'Not Started';
    }
  };

  return (
    <div className="flex gap-4 items-start overflow-x-auto pb-4 custom-scrollbar min-w-0">
      {LANES.map((lane) => {
        const laneTasks = tasks.filter((t) => t.status === lane.status);

        return (
          <div
            key={lane.status}
            className={`rounded-xl border ${lane.border} bg-slate-900/60 flex flex-col w-[280px] shrink-0 min-w-[280px] max-h-[calc(100vh-280px)] shadow-lg`}
          >
            {/* Lane Header */}
            <div className="p-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 rounded-t-xl shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-slate-200">{lane.title}</span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold border border-slate-700">
                  {laneTasks.length}
                </span>
              </div>
            </div>

            {/* Lane Task Cards Container */}
            <div className="p-2.5 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
              {laneTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 italic">No tasks</div>
              ) : (
                laneTasks.map((task) => {
                  const isTaskTimerActive = activeTaskId === task.id;
                  const estimated = task.schedule?.estimated_hours || task.estimated_hours || 24;
                  const logged = task.schedule?.logged_hours || task.logged_hours || 0;
                  const isOverdue =
                    new Date(task.schedule?.due_date || task.due_date || '').getTime() < Date.now() &&
                    task.status !== 'Approved';

                  return (
                    <div
                      key={task.id}
                      className="group bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-lg p-3.5 shadow-sm transition-all flex flex-col gap-2.5 min-w-0"
                    >
                      {/* Top Code & Priority */}
                      <div className="flex items-center justify-between gap-1.5 min-w-0">
                        <Link
                          to={`/tasks/${task.id}`}
                          className="font-mono text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline truncate"
                        >
                          {task.code}
                        </Link>
                        <div className="shrink-0">
                          <PriorityBadge priority={task.priority} />
                        </div>
                      </div>

                      {/* Title */}
                      <Link
                        to={`/tasks/${task.id}`}
                        className="font-medium text-xs text-slate-100 hover:text-indigo-300 transition-colors line-clamp-2"
                        title={task.title}
                      >
                        {task.title}
                      </Link>

                      {/* Entity badge & department */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] min-w-0">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700/80 min-w-0 max-w-full">
                          {task.entity_type === 'Shot' ? (
                            <Film className="w-3 h-3 text-cyan-400 shrink-0" />
                          ) : task.entity_type === 'Asset' ? (
                            <Box className="w-3 h-3 text-amber-400 shrink-0" />
                          ) : (
                            <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate max-w-[120px]">{task.entity_code}</span>
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-400 border border-slate-800 shrink-0">
                          {task.department.split(' ')[0]}
                        </span>
                      </div>

                      {/* Footer: Assignee & Hours / Due */}
                      <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400 gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0" title={task.assignee_name || 'Unassigned'}>
                          {task.assignee_avatar ? (
                            <img
                              src={task.assignee_avatar}
                              alt={task.assignee_name}
                              className="w-5 h-5 rounded-full object-cover border border-slate-600 shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-[10px] shrink-0">
                              <User className="w-3 h-3" />
                            </div>
                          )}
                          <span className="truncate max-w-[80px] text-[11px] text-slate-300">
                            {task.assignee_name ? task.assignee_name.split(' ')[0] : 'Unassigned'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] font-mono shrink-0">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>
                            {logged}h / {estimated}h
                          </span>
                        </div>
                      </div>

                      {/* Due Date Indicator */}
                      <div className="flex items-center justify-between text-[11px] pt-1 gap-2 min-w-0">
                        <div
                          className={`flex items-center gap-1 font-mono text-[10px] truncate min-w-0 ${
                            isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-400'
                          }`}
                        >
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span className="truncate">{task.schedule?.due_date || task.due_date || 'No Date'}</span>
                          {isOverdue && <AlertCircle className="w-3 h-3 text-rose-400 ml-0.5 shrink-0" />}
                        </div>

                        {/* Quick Action Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Timer */}
                          {isTaskTimerActive && isRunning ? (
                            <button
                              onClick={pauseTimer}
                              className="p-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40"
                              title="Pause timer"
                            >
                              <Pause className="w-3 h-3" />
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
                                  message: `Tracking time for ${task.code}`,
                                });
                              }}
                              className="p-1 rounded bg-slate-900 text-slate-400 hover:text-emerald-400 border border-slate-700"
                              title="Start timer"
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          )}

                          {/* Move Prev / Next Lane arrows */}
                          {lane.status !== 'Not Started' && (
                            <button
                              onClick={() =>
                                onUpdateTask(task.id, { status: getPrevStatus(task.status) })
                              }
                              className="p-1 rounded bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700"
                              title={`Move to ${getPrevStatus(task.status)}`}
                            >
                              <ArrowLeft className="w-3 h-3" />
                            </button>
                          )}

                          {lane.status !== 'Approved' && (
                            <button
                              onClick={() =>
                                onUpdateTask(task.id, { status: getNextStatus(task.status) })
                              }
                              className="p-1 rounded bg-slate-900 text-slate-400 hover:text-indigo-300 border border-slate-700"
                              title={`Move to ${getNextStatus(task.status)}`}
                            >
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
