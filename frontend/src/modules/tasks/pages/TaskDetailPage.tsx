import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTask, useTaskMutations } from '../hooks/useTasks';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { useTimerStore } from '@/shared/stores/useTimerStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { TimelogCreateModal } from '../components/TimelogCreateModal';
import { useTimelogMutations } from '../hooks/useTimelogs';

import { TaskOverviewTab } from '../components/workspace/TaskOverviewTab';
import { TaskDetailsTab } from '../components/workspace/TaskDetailsTab';
import { TaskAssignmentTab } from '../components/workspace/TaskAssignmentTab';
import { TaskScheduleTab } from '../components/workspace/TaskScheduleTab';
import { TaskTimelogsTab } from '../components/workspace/TaskTimelogsTab';
import { TaskDependenciesTab } from '../components/workspace/TaskDependenciesTab';
import { TaskActivityTab } from '../components/workspace/TaskActivityTab';

import {
  ChevronRight,
  ArrowLeft,
  Clock,
  Play,
  Pause,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Archive,
  Trash2,
  Film,
  Box,
  Layers,
  Building,
  User,
  Users,
  Settings2,
  GitBranch,
  History,
  FileText,
} from 'lucide-react';

type WorkspaceTab =
  | 'overview'
  | 'details'
  | 'assignment'
  | 'schedule'
  | 'timelogs'
  | 'dependencies'
  | 'activity';

