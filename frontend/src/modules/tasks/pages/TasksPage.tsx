import React, { useState } from 'react';
import { useTasks, useTaskMutations } from '../hooks/useTasks';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { mockUsers } from '@/mocks/db/identity/users';
import { mockDepartments, mockTeams, mockVendors } from '@/mocks/db/organization/organization';
import { Task, TaskEntityType } from '@/types/tasks';
import { Department, PriorityLevel, ProductionStatus } from '@/types/common';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Can } from '@/core/permissions/Can';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { useAuth } from '@/modules/auth/hooks/useAuth';

import { TaskTableView } from '../components/TaskTableView';
import { TaskBoardView } from '../components/TaskBoardView';
import { TaskCalendarView } from '../components/TaskCalendarView';
import { TaskTimelineView } from '../components/TaskTimelineView';
import { TaskCreateModal } from '../components/TaskCreateModal';
import { TaskBulkOperationsBar } from '../components/TaskBulkOperationsBar';
import { TimelogCreateModal } from '../components/TimelogCreateModal';
import { useTimelogMutations } from '../hooks/useTimelogs';

import {
  CheckSquare,
  Plus,
  Clock,
  LayoutGrid,
  ListFilter,
  Calendar,
  GitBranch,
  Filter,
  Layers,
  Building,
  User,
  Users,
  Archive,
  Search,
} from 'lucide-react';

type TaskViewMode = 'table' | 'board' | 'calendar' | 'timeline';

