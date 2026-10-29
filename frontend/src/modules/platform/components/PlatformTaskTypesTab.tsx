import React, { useState } from 'react';
import {
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { MasterTaskType } from '@/types/masterData';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';
import {
  usePlatformMasterTaskTypes,
  useUpdatePlatformTaskType,
  useArchivePlatformTaskType,
  useRestorePlatformTaskType,
  useDeletePlatformTaskType,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { MasterDataTabShell, MasterDataItem } from '../admin/masterData/MasterDataTabShell';
import { masterDataEntities } from '../admin/masterData/masterDataEntities';

interface PlatformTaskTypesTabProps {
  onOpenCreate: () => void;
}

export const PlatformTaskTypesTab: React.FC<PlatformTaskTypesTabProps> = ({
  onOpenCreate,
}) => {
  const { data: taskTypesList, isLoading } = usePlatformMasterTaskTypes();
  const { can } = usePermissionEvaluator();
  const { addNotification } = useNotificationStore();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [editingTaskType, setEditingTaskType] = useState<MasterTaskType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MasterTaskType | null>(null);

  const [editForm, setEditForm] = useState({
    name: '',
    category: 'shot' as 'shot' | 'asset' | 'general' | 'editorial',
    department_code: 'comp',
    department_name: 'Compositing',
    color: '#a855f7',
    icon: 'Layers',
    description: '',
  });

  // RBAC: create is gated by the shell via masterDataEntities.taskTypes
  const canUpdate = can('platform.task_type.update') || can('platform.master_data.update');
  const canArchive = can('platform.task_type.archive') || can('platform.master_data.archive');
  const canRestore = can('platform.task_type.restore') || can('platform.master_data.restore');
  const canDelete = can('platform.task_type.delete') || can('platform.master_data.delete');

  const updateMutation = useUpdatePlatformTaskType();
  const archiveMutation = useArchivePlatformTaskType();
  const restoreMutation = useRestorePlatformTaskType();
  const deleteMutation = useDeletePlatformTaskType();

  const shellItems: MasterDataItem[] = (taskTypesList || []).map((t) => ({
    ...t,
    is_archived: t.status !== 'active',
  }));

  const applyExtraFilter = (item: MasterDataItem) =>
    categoryFilter === 'all' || item.category === categoryFilter;

  const handleOpenEdit = (taskType: MasterTaskType) => {
    setEditingTaskType(taskType);
    setEditForm({
      name: taskType.name,
      category: taskType.category,
      department_code: taskType.department_code || 'comp',
      department_name: taskType.department_name || 'Compositing',
      color: taskType.color || '#a855f7',
      icon: taskType.icon || 'Layers',
      description: taskType.description || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTaskType) return;
    try {
      await updateMutation.mutateAsync({
        id: editingTaskType.id,
        data: editForm,
      });
      setEditingTaskType(null);
      addNotification({
        type: 'success',
        title: 'Task Type Updated',
        message: `Updated task type ${editForm.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update task type.',
      });
    }
  };

  const handleArchive = async (taskType: MasterTaskType) => {
    try {
      await archiveMutation.mutateAsync(taskType.id);
      addNotification({
        type: 'info',
        title: 'Task Type Archived',
        message: `Archived ${taskType.name}.`,
      });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleRestore = async (taskType: MasterTaskType) => {
    try {
      await restoreMutation.mutateAsync(taskType.id);
      addNotification({
        type: 'success',
        title: 'Task Type Restored',
        message: `Restored ${taskType.name}.`,
      });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      addNotification({
        type: 'success',
        title: 'Task Type Deleted',
        message: `Deleted ${deleteTarget.name}.`,
      });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Delete Failed', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <MasterDataTabShell
        entity={masterDataEntities.taskTypes}
        items={shellItems}
        isLoading={isLoading}
        onCreate={onOpenCreate}
        createLabel="Create Task Type"
        searchFields={['name', 'code', 'description', 'department_name']}
        extraFilters={
          <select
            aria-label="Discipline filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Disciplines</option>
            <option value="shot">Shot Tasks</option>
            <option value="asset">Asset Tasks</option>
            <option value="general">General Tasks</option>
          </select>
        }
        applyExtraFilter={applyExtraFilter}
        renderTable={(rows) => (
      <Card className="bg-slate-900 border-slate-800">
        <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Task Type Name</th>
                  <th className="py-3.5 px-4">Code Identifier</th>
                  <th className="py-3.5 px-4">Discipline / Scope</th>
                  <th className="py-3.5 px-4">Department Binding</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {(rows as MasterTaskType[]).map((tt) => (
                  <tr key={tt.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: tt.color || '#a855f7' }}
                        />
                        <span className="font-semibold text-white">{tt.name}</span>
                      </div>
                      {tt.description && <p className="text-xs text-slate-400 truncate max-w-xs">{tt.description}</p>}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-purple-300">{tt.code}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs capitalize font-mono bg-slate-950 text-slate-300 border-slate-800">
                        {tt.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-300 text-xs font-mono">
                      {tt.department_name || tt.department_code || 'General'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={tt.status === 'active' ? 'success' : 'secondary'} className="text-xs font-mono uppercase">
                        {tt.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tt)}
                          disabled={!canUpdate}
                          title={canUpdate ? 'Edit task type' : 'Requires permission'}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {tt.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleArchive(tt)}
                            disabled={!canArchive}
                            title={canArchive ? 'Archive task type' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 disabled:opacity-30 transition"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(tt)}
                            disabled={!canRestore}
                            title={canRestore ? 'Restore task type' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 disabled:opacity-30 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(tt)}
                          disabled={!canDelete}
                          title={canDelete ? 'Delete task type' : 'Requires permission'}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 disabled:opacity-30 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </CardBody>
      </Card>
          )}
        />

      {/* EDIT MODAL */}
      {editingTaskType && (
        <Modal isOpen={Boolean(editingTaskType)} onClose={() => setEditingTaskType(null)} title={`Edit Task Type: ${editingTaskType.name}`}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Task Type Name</label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Discipline Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="shot">Shot</option>
                  <option value="asset">Asset</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Department</label>
                <input
                  type="text"
                  required
                  value={editForm.department_name}
                  onChange={(e) => setEditForm({ ...editForm, department_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Tag Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-9 h-9 rounded bg-transparent border-0 cursor-pointer"
                />
                <input
                  type="text"
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingTaskType(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <Modal isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Confirm Task Type Deletion">
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">Delete &quot;{deleteTarget.name}&quot; ({deleteTarget.code})?</p>
                <p className="text-xs text-slate-400 mt-1">
                  This will remove the task type definition from the canonical platform registry.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} isLoading={deleteMutation.isPending}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
