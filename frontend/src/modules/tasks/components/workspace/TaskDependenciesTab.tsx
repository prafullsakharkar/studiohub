import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Task } from '@/types/tasks';
import { useTasks } from '../../hooks/useTasks';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  GitMerge,
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface TaskDependenciesTabProps {
  task: Task;
  onUpdate: (data: Partial<Task>) => Promise<any>;
}

export const TaskDependenciesTab: React.FC<TaskDependenciesTabProps> = ({ task, onUpdate }) => {
  const { data: allTasksData } = useTasks({ project_id: task.project_id });
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [selectedUpstreamId, setSelectedUpstreamId] = useState('');
  const [selectedDownstreamId, setSelectedDownstreamId] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const allTasks = allTasksData?.results || [];
  const upstreamIds = task.dependencies?.upstream_task_ids || [];
  const downstreamIds = task.dependencies?.downstream_task_ids || [];

  const upstreamTasks = allTasks.filter((t) => upstreamIds.includes(t.id));
  const downstreamTasks = allTasks.filter((t) => downstreamIds.includes(t.id));

  const hasUncompletedUpstream = upstreamTasks.some((t) => t.status !== 'Approved');

  const handleAddUpstream = async () => {
    if (!selectedUpstreamId || upstreamIds.includes(selectedUpstreamId)) return;
    setIsAdding(true);
    try {
      const updatedUpstream = [...upstreamIds, selectedUpstreamId];
      await onUpdate({
        dependencies: {
          ...task.dependencies,
          upstream_task_ids: updatedUpstream,
          downstream_task_ids: downstreamIds,
        },
      });
      setSelectedUpstreamId('');
      addNotification({
        type: 'success',
        title: 'Upstream Dependency Added',
        message: 'Connected prerequisite task dependency.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveUpstream = async (id: string) => {
    const updatedUpstream = upstreamIds.filter((tid) => tid !== id);
    await onUpdate({
      dependencies: {
        ...task.dependencies,
        upstream_task_ids: updatedUpstream,
        downstream_task_ids: downstreamIds,
      },
    });
    addNotification({
      type: 'info',
      title: 'Dependency Removed',
      message: 'Unlinked upstream task constraint.',
    });
  };

  const handleAddDownstream = async () => {
    if (!selectedDownstreamId || downstreamIds.includes(selectedDownstreamId)) return;
    setIsAdding(true);
    try {
      const updatedDownstream = [...downstreamIds, selectedDownstreamId];
      await onUpdate({
        dependencies: {
          ...task.dependencies,
          upstream_task_ids: upstreamIds,
          downstream_task_ids: updatedDownstream,
        },
      });
      setSelectedDownstreamId('');
      addNotification({
        type: 'success',
        title: 'Downstream Dependency Added',
        message: 'Connected dependent downstream task.',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveDownstream = async (id: string) => {
    const updatedDownstream = downstreamIds.filter((tid) => tid !== id);
    await onUpdate({
      dependencies: {
        ...task.dependencies,
        upstream_task_ids: upstreamIds,
        downstream_task_ids: updatedDownstream,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Dependency Status Overview */}
      <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-xl border ${
              hasUncompletedUpstream
                ? 'bg-amber-950/30 border-amber-800/60 text-amber-400'
                : 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400'
            }`}
          >
            <GitMerge className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-100">
              {hasUncompletedUpstream ? 'Upstream Dependencies Incomplete' : 'All Prerequisite Tasks Cleared'}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {hasUncompletedUpstream
                ? 'One or more prerequisite upstream tasks are not yet Approved. Execution may be blocked.'
                : 'All upstream dependencies have passed approval review or none exist.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {upstreamTasks.length} Upstream
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
            {downstreamTasks.length} Downstream
          </span>
        </div>
      </div>

      {/* Two Column Grid: Upstream & Downstream */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upstream Tasks (Prerequisites) */}
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Upstream Prerequisites
              </h4>
            </div>
            <span className="text-xs text-slate-500 font-mono">Must complete first</span>
          </div>

          {/* Selector to add upstream */}
          <div className="flex gap-2">
            <select
              value={selectedUpstreamId}
              onChange={(e) => setSelectedUpstreamId(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select task to add as prerequisite...</option>
              {allTasks
                .filter((t) => t.id !== task.id && !upstreamIds.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} - {t.title} ({t.department})
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedUpstreamId || isAdding}
              onClick={handleAddUpstream}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add
            </Button>
          </div>

          {/* List of Upstream Tasks */}
          <div className="space-y-2">
            {upstreamTasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                No upstream prerequisites defined.
              </p>
            ) : (
              upstreamTasks.map((up) => (
                <div
                  key={up.id}
                  className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/tasks/${up.id}`}
                        className="font-mono text-xs font-bold text-indigo-400 hover:underline"
                      >
                        {up.code}
                      </Link>
                      <StatusBadge status={up.status} />
                    </div>
                    <p className="text-xs text-slate-200 truncate mt-0.5">{up.title}</p>
                    <span className="text-[10px] text-slate-400">{up.department}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/tasks/${up.id}`}
                      className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700"
                      title="Open Task"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => handleRemoveUpstream(up.id)}
                      className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-700"
                      title="Unlink"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Downstream Tasks (Dependents) */}
        <div className="bg-slate-900/60 p-5 rounded-xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Downstream Dependents
              </h4>
            </div>
            <span className="text-xs text-slate-500 font-mono">Blocked by this task</span>
          </div>

          {/* Selector to add downstream */}
          <div className="flex gap-2">
            <select
              value={selectedDownstreamId}
              onChange={(e) => setSelectedDownstreamId(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="">Select dependent downstream task...</option>
              {allTasks
                .filter((t) => t.id !== task.id && !downstreamIds.includes(t.id))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.code} - {t.title} ({t.department})
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              variant="outline"
              disabled={!selectedDownstreamId || isAdding}
              onClick={handleAddDownstream}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add
            </Button>
          </div>

          {/* List of Downstream Tasks */}
          <div className="space-y-2">
            {downstreamTasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center">
                No downstream tasks waiting on this deliverable.
              </p>
            ) : (
              downstreamTasks.map((down) => (
                <div
                  key={down.id}
                  className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 flex items-center justify-between gap-3 group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/tasks/${down.id}`}
                        className="font-mono text-xs font-bold text-indigo-400 hover:underline"
                      >
                        {down.code}
                      </Link>
                      <StatusBadge status={down.status} />
                    </div>
                    <p className="text-xs text-slate-200 truncate mt-0.5">{down.title}</p>
                    <span className="text-[10px] text-slate-400">{down.department}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/tasks/${down.id}`}
                      className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-700"
                      title="Open Task"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => handleRemoveDownstream(down.id)}
                      className="p-1.5 rounded bg-slate-900 text-slate-400 hover:text-rose-400 border border-slate-700"
                      title="Unlink"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
