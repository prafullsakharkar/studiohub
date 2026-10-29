import { useTasks, useBulkTasks, TaskBulkManager } from '@/modules/tasks';
import { useTaskMutations } from '@/modules/tasks/hooks/useTasks';
import React, { useState } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import {
  CheckSquare,
  Square,
  Plus,
  LayoutGrid,
  List,
  Search,
  Clock,
  ExternalLink,
  ChevronRight,
  User,
  ArrowRight,
  Calendar,
  FileSpreadsheet,
  Edit3,
  Archive,
  RotateCcw,
} from 'lucide-react';
import { Project } from '@/types/production';
import { StatusBadge, PriorityBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Modal } from '@/shared/components/Modal';
import { SearchInput } from '@/shared/components/SearchInput';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link } from 'react-router-dom';
import { Task } from '@/types/production';
import { Department, PriorityLevel, ProductionStatus } from '@/types/common';
import { BulkActionBar } from '@/shared/components/bulk/BulkActionBar';
import { BulkUpdatePanel, FieldDefinition } from '@/shared/components/bulk/BulkUpdatePanel';
import { PermissionButton } from '@/core/permissions/PermissionComponents';
import { WorkflowStateTransitionControl } from '@/core/permissions/components/WorkflowStateTransitionControl';

interface ProjectTasksTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

const TASK_BULK_FIELDS: FieldDefinition[] = [
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    options: ['Not Started', 'In Progress', 'In Review', 'Approved', 'Blocked', 'On Hold'],
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: ['Low', 'Medium', 'High', 'Critical'],
  },
  {
    key: 'department',
    label: 'Department',
    type: 'select',
    options: [
      'Layout & Previz',
      'Modeling & Surfacing',
      'Rigging & Creature FX',
      'Character Animation',
      'FX & Simulation',
      'Lighting & LookDev',
      'Compositing',
      'Matte Painting & DMP',
      'Editorial & Ingest',
    ],
  },
  {
    key: 'assignee_name',
    label: 'Assignee',
    type: 'text',
    placeholder: 'e.g. Elena Rostova',
  },
  {
    key: 'estimated_hours',
    label: 'Estimated Hours',
    type: 'number',
    placeholder: '40',
  },
  {
    key: 'due_date',
    label: 'Due Date',
    type: 'text',
    placeholder: '2026-09-30',
  },
];

