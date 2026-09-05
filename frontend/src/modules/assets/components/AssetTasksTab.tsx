import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Clock,
  User,
  Calendar,
  AlertCircle,
  Cpu,
  Layers,
  ChevronRight,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { Asset } from '@/types/assets';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { useTaskMutations } from '@/modules/tasks/hooks/useTaskMutations';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { PriorityLevel, ProductionStatus, Department } from '@/types/common';
import { Task } from '@/types/tasks';

interface AssetTasksTabProps {
  asset: Asset;
}

export const AssetTasksTab: React.FC<AssetTasksTabProps> = ({ asset }) => {
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: tasksData, isLoading } = useTasks({
    project_id: asset.project_id,
  });

  const { createTask, updateTask, isCreating } = useTaskMutations();

  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    department: '3D Modeling & Assets' as Department,
    priority: 'Medium' as PriorityLevel,
    assignee_name: 'Sarah Jenkins',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimated_hours: 24,
    description: '',
    software: 'Maya 2025',
  });

  // Filter tasks specific to this asset or matching entity code / id
  const allTasks = tasksData?.results || [];
  const assetTasks = allTasks.filter(
    (t) =>
      t.entity_id === asset.id ||
      t.entity_code === asset.code ||
      t.title.toLowerCase().includes(asset.name.toLowerCase()) ||
      t.title.toLowerCase().includes(asset.code.toLowerCase())
  );

  // Provide fallback mock tasks for this asset if none found
  const displayedTasks = assetTasks.length > 0
    ? assetTasks
    : [
        {
          id: `task-ast-01-${asset.id}`,
          title: `${asset.name} - Hi-Poly ZBrush Digital Sculpt & Topology`,
          code: `TSK-MOD-${asset.code.replace('AST_', '')}`,
          project_id: asset.project_id,
          project_code: asset.project_code,
          entity_type: 'Asset' as const,
          entity_id: asset.id,
          entity_code: asset.code,
          department: '3D Modeling & Assets' as Department,
          status: 'Approved' as ProductionStatus,
          priority: 'High' as PriorityLevel,
          assignee_id: 'usr-004',
          assignee_name: 'Sarah Jenkins',
          assignee_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          due_date: '2026-08-10',
          estimated_hours: 40,
          logged_hours: 38.5,
          description: 'High-poly sculpting, retopology to clean quad meshes, and LOD cascade generation.',
          software: 'ZBrush / Maya',
          created_at: '2026-07-01T09:00:00Z',
          updated_at: '2026-08-10T15:00:00Z',
        },
        {
          id: `task-ast-02-${asset.id}`,
          title: `${asset.name} - MaterialX LookDev & 8K UDIM Shaders`,
          code: `TSK-TX-${asset.code.replace('AST_', '')}`,
          project_id: asset.project_id,
          project_code: asset.project_code,
          entity_type: 'Asset' as const,
          entity_id: asset.id,
          entity_code: asset.code,
          department: 'LookDev & Shading' as Department,
          status: 'In Progress' as ProductionStatus,
          priority: 'Critical' as PriorityLevel,
          assignee_id: 'usr-003',
          assignee_name: 'Elena Rostova',
          assignee_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
          due_date: '2026-08-26',
          estimated_hours: 32,
          logged_hours: 24,
          description: 'Substance Painter texturing, ACEScg color calibration, and Solaris MaterialX shader network setup.',
          software: 'Substance Painter / Solaris',
          created_at: '2026-08-05T10:00:00Z',
          updated_at: '2026-08-18T14:30:00Z',
        },
        {
          id: `task-ast-03-${asset.id}`,
          title: `${asset.name} - OpenUSD Rig & Deformation Bindings`,
          code: `TSK-RIG-${asset.code.replace('AST_', '')}`,
          project_id: asset.project_id,
          project_code: asset.project_code,
          entity_type: 'Asset' as const,
          entity_id: asset.id,
          entity_code: asset.code,
          department: 'Character & Creature Rigging' as Department,
          status: 'In Progress' as ProductionStatus,
          priority: 'Medium' as PriorityLevel,
          assignee_id: 'usr-002',
          assignee_name: 'Marcus Vance',
          assignee_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
          due_date: '2026-08-30',
          estimated_hours: 48,
          logged_hours: 30,
          description: 'Skeletal joint hierarchy, skin weights calibration, and USD Skel schema export.',
          software: 'Maya 2025',
          created_at: '2026-08-08T11:00:00Z',
          updated_at: '2026-08-19T16:00:00Z',
        },
      ];

  const filteredTasks = displayedTasks.filter((t) => {
    if (departmentFilter !== 'ALL' && t.department !== departmentFilter) return false;
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    return true;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTask({
      ...newTaskForm,
      code: `TSK-${Math.floor(Math.random() * 9000 + 1000)}`,
      project_id: asset.project_id,
      project_code: asset.project_code,
      entity_type: 'Asset',
      entity_id: asset.id,
      entity_code: asset.code,
      status: 'Not Started',
      logged_hours: 0,
      assignee_id: 'usr-004',
      assignee_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    } as Partial<Task>);
    setIsCreateOpen(false);
  };

  const totalEstimated = displayedTasks.reduce((acc, t) => acc + (t.estimated_hours || 0), 0);
  const totalLogged = displayedTasks.reduce((acc, t) => acc + (t.logged_hours || 0), 0);
  const completionPercentage = totalEstimated > 0 ? Math.min(100, Math.round((totalLogged / totalEstimated) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner with Progress & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            Asset Production Tasks & Milestones
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-department work breakdown structure for {asset.name} ({asset.code})
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          {/* Hours Progress Bar */}
          <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-400 block uppercase">Burnup Progress</span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {totalLogged}h / {totalEstimated}h ({completionPercentage}%)
              </span>
            </div>
            <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${completionPercentage}%` }}></div>
            </div>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Task
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-mono text-slate-400">Filter By:</span>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Departments</option>
            <option value="3D Modeling & Assets">3D Modeling & Assets</option>
            <option value="LookDev & Shading">LookDev & Shading</option>
            <option value="Character & Creature Rigging">Rigging</option>
            <option value="CFX & Groom">CFX & Groom</option>
            <option value="FX & Simulation">FX & Simulation</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="Not Started">Not Started</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Retake">Retake</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Showing {filteredTasks.length} task{filteredTasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.map((task) => {
          const taskProgress = task.estimated_hours > 0 ? Math.min(100, Math.round((task.logged_hours / task.estimated_hours) * 100)) : 0;
          return (
            <div
              key={task.id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all shadow-md space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono font-bold text-xs text-white">{task.code}</span>
                      <span className="text-slate-500">•</span>
                      <Badge variant="outline" className="text-[10px] font-mono text-indigo-300 border-indigo-500/30">
                        {task.department}
                      </Badge>
                      <Badge
                        variant={task.priority === 'Critical' ? 'error' : task.priority === 'High' ? 'warning' : 'outline'}
                        className="text-[10px] font-mono"
                      >
                        {task.priority}
                      </Badge>
                    </div>
                    <h4 className="text-sm font-semibold text-white mt-0.5">{task.title}</h4>
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end sm:self-center">
                  <select
                    value={task.status}
                    onChange={(e) =>
                      updateTask({ id: task.id, data: { status: e.target.value as ProductionStatus } })
                    }
                    className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending Review">Pending Review</option>
                    <option value="Approved">Approved</option>
                    <option value="Retake">Retake</option>
                  </select>
                </div>
              </div>

              {task.description && (
                <p className="text-xs text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 font-sans">
                  {task.description}
                </p>
              )}

              {/* Task Footer Details */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60 text-xs font-mono">
                <div className="flex items-center space-x-4">
                  {/* Assignee */}
                  <div className="flex items-center space-x-1.5">
                    <img
                      src={task.assignee_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                      alt={task.assignee_name || 'Artist'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="text-slate-300 font-sans font-medium">{task.assignee_name || 'Unassigned'}</span>
                  </div>

                  {/* Software */}
                  <span className="text-slate-400">DCC: {task.software || 'Maya'}</span>

                  {/* Due Date */}
                  <div className="flex items-center space-x-1 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Due: {task.due_date}</span>
                  </div>
                </div>

                {/* Hours & Progress */}
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">
                    {task.logged_hours}h / {task.estimated_hours}h
                  </span>
                  <div className="w-16 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        taskProgress >= 100 ? 'bg-emerald-400' : 'bg-indigo-400'
                      }`}
                      style={{ width: `${taskProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={`Add Production Task for ${asset.code}`}
      >
        <form onSubmit={handleCreateTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title</label>
            <input
              type="text"
              required
              value={newTaskForm.title}
              onChange={(e) => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
              placeholder="e.g. Hero Shading & LookDev Calibration"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                value={newTaskForm.department}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, department: e.target.value as Department })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="3D Modeling & Assets">3D Modeling & Assets</option>
                <option value="LookDev & Shading">LookDev & Shading</option>
                <option value="Character & Creature Rigging">Rigging</option>
                <option value="CFX & Groom">CFX & Groom</option>
                <option value="FX & Simulation">FX & Simulation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
              <select
                value={newTaskForm.priority}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, priority: e.target.value as PriorityLevel })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Artist</label>
              <input
                type="text"
                value={newTaskForm.assignee_name}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, assignee_name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">DCC Tool</label>
              <input
                type="text"
                value={newTaskForm.software}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, software: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Estimated Hours</label>
              <input
                type="number"
                min="1"
                max="200"
                value={newTaskForm.estimated_hours}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, estimated_hours: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Due Date</label>
              <input
                type="date"
                value={newTaskForm.due_date}
                onChange={(e) => setNewTaskForm({ ...newTaskForm, due_date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Task Deliverable Description</label>
            <textarea
              rows={3}
              value={newTaskForm.description}
              onChange={(e) => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
              placeholder="Specific guidelines, topology restrictions, or shader criteria..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
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
