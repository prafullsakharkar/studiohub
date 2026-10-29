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
import { MasterStatus } from '@/types/masterData';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';
import {
  usePlatformMasterStatuses,
  useUpdatePlatformStatus,
  useArchivePlatformStatus,
  useRestorePlatformStatus,
  useDeletePlatformStatus,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { MasterDataTabShell, MasterDataItem } from '../admin/masterData/MasterDataTabShell';
import { masterDataEntities } from '../admin/masterData/masterDataEntities';

interface PlatformStatusesTabProps {
  onOpenCreate: () => void;
}

export const PlatformStatusesTab: React.FC<PlatformStatusesTabProps> = ({
  onOpenCreate,
}) => {
  const { data: statusesList, isLoading } = usePlatformMasterStatuses();
  const { can } = usePermissionEvaluator();
  const { addNotification } = useNotificationStore();

  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [editingStatus, setEditingStatus] = useState<MasterStatus | null>(null);
  const [deleteStatusTarget, setDeleteStatusTarget] = useState<MasterStatus | null>(null);

  const [editForm, setEditForm] = useState({
    name: '',
    category: 'in_progress' as any,
    color: '#06b6d4',
    order: 10,
    is_default: false,
    is_final: false,
    description: '',
  });

  // RBAC checks (create is gated by the shell via masterDataEntities.statuses)
  const canUpdate = can('platform.status.update') || can('platform.master_data.update');
  const canArchive = can('platform.status.archive') || can('platform.master_data.archive');
  const canRestore = can('platform.status.restore') || can('platform.master_data.restore');
  const canDelete = can('platform.status.delete') || can('platform.master_data.delete');

  const updateStatusMutation = useUpdatePlatformStatus();
  const archiveStatusMutation = useArchivePlatformStatus();
  const restoreStatusMutation = useRestorePlatformStatus();
  const deleteStatusMutation = useDeletePlatformStatus();

  const shellItems: MasterDataItem[] = (statusesList || []).map((s) => ({
    ...s,
    is_archived: s.status !== 'active',
  }));

  const applyExtraFilter = (item: MasterDataItem) =>
    (entityFilter === 'all' || item.entity_type === entityFilter) &&
    (categoryFilter === 'all' || item.category === categoryFilter);

  const handleOpenEdit = (status: MasterStatus) => {
    setEditingStatus(status);
    setEditForm({
      name: status.name,
      category: status.category,
      color: status.color,
      order: status.order,
      is_default: status.is_default,
      is_final: status.is_final,
      description: status.description || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStatus) return;
    try {
      await updateStatusMutation.mutateAsync({
        id: editingStatus.id,
        data: editForm,
      });
      setEditingStatus(null);
      addNotification({
        type: 'success',
        title: 'Status Updated',
        message: `Updated status ${editForm.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update status.',
      });
    }
  };

  const handleArchive = async (status: MasterStatus) => {
    try {
      await archiveStatusMutation.mutateAsync(status.id);
      addNotification({
        type: 'info',
        title: 'Status Archived',
        message: `Archived status ${status.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not archive status.',
      });
    }
  };

  const handleRestore = async (status: MasterStatus) => {
    try {
      await restoreStatusMutation.mutateAsync(status.id);
      addNotification({
        type: 'success',
        title: 'Status Restored',
        message: `Restored status ${status.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Action Failed',
        message: err.message || 'Could not restore status.',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteStatusTarget) return;
    try {
      await deleteStatusMutation.mutateAsync(deleteStatusTarget.id);
      setDeleteStatusTarget(null);
      addNotification({
        type: 'success',
        title: 'Status Deleted',
        message: `Deleted status ${deleteStatusTarget.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete status.',
      });
    }
  };

  return (
    <div className="space-y-6">
      <MasterDataTabShell
        entity={masterDataEntities.statuses}
        items={shellItems}
        isLoading={isLoading}
        onCreate={onOpenCreate}
        createLabel="Create Status"
        extraFilters={
          <>
            <select
              aria-label="Entity filter"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Entities</option>
              <option value="task">Tasks</option>
              <option value="shot">Shots</option>
              <option value="asset">Assets</option>
              <option value="version">Versions</option>
              <option value="review">Reviews</option>
            </select>

            <select
              aria-label="Category filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="blocked">Blocked</option>
              <option value="omitted">Omitted</option>
            </select>
          </>
        }
        applyExtraFilter={applyExtraFilter}
        renderTable={(rows) => (
      <Card className="bg-slate-900 border-slate-800">
        <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Entity Type</th>
                  <th className="py-3.5 px-4">Status Name</th>
                  <th className="py-3.5 px-4">Code Identifier</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Order</th>
                  <th className="py-3.5 px-4">Rules</th>
                  <th className="py-3.5 px-4">State</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {(rows as MasterStatus[]).map((status) => (
                  <tr key={status.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs font-mono uppercase bg-slate-950 text-cyan-400 border-slate-800">
                        {status.entity_type}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                        <span className="font-semibold text-white">{status.name}</span>
                      </div>
                      {status.description && <p className="text-xs text-slate-400 truncate max-w-xs">{status.description}</p>}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">{status.code}</td>
                    <td className="py-3 px-4">
                      <Badge variant="secondary" className="text-xs capitalize font-mono">
                        {status.category.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-400">#{status.order}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        {status.is_default && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            DEFAULT
                          </span>
                        )}
                        {status.is_final && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            FINAL
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={status.status === 'active' ? 'success' : 'secondary'} className="text-xs font-mono uppercase">
                        {status.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(status)}
                          disabled={!canUpdate}
                          title={canUpdate ? 'Edit status' : 'Requires platform.status.update'}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {status.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleArchive(status)}
                            disabled={!canArchive}
                            title={canArchive ? 'Archive status' : 'Requires platform.status.archive'}
                            className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 disabled:opacity-30 transition"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestore(status)}
                            disabled={!canRestore}
                            title={canRestore ? 'Restore status' : 'Requires platform.status.restore'}
                            className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 disabled:opacity-30 transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteStatusTarget(status)}
                          disabled={!canDelete}
                          title={canDelete ? 'Delete status' : 'Requires platform.status.delete'}
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

      {/* EDIT STATUS MODAL */}
      {editingStatus && (
        <Modal isOpen={Boolean(editingStatus)} onClose={() => setEditingStatus(null)} title={`Edit Status: ${editingStatus.name}`}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Status Name</label>
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
                <label className="block text-xs font-mono text-slate-400 mb-1">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="approved">Approved</option>
                  <option value="blocked">Blocked</option>
                  <option value="omitted">Omitted</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Color Code</label>
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
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Sort Order Index</label>
              <input
                type="number"
                value={editForm.order}
                onChange={(e) => setEditForm({ ...editForm, order: parseInt(e.target.value, 10) || 0 })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center gap-6 py-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_default}
                  onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                />
                Is Default Creation Status
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editForm.is_final}
                  onChange={(e) => setEditForm({ ...editForm, is_final: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
                />
                Is Final Approval / Complete
              </label>
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
              <Button type="button" variant="ghost" onClick={() => setEditingStatus(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={updateStatusMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteStatusTarget && (
        <Modal isOpen={Boolean(deleteStatusTarget)} onClose={() => setDeleteStatusTarget(null)} title="Confirm Status Deletion">
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">Delete &quot;{deleteStatusTarget.name}&quot; ({deleteStatusTarget.code})?</p>
                <p className="text-xs text-slate-400 mt-1">
                  This will remove the status definition from the canonical platform registry.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteStatusTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} isLoading={deleteStatusMutation.isPending}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