export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addActivity = useActivityStore((state) => state.addActivity);

  const { data: task, isLoading, error } = useTask(taskId);
  const { updateTask, deleteTask } = useTaskMutations();
  const { createTimelog } = useTimelogMutations();

  const { isRunning, activeTaskId, startTimer, pauseTimer } = useTimerStore();

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');
  const [isLogHoursModalOpen, setIsLogHoursModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading task workspace...</span>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="p-8 text-center bg-slate-900/60 rounded-xl border border-slate-800 my-8 max-w-lg mx-auto">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-100">Task Not Found</h3>
        <p className="text-sm text-slate-400 mt-1 mb-6">
          The requested production task does not exist or has been removed.
        </p>
        <Button variant="primary" onClick={() => navigate('/tasks')} leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Back to Tasks Board
        </Button>
      </div>
    );
  }

  const isTimerActive = activeTaskId === task.id;

  const handleUpdate = async (data: any) => {
    await updateTask.mutateAsync({ id: task.id, data });
  };

  const handleArchiveToggle = async () => {
    const nextArchived = !task.is_archived;
    await updateTask.mutateAsync({ id: task.id, data: { is_archived: nextArchived } });
    addNotification({
      type: 'info',
      title: nextArchived ? 'Task Archived' : 'Task Restored',
      message: `${task.code} status updated.`,
    });
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete task ${task.code}?`)) return;
    setIsDeleting(true);
    try {
      await deleteTask.mutateAsync(task.id);
      addActivity({
        actor: {
          id: user?.id || 'usr-001',
          name: user?.full_name || 'Alex Chen',
          email: user?.email || 'supervisor@studiohub.vfx',
          role: user?.role || 'VFX Supervisor',
        },
        action: 'delete',
        actionLabel: 'Task Deleted',
        entity: {
          type: 'task',
          id: task.id,
          code: task.code,
          name: task.title,
        },
        description: `Deleted task ${task.code} (${task.title})`,
      });
      addNotification({
        type: 'success',
        title: 'Task Deleted',
        message: `Task ${task.code} permanently removed.`,
      });
      navigate('/tasks');
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: err.message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const tabs: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Layers className="w-4 h-4" /> },
    { id: 'details', label: 'Details', icon: <FileText className="w-4 h-4" /> },
    { id: 'assignment', label: 'Assignment', icon: <Users className="w-4 h-4" /> },
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
    { id: 'timelogs', label: 'Timelogs', icon: <Clock className="w-4 h-4" /> },
    { id: 'dependencies', label: 'Dependencies', icon: <GitBranch className="w-4 h-4" /> },
    { id: 'activity', label: 'Activity', icon: <History className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Link to="/tasks" className="hover:text-slate-200 transition-colors flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Tasks</span>
          </Link>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-slate-300 font-semibold">{task.project_code}</span>
          <ChevronRight className="w-3 h-3 text-slate-600" />
          <span className="text-indigo-400 font-bold">{task.code}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Timer button */}
          {isTimerActive && isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={pauseTimer}
              leftIcon={<Pause className="w-4 h-4 text-amber-400" />}
            >
              Pause Timer
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
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
              leftIcon={<Play className="w-4 h-4 text-emerald-400" />}
            >
              Start Timer
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLogHoursModalOpen(true)}
            leftIcon={<Clock className="w-4 h-4" />}
          >
            Log Hours
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleArchiveToggle}
            leftIcon={<Archive className="w-4 h-4 text-amber-400" />}
          >
            {task.is_archived ? 'Restore' : 'Archive'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            leftIcon={<Trash2 className="w-4 h-4 text-rose-400" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Task Header Hero Card */}
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800 p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-indigo-400 px-2.5 py-0.5 rounded-md bg-indigo-950/60 border border-indigo-800/60">
                {task.code}
              </span>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                {task.department}
              </span>
              {task.is_archived && (
                <span className="text-xs px-2 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-800/60">
                  Archived
                </span>
              )}
            </div>

            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{task.title}</h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-mono pt-1">
              <div className="flex items-center gap-1.5 text-slate-300">
                {task.entity_type === 'Shot' ? (
                  <Film className="w-3.5 h-3.5 text-cyan-400" />
                ) : task.entity_type === 'Asset' ? (
                  <Box className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Layers className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>
                  {task.entity_type}: {task.entity_code}
                </span>
              </div>
              <span>•</span>
              <span>Project: {task.project_code}</span>
              <span>•</span>
              <span>DCC: {task.software}</span>
            </div>
          </div>

          {/* Right Person / Time Summary Banner */}
          <div className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-3 pr-4 border-r border-slate-800">
              {task.assignee_avatar ? (
                <img
                  src={task.assignee_avatar}
                  alt={task.assignee_name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 border border-slate-700 shrink-0">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="text-[11px] text-slate-500 block">Lead Assignee</span>
                <span className="text-xs font-semibold text-slate-200">
                  {task.assignee_name || 'Unassigned'}
                </span>
                <span className="text-[10px] text-indigo-400 block">{task.team_name || 'Studio'}</span>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-[11px] text-slate-500 block">Due Date</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {task.schedule?.due_date || task.due_date || 'None'}
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                {task.schedule?.logged_hours || 0}h / {task.schedule?.estimated_hours || 24}h
              </span>
            </div>
          </div>
        </div>

        {/* Workspace Tab Bar */}
        <div className="flex items-center gap-1 border-t border-slate-800 mt-6 pt-3 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Active Tab Workspace View */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <TaskOverviewTab
            task={task}
            onUpdate={handleUpdate}
            onOpenLogModal={() => setIsLogHoursModalOpen(true)}
          />
        )}

        {activeTab === 'details' && (
          <TaskDetailsTab task={task} onUpdate={handleUpdate} />
        )}

        {activeTab === 'assignment' && (
          <TaskAssignmentTab task={task} onUpdate={handleUpdate} />
        )}

        {activeTab === 'schedule' && (
          <TaskScheduleTab task={task} onUpdate={handleUpdate} />
        )}

        {activeTab === 'timelogs' && (
          <TaskTimelogsTab task={task} />
        )}

        {activeTab === 'dependencies' && (
          <TaskDependenciesTab task={task} onUpdate={handleUpdate} />
        )}

        {activeTab === 'activity' && (
          <TaskActivityTab task={task} />
        )}
      </div>

      {/* Manual Timelog Modal */}
      {isLogHoursModalOpen && (
        <TimelogCreateModal
          isOpen={isLogHoursModalOpen}
          onClose={() => setIsLogHoursModalOpen(false)}
          onSubmit={(data) => createTimelog.mutateAsync(data)}
          task={task}
        />
      )}
    </div>
  );
};