export const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ project }) => {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const openInspector = useInspectorStore((state) => state.openInspector);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: tasksData, isLoading, refetch } = useTasks({
    project_id: project.id,
    search: search || undefined,
    department: deptFilter !== 'ALL' ? deptFilter : undefined,
    is_archived: includeDeleted ? 'true' : undefined,
    page_size: 50,
  });

  const { createTask, updateTask } = useTaskMutations();
  const { bulkUpdate, bulkArchive, bulkRestore } = useBulkTasks();

  const [formData, setFormData] = useState({
    title: '',
    code: `TSK-${project.code}-`,
    entity_type: 'Shot' as const,
    entity_code: `${project.code}_010_010`,
    department: 'FX & Simulation' as Department,
    priority: 'High' as PriorityLevel,
    assignee_name: 'Elena Rostova',
    due_date: '2026-09-15',
    estimated_hours: 40,
    software: 'Houdini 20.5',
    description: '',
  });

  const tasks = tasksData?.results || [];
  const selectedTasks = tasks.filter((t) => selectedTaskIds.includes(t.id));

  const toggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllTasks = () => setSelectedTaskIds(tasks.map((t) => t.id));
  const clearSelection = () => setSelectedTaskIds([]);

  const handleBulkArchive = async () => {
    if (selectedTaskIds.length === 0) return;
    await bulkArchive({ ids: selectedTaskIds });
    clearSelection();
    refetch();
  };

  const handleBulkRestore = async () => {
    if (selectedTaskIds.length === 0) return;
    await bulkRestore({ ids: selectedTaskIds });
    clearSelection();
    refetch();
  };

  const handleApplyBulkUpdate = async (changes: Partial<Task>) => {
    const resp = await bulkUpdate({
      ids: selectedTaskIds,
      changes,
    });
    refetch();
    return resp;
  };

  const exportTasksData = (format: 'csv' | 'json' = 'csv') => {
    const dataToExport = selectedTasks.length > 0 ? selectedTasks : tasks;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.code}_tasks_${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const csvContent = [
      ['Task Code', 'Title', 'Target Entity', 'Department', 'Priority', 'Status', 'Assignee', 'Est Hours', 'Due Date'].join(','),
      ...dataToExport.map((t) =>
        [
          t.code,
          `"${t.title}"`,
          t.entity_code,
          t.department,
          t.priority,
          t.status,
          `"${t.assignee_name || 'Unassigned'}"`,
          t.estimated_hours,
          t.due_date,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.code}_tasks_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask.mutateAsync({
      ...formData,
      project_id: project.id,
      project_code: project.code,
      entity_id: 'shot-001',
      status: 'Not Started',
      logged_hours: 0,
    } as Partial<Task>);
    setIsCreateOpen(false);
  };

  const departments = [
    'ALL',
    'Layout & Previz',
    'Modeling & Surfacing',
    'Rigging & Creature FX',
    'Character Animation',
    'FX & Simulation',
    'Lighting & LookDev',
    'Compositing',
  ];

  const columns: { label: string; status: ProductionStatus }[] = [
    { label: 'Not Started', status: 'Not Started' },
    { label: 'In Flight', status: 'In Progress' },
    { label: 'Review Queue', status: 'Pending Review' },
    { label: 'Approved', status: 'Approved' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              placeholder="Search task title or code..."
              className="w-full"
            />
          </div>

          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-amber-500"
          >
            {departments.map((d) => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'All Departments' : d}
              </option>
            ))}
          </select>

          <label className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-mono cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500/20"
            />
            <span>Show Archived</span>
          </label>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'board' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Kanban Board"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'table' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Dense Table Matrix"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <PermissionButton
            permission="task.bulk_update"
            context={{ projectId: project.id, organizationId: project.organization_id }}
            variant="secondary"
            size="sm"
            onClick={() => setIsBulkManagerOpen(true)}
            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />}
            className="border-amber-500/30 text-amber-300 hover:bg-amber-950/40"
          >
            Bulk Operations
          </PermissionButton>

          <PermissionButton
            permission="task.create"
            context={{ projectId: project.id, organizationId: project.organization_id }}
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="bg-amber-600 hover:bg-amber-500 text-white"
          >
            Create Task
          </PermissionButton>

          <Link to="/tasks">
            <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>
              All Tasks
            </Button>
          </Link>
        </div>
      </div>

      {/* Bulk Action Bar for Selected Rows */}
      {selectedTaskIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedTaskIds.length}
          totalCount={tasks.length}
          onClearSelection={clearSelection}
          onSelectAll={selectAllTasks}
          onOpenBulkUpdate={() => setIsBulkUpdateOpen(true)}
          onBulkArchive={handleBulkArchive}
          onBulkRestore={handleBulkRestore}
          onExportCSV={() => exportTasksData('csv')}
          onExportJSON={() => exportTasksData('json')}
          entityType="Task"
        />
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading show tasks..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-8 h-8 text-amber-400" />}
          title="No Tasks Assigned for this Show"
          description="Create department tasks and assign artists to commence visual effects execution, or stage tasks in bulk."
          actionLabel="Create Task"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col h-full space-y-3"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                    {col.label}
                    <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                      {colTasks.length}
                    </span>
                  </span>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTasks.map((task) => {
                    const isSelected = selectedTaskIds.includes(task.id);
                    return (
                      <Card
                        key={task.id}
                        className={`bg-slate-900 border-slate-800 hover:border-amber-500/40 transition-all p-3 space-y-2 group relative ${
                          isSelected ? 'ring-2 ring-amber-500 border-amber-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelectTask(task.id);
                              }}
                              className="text-slate-400 hover:text-amber-400"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <span className="font-mono text-[10px] font-bold text-amber-400">{task.code}</span>
                          </div>
                          <PriorityBadge priority={task.priority} />
                        </div>

                        <h4
                          onClick={() => openInspector('task', task)}
                          className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-2 cursor-pointer"
                        >
                          {task.title}
                        </h4>

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
                          <span className="text-amber-300">{task.entity_code}</span>
                          <span>{task.software}</span>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            {task.assignee_avatar ? (
<SmartImg
                                src={task.assignee_avatar}
                                alt={task.assignee_name}
                                className="w-5 h-5 rounded-full object-cover border border-slate-700"
                              />
                            ) : (
                              <User className="w-4 h-4 text-slate-500" />
                            )}
                            <span className="text-slate-300 truncate max-w-[90px]">{task.assignee_name}</span>
                          </div>

                          <span className="font-mono text-[10px] text-slate-400">
                            {task.logged_hours}h / {task.estimated_hours}h
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-600 font-mono">No tasks in this lane</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                  <th className="py-2.5 px-3 w-8">
                    <button
                      onClick={selectedTaskIds.length === tasks.length ? clearSelection : selectAllTasks}
                      className="text-slate-400 hover:text-white"
                    >
                      {selectedTaskIds.length === tasks.length && tasks.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Task Code & Title</th>
                  <th className="py-2.5 px-3">Target Entity</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Assignee</th>
                  <th className="py-2.5 px-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {tasks.map((task) => {
                  const isSelected = selectedTaskIds.includes(task.id);
                  return (
                    <tr
                      key={task.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-amber-950/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => toggleSelectTask(task.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td
                        className="py-2.5 px-3 cursor-pointer"
                        onClick={() => openInspector('task', task)}
                      >
                        <span className="font-mono font-bold text-amber-400 block">{task.code}</span>
                        <span className="text-white font-medium">{task.title}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-amber-300">{task.entity_code}</td>
                      <td className="py-2.5 px-3 text-slate-300">{task.department}</td>
                      <td className="py-2.5 px-3">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="py-2.5 px-3">
                        <WorkflowStateTransitionControl
                          entityType="task"
                          currentState={
                            task.status === 'In Progress'
                              ? 'IN_PROGRESS'
                              : task.status === 'In Review'
                              ? 'READY_FOR_REVIEW'
                              : task.status === 'Approved'
                              ? 'APPROVED'
                              : task.status === 'Blocked'
                              ? 'REJECTED'
                              : task.status === 'On Hold'
                              ? 'PAUSED'
                              : 'TODO'
                          }
                          entity={task}
                          context={{ projectId: project.id, organizationId: project.organization_id }}
                          onTransition={async (targetState) => {
                            const map: Record<string, any> = {
                              TODO: 'Not Started',
                              IN_PROGRESS: 'In Progress',
                              PAUSED: 'On Hold',
                              READY_FOR_REVIEW: 'In Review',
                              APPROVED: 'Approved',
                              REJECTED: 'Blocked',
                              DONE: 'Approved',
                            };
                            await updateTask.mutateAsync({
                              id: task.id,
                              data: {
                                status: map[targetState] || targetState,
                              },
                            });
                            refetch();
                          }}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-slate-200">{task.assignee_name || 'Unassigned'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{task.due_date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Update Modal Drawer */}
      {isBulkUpdateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl p-6">
            <BulkUpdatePanel
              entityType="Task"
              selectedEntities={selectedTasks}
              fieldDefinitions={TASK_BULK_FIELDS}
              onApplyUpdate={handleApplyBulkUpdate}
              onClose={() => setIsBulkUpdateOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Bulk Operations Manager Modal */}
      <TaskBulkManager
        projectId={project.id}
        projectCode={project.code}
        isOpen={isBulkManagerOpen}
        onClose={() => setIsBulkManagerOpen(false)}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Initialize Production Task"
        subtitle={`Dispatching task for show ${project.name} (${project.code})`}
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Task Title</label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Volumetric Atmospheric Rain Simulation"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Entity Code</label>
              <input
                required
                type="text"
                value={formData.entity_code}
                onChange={(e) => setFormData({ ...formData, entity_code: e.target.value.toUpperCase() })}
                placeholder="NK_010_010"
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
                {departments.filter((d) => d !== 'ALL').map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as PriorityLevel })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Due Date</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={createTask.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              Create Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
