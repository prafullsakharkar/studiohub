import React, { useState } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useTaskMutations } from '../hooks/useTaskMutations';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Modal } from '@/shared/components/Modal';
import { Can } from '@/core/permissions/Can';
import {
  CheckSquare,
  Plus,
  Clock,
  LayoutGrid,
  ListFilter,
  User,
  Film,
  Box,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Task } from '@/mocks/db/tasks/tasks';
import { Department, PriorityLevel, ProductionStatus } from '@/types/common';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const TasksPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLogHoursOpen, setIsLogHoursOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [hoursToAdd, setHoursToAdd] = useState(2);

  const openInspector = useInspectorStore((state) => state.openInspector);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: projectsData } = useProjects();
  const { data, isLoading } = useTasks({
    search: search || undefined,
    department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
    priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
    project_id: projectFilter !== 'ALL' ? projectFilter : undefined,
  });

  const { createTask, updateTask, isCreating } = useTaskMutations();

  const [formData, setFormData] = useState({
    title: '',
    code: '',
    entity_type: 'Shot' as const,
    entity_code: 'NK_010_010',
    department: 'FX & Simulation' as Department,
    priority: 'High' as PriorityLevel,
    assignee_name: 'Elena Rostova',
    due_date: '2026-08-30',
    estimated_hours: 40,
    software: 'Houdini 20.5',
    description: '',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask({
      ...formData,
      project_id: projectsData?.results[0]?.id || 'proj-001',
      project_code: projectsData?.results[0]?.code || 'NK99',
      status: 'Not Started',
      entity_id: 'shot-001',
      logged_hours: 0,
      assignee_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    } as Partial<Task>);
    setIsCreateOpen(false);
  };

  const handleLogHours = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;
    const newLogged = (selectedTask.logged_hours || 0) + Number(hoursToAdd);
    await updateTask({
      id: selectedTask.id,
      data: {
        logged_hours: newLogged,
      },
    });
    addNotification({
      type: 'success',
      title: 'Production Hours Logged',
      message: `${hoursToAdd}h added to ${selectedTask.code} (Total: ${newLogged}h)`,
    });
    setIsLogHoursOpen(false);
    setSelectedTask(null);
  };

  const handleAdvanceStatus = async (task: Task) => {
    const nextStatus: Record<ProductionStatus, ProductionStatus> = {
      'Not Started': 'In Progress',
      'In Progress': 'Pending Review',
      'Pending Review': 'Approved',
      'Approved': 'Approved',
      'Retake': 'In Progress',
      'On Hold': 'In Progress',
      'Omitted': 'Not Started',
    };
    const target = nextStatus[task.status] || 'In Progress';
    await updateTask({
      id: task.id,
      data: { status: target },
    });
    addNotification({
      type: 'info',
      title: 'Task Status Updated',
      message: `${task.code} advanced to ${target}`,
    });
  };

  const tasks = data?.results || [];

  const columns: ProductionStatus[] = ['Not Started', 'In Progress', 'Pending Review', 'Approved'];
  const departments = ['ALL', 'Layout', 'Modeling', 'Rigging', 'Animation', 'FX & Simulation', 'Lighting & LookDev', 'Compositing'];

  return (
    <div className="space-y-4 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Discipline Task Board & Timesheets
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-800 text-indigo-300 rounded border border-slate-700">
                {tasks.length} Active Tasks
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Department task handoffs, timesheets, and artist milestone tracking
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Matrix</span>
            </button>
          </div>

          <Can permission="tasks:create">
            <Button
              id="create-task-btn"
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Create Task
            </Button>
          </Can>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <SearchInput
            className="w-full sm:w-72"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            placeholder="Search task title, code, artist..."
          />

          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Shows</option>
            {projectsData?.results.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Department tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto w-full md:w-auto">
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setDepartmentFilter(dept)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                departmentFilter === dept
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Syncing production task queue..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-8 h-8 text-indigo-400" />}
          title="No Tasks Assigned"
          description="There are no active production tasks matching your criteria."
          actionLabel="Create Task"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'kanban' ? (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 items-start">
          {columns.map((colStatus) => {
            const colTasks = tasks.filter((t) => t.status === colStatus);
            return (
              <div
                key={colStatus}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-2.5 min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-800">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                      {colStatus}
                    </span>
                    <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-slate-800 text-slate-300 font-mono">
                      {colTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2.5 flex-1">
                  {colTasks.map((task) => (
                    <Card
                      key={task.id}
                      onClick={() => openInspector('task', task)}
                      className="bg-slate-900 border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer group shadow-sm"
                    >
                      <CardBody className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold text-indigo-400 group-hover:text-indigo-300">
                            {task.code}
                          </span>
                          <PriorityBadge priority={task.priority} />
                        </div>

                        <h4 className="text-xs font-bold text-white leading-snug">
                          {task.title}
                        </h4>

                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                          {task.entity_type === 'Shot' ? (
                            <Film className="w-3 h-3 text-indigo-400" />
                          ) : (
                            <Box className="w-3 h-3 text-emerald-400" />
                          )}
                          <span className="font-bold text-slate-300">{task.entity_code}</span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400 truncate">{task.department}</span>
                        </div>

                        {/* Progress hours bar */}
                        <div className="space-y-1 pt-1.5 border-t border-slate-800/80">
                          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                            <span>Logged: {task.logged_hours}h / {task.estimated_hours}h</span>
                            <span>{Math.round((task.logged_hours / (task.estimated_hours || 1)) * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full ${
                                task.logged_hours > task.estimated_hours
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500'
                              }`}
                              style={{
                                width: `${Math.min(100, (task.logged_hours / (task.estimated_hours || 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-1.5 text-[10px] text-slate-400 border-t border-slate-800/60">
                          <div className="flex items-center space-x-1.5">
                            {task.assignee_avatar ? (
                              <img
                                src={task.assignee_avatar}
                                alt={task.assignee_name}
                                className="w-4 h-4 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[8px] text-white">
                                {task.assignee_name?.[0]}
                              </div>
                            )}
                            <span className="truncate max-w-[80px]">{task.assignee_name}</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTask(task);
                                setIsLogHoursOpen(true);
                              }}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300"
                              title="Log Work Hours"
                            >
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdvanceStatus(task);
                              }}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400"
                              title="Advance Status"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider select-none">
                  <th className="py-2.5 px-3">Code & Title</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3">Logged / Est</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => openInspector('task', task)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-indigo-400 font-bold block">{task.code}</span>
                      <span className="text-white font-medium">{task.title}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {task.entity_code} ({task.entity_type})
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">{task.department}</td>
                    <td className="py-2.5 px-3">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">
                      {task.assignee_name || 'Unassigned'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">
                      {task.logged_hours}h / {task.estimated_hours}h
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setIsLogHoursOpen(true);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px]"
                      >
                        Log Time
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Hours Modal */}
      <Modal
        isOpen={isLogHoursOpen}
        onClose={() => setIsLogHoursOpen(false)}
        title="Log Production Hours"
        description={`Task ${selectedTask?.code}: ${selectedTask?.title}`}
      >
        <form onSubmit={handleLogHours} className="space-y-3">
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Current Logged:</span>
              <strong className="text-white">{selectedTask?.logged_hours} hours</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Budget Estimate:</span>
              <strong className="text-white">{selectedTask?.estimated_hours} hours</strong>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Additional Hours Worked</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              value={hoursToAdd}
              onChange={(e) => setHoursToAdd(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsLogHoursOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Work Hours
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Production Task"
        description="Assign VFX shots or 3D asset work to department artists."
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Task Title</label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Volumetric Explosion & Shockwave Simulation"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Task Code</label>
              <input
                required
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="TSK-FX-1099"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value as Department })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Layout">Layout</option>
                <option value="Modeling">Modeling</option>
                <option value="Rigging">Rigging</option>
                <option value="Animation">Animation</option>
                <option value="FX & Simulation">FX & Simulation</option>
                <option value="Lighting & LookDev">Lighting & LookDev</option>
                <option value="Compositing">Compositing</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Entity Code</label>
              <input
                type="text"
                value={formData.entity_code}
                onChange={(e) => setFormData({ ...formData, entity_code: e.target.value.toUpperCase() })}
                placeholder="NK_010_010"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityLevel })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Assignee</label>
              <input
                type="text"
                value={formData.assignee_name}
                onChange={(e) => setFormData({ ...formData, assignee_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Estimated Hours</label>
              <input
                type="number"
                value={formData.estimated_hours}
                onChange={(e) => setFormData({ ...formData, estimated_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isCreating}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