export const TasksPage: React.FC = () => {
  const { user } = useAuth();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addActivity = useActivityStore((state) => state.addActivity);

  const [viewMode, setViewMode] = useState<TaskViewMode>('table');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState<boolean>(false);

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLogHoursModalOpen, setIsLogHoursModalOpen] = useState(false);
  const [selectedTaskForLog, setSelectedTaskForLog] = useState<Task | undefined>(undefined);

  const { data: projectsData } = useProjects();
  const {
    data: tasksData,
    isLoading,
    refetch,
  } = useTasks({
    search: search || undefined,
    project_id: projectFilter !== 'ALL' ? projectFilter : undefined,
    entity_type: entityTypeFilter !== 'ALL' ? entityTypeFilter : undefined,
    department: departmentFilter !== 'ALL' ? departmentFilter : undefined,
    team_id: teamFilter !== 'ALL' ? teamFilter : undefined,
    assignee_id: assigneeFilter !== 'ALL' ? assigneeFilter : undefined,
    vendor_id: vendorFilter !== 'ALL' ? vendorFilter : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    priority: priorityFilter !== 'ALL' ? priorityFilter : undefined,
    is_archived: showArchived ? 'true' : 'false',
  });

  const {
    createTask,
    updateTask,
    deleteTask,
    bulkAssign,
    bulkStatusUpdate,
    bulkArchive,
    bulkDelete,
  } = useTaskMutations();

  const { createTimelog } = useTimelogMutations();

  const tasks = tasksData?.results || [];

  const handleToggleSelect = (taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = (allIds: string[]) => {
    setSelectedTaskIds(allIds);
  };

  const handleCreateSubmit = async (data: Partial<Task>) => {
    const created = await createTask.mutateAsync(data);
    return created;
  };

  const handleUpdateTask = async (id: string, data: Partial<Task>) => {
    await updateTask.mutateAsync({ id, data });
  };

  const handleDeleteTask = async (id: string) => {
    if (!window.confirm('Delete this task?')) return;
    await deleteTask.mutateAsync(id);
    addNotification({
      type: 'success',
      title: 'Task Deleted',
      message: 'Task removed from project schedule.',
    });
  };

  const handleBulkAssign = async (payload: any) => {
    await bulkAssign.mutateAsync({
      task_ids: selectedTaskIds,
      ...payload,
    });
    addNotification({
      type: 'success',
      title: 'Tasks Reassigned',
      message: `Updated assignment for ${selectedTaskIds.length} tasks.`,
    });
  };

  const handleBulkStatusUpdate = async (status: ProductionStatus) => {
    await bulkStatusUpdate.mutateAsync({
      task_ids: selectedTaskIds,
      status,
    });
    addNotification({
      type: 'success',
      title: 'Statuses Updated',
      message: `Updated ${selectedTaskIds.length} tasks to ${status}.`,
    });
  };

  const handleBulkArchive = async (isArchived: boolean) => {
    await bulkArchive.mutateAsync({
      task_ids: selectedTaskIds,
      is_archived: isArchived,
    });
    addNotification({
      type: 'info',
      title: isArchived ? 'Tasks Archived' : 'Tasks Restored',
      message: `${selectedTaskIds.length} tasks updated.`,
    });
  };

  const handleBulkDelete = async () => {
    await bulkDelete.mutateAsync({
      task_ids: selectedTaskIds,
    });
    addNotification({
      type: 'success',
      title: 'Tasks Deleted',
      message: `Removed ${selectedTaskIds.length} tasks.`,
    });
  };

  const openLogHoursModal = (task: Task) => {
    setSelectedTaskForLog(task);
    setIsLogHoursModalOpen(true);
  };

  // Metrics counters
  const totalTasks = tasks.length;
  const inProgressCount = tasks.filter((t) => t.status === 'In Progress').length;
  const pendingReviewCount = tasks.filter((t) => t.status === 'Pending Review').length;
  const approvedCount = tasks.filter((t) => t.status === 'Approved').length;
  const totalEstimatedHours = tasks.reduce((sum, t) => sum + (t.schedule?.estimated_hours || t.estimated_hours || 0), 0);
  const totalLoggedHours = tasks.reduce((sum, t) => sum + (t.schedule?.logged_hours || t.logged_hours || 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 pb-24 max-w-7xl mx-auto w-full">
      {/* Page Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-100 tracking-tight flex items-center gap-2">
              Production Tasks, Assignments & Timelogs
              <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-800 text-indigo-300 rounded border border-slate-700">
                {totalTasks} Total
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Department execution queue, team delegation, milestones, and timesheet logging.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'table' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Table View"
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'board' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'calendar' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Calendar Deadlines View"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'timeline' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Gantt Timeline View"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Timeline</span>
            </button>
          </div>

          <Can permission="tasks:create">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Task
            </Button>
          </Can>
        </div>
      </div>

      {/* Production Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">In Progress</span>
          <span className="text-xl font-bold font-mono text-indigo-400 mt-1 block">{inProgressCount}</span>
          <span className="text-[10px] text-slate-500">Active execution</span>
        </div>

        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Pending Review</span>
          <span className="text-xl font-bold font-mono text-amber-400 mt-1 block">{pendingReviewCount}</span>
          <span className="text-[10px] text-slate-500">Dailies / Lead signoff</span>
        </div>

        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Approved</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">{approvedCount}</span>
          <span className="text-[10px] text-slate-500">Passed final review</span>
        </div>

        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Estimated Hours</span>
          <span className="text-xl font-bold font-mono text-slate-200 mt-1 block">{totalEstimatedHours}h</span>
          <span className="text-[10px] text-slate-500">Total capacity</span>
        </div>

        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Logged Hours</span>
          <span className="text-xl font-bold font-mono text-cyan-400 mt-1 block">{totalLoggedHours}h</span>
          <span className="text-[10px] text-slate-500">Actual work logged</span>
        </div>

        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Burnup Progress</span>
          <span className="text-xl font-bold font-mono text-purple-400 mt-1 block">
            {totalEstimatedHours > 0 ? Math.round((totalLoggedHours / totalEstimatedHours) * 100) : 0}%
          </span>
          <span className="text-[10px] text-slate-500">Budget consumed</span>
        </div>
      </div>

      {/* Comprehensive Filter Toolbar */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[240px]">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Search task code, title, artist, software, tags..."
            />
          </div>

          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Projects</option>
            {projectsData?.results?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>

          {/* Entity Type Filter */}
          <select
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Entity Types</option>
            <option value="Shot">Shots (VFX Cuts)</option>
            <option value="Asset">Assets (3D/LookDev)</option>
            <option value="General">General Pipeline</option>
          </select>

          {/* Department Filter */}
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Departments</option>
            <option value="FX & Simulation">FX & Simulation</option>
            <option value="3D Modeling & Assets">3D Modeling & Assets</option>
            <option value="Character & Creature Rigging">Rigging</option>
            <option value="Character & Creature Animation">Animation</option>
            <option value="Lighting & LookDev">Lighting & LookDev</option>
            <option value="Compositing (Nuke)">Compositing</option>
            <option value="Editorial">Editorial</option>
            <option value="Pipeline & Core Infrastructure">Pipeline & TD</option>
          </select>

          {/* Team Filter */}
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Teams</option>
            {mockTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Assignee Filter */}
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Assignees</option>
            {mockUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>

          {/* Vendor Filter */}
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Studios / Vendors</option>
            {mockVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Retake">Retake</option>
            <option value="On Hold">On Hold</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Archive Toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
            />
            <span>Show Archived</span>
          </label>
        </div>
      </div>

      {/* Main View Area */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Synchronizing studio production task queue..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-10 h-10 text-indigo-400" />}
          title="No Tasks Found"
          description="There are no production tasks matching the selected filters."
          actionLabel="Create Task"
          onAction={() => setIsCreateModalOpen(true)}
        />
      ) : viewMode === 'table' ? (
        <TaskTableView
          tasks={tasks}
          selectedTaskIds={selectedTaskIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onOpenLogHours={openLogHoursModal}
        />
      ) : viewMode === 'board' ? (
        <TaskBoardView
          tasks={tasks}
          onUpdateTask={handleUpdateTask}
          onOpenLogHours={openLogHoursModal}
        />
      ) : viewMode === 'calendar' ? (
        <TaskCalendarView
          tasks={tasks}
          onOpenCreate={(dateStr) => setIsCreateModalOpen(true)}
        />
      ) : (
        <TaskTimelineView tasks={tasks} />
      )}

      {/* Floating Bulk Operations Toolbar */}
      <TaskBulkOperationsBar
        selectedCount={selectedTaskIds.length}
        selectedTaskIds={selectedTaskIds}
        onClearSelection={() => setSelectedTaskIds([])}
        onBulkAssign={handleBulkAssign}
        onBulkStatusUpdate={handleBulkStatusUpdate}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
      />

      {/* Create Task Modal */}
      {isCreateModalOpen && (
        <TaskCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateSubmit}
          defaultProjectId={projectFilter !== 'ALL' ? projectFilter : 'proj-001'}
        />
      )}

      {/* Log Hours Modal */}
      {isLogHoursModalOpen && (
        <TimelogCreateModal
          isOpen={isLogHoursModalOpen}
          onClose={() => setIsLogHoursModalOpen(false)}
          onSubmit={(data) => createTimelog.mutateAsync(data)}
          task={selectedTaskForLog}
        />
      )}
    </div>
  );
};
