import React, { useState } from 'react';
import {
  Box,
  Clapperboard,
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
import { MasterAssetType, MasterShotType } from '@/types/masterData';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';
import {
  usePlatformMasterAssetTypes,
  useCreatePlatformAssetType,
  useUpdatePlatformAssetType,
  useArchivePlatformAssetType,
  useRestorePlatformAssetType,
  useDeletePlatformAssetType,
  usePlatformMasterShotTypes,
  useCreatePlatformShotType,
  useUpdatePlatformShotType,
  useArchivePlatformShotType,
  useRestorePlatformShotType,
  useDeletePlatformShotType,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { MasterDataTabShell, MasterDataItem } from '../admin/masterData/MasterDataTabShell';
import { masterDataEntities } from '../admin/masterData/masterDataEntities';

export const PlatformTaxonomiesTab: React.FC = () => {
  const { data: assetTypesList, isLoading: isAssetLoading } = usePlatformMasterAssetTypes();
  const { data: shotTypesList, isLoading: isShotLoading } = usePlatformMasterShotTypes();
  const [subTab, setSubTab] = useState<'assets' | 'shots'>('assets');
  const { can } = usePermissionEvaluator();
  const { addNotification } = useNotificationStore();

  // Asset Modals
  const [isCreateAssetOpen, setIsCreateAssetOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<MasterAssetType | null>(null);
  const [deleteAssetTarget, setDeleteAssetTarget] = useState<MasterAssetType | null>(null);
  const [assetForm, setAssetForm] = useState({ name: '', code: '', description: '', icon: 'Package' });

  // Shot Modals
  const [isCreateShotOpen, setIsCreateShotOpen] = useState(false);
  const [editingShot, setEditingShot] = useState<MasterShotType | null>(null);
  const [deleteShotTarget, setDeleteShotTarget] = useState<MasterShotType | null>(null);
  const [shotForm, setShotForm] = useState({ name: '', code: '', description: '' });

  // RBAC checks (create is gated by the shell via masterDataEntities)
  const canAssetUpdate = can('platform.asset_type.update') || can('platform.master_data.update');
  const canAssetArchive = can('platform.asset_type.archive') || can('platform.master_data.archive');
  const canAssetRestore = can('platform.asset_type.restore') || can('platform.master_data.restore');
  const canAssetDelete = can('platform.asset_type.delete') || can('platform.master_data.delete');

  const canShotUpdate = can('platform.shot_type.update') || can('platform.master_data.update');
  const canShotArchive = can('platform.shot_type.archive') || can('platform.master_data.archive');
  const canShotRestore = can('platform.shot_type.restore') || can('platform.master_data.restore');
  const canShotDelete = can('platform.shot_type.delete') || can('platform.master_data.delete');

  // Mutations
  const createAssetMutation = useCreatePlatformAssetType();
  const updateAssetMutation = useUpdatePlatformAssetType();
  const archiveAssetMutation = useArchivePlatformAssetType();
  const restoreAssetMutation = useRestorePlatformAssetType();
  const deleteAssetMutation = useDeletePlatformAssetType();

  const createShotMutation = useCreatePlatformShotType();
  const updateShotMutation = useUpdatePlatformShotType();
  const archiveShotMutation = useArchivePlatformShotType();
  const restoreShotMutation = useRestorePlatformShotType();
  const deleteShotMutation = useDeletePlatformShotType();

  const assetItems: MasterDataItem[] = (assetTypesList || []).map((a) => ({
    ...a,
    is_archived: a.status !== 'active',
  }));

  const shotItems: MasterDataItem[] = (shotTypesList || []).map((s) => ({
    ...s,
    is_archived: s.status !== 'active',
  }));

  const openCreateAsset = () => {
    setAssetForm({ name: '', code: '', description: '', icon: 'Package' });
    setIsCreateAssetOpen(true);
  };

  const openCreateShot = () => {
    setShotForm({ name: '', code: '', description: '' });
    setIsCreateShotOpen(true);
  };

  // Asset Handlers
  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAssetMutation.mutateAsync(assetForm);
      setIsCreateAssetOpen(false);
      setAssetForm({ name: '', code: '', description: '', icon: 'Package' });
      addNotification({ type: 'success', title: 'Asset Type Created', message: `Registered ${assetForm.name}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    try {
      await updateAssetMutation.mutateAsync({ id: editingAsset.id, data: assetForm });
      setEditingAsset(null);
      addNotification({ type: 'success', title: 'Asset Type Updated', message: `Updated ${assetForm.name}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  // Shot Handlers
  const handleCreateShot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createShotMutation.mutateAsync(shotForm);
      setIsCreateShotOpen(false);
      setShotForm({ name: '', code: '', description: '' });
      addNotification({ type: 'success', title: 'Shot Type Created', message: `Registered ${shotForm.name}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleUpdateShot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShot) return;
    try {
      await updateShotMutation.mutateAsync({ id: editingShot.id, data: shotForm });
      setEditingShot(null);
      addNotification({ type: 'success', title: 'Shot Type Updated', message: `Updated ${shotForm.name}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const subTabsNode = (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setSubTab('assets')}
        className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
          subTab === 'assets'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
        }`}
      >
        <Box className="w-4 h-4 text-amber-400" />
        Asset Types ({assetTypesList?.length || 0})
      </button>
      <button
        type="button"
        onClick={() => setSubTab('shots')}
        className={`h-9 flex items-center gap-2 px-3.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
          subTab === 'shots'
            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm'
            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
        }`}
      >
        <Clapperboard className="w-4 h-4 text-pink-400" />
        Shot Types ({shotTypesList?.length || 0})
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ASSET TYPES TABLE */}
      {subTab === 'assets' && (
        <MasterDataTabShell
          subTabs={subTabsNode}
          entity={masterDataEntities.assetTypes}
          items={assetItems}
          isLoading={isAssetLoading}
          onCreate={openCreateAsset}
          createLabel="Add Asset Type"
          renderTable={(rows) =>
            rows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">No asset types registered.</div>
            ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Asset Type Name</th>
                    <th className="py-3.5 px-4">Code Identifier</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">State</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {(rows as MasterAssetType[]).map((asset) => (
                    <tr key={asset.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            <Box className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-white">{asset.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-amber-300">{asset.code}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{asset.description || '—'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={asset.status === 'active' ? 'success' : 'secondary'} className="text-xs uppercase font-mono">
                          {asset.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAsset(asset);
                              setAssetForm({ name: asset.name, code: asset.code, description: asset.description || '', icon: asset.icon || 'Package' });
                            }}
                            disabled={!canAssetUpdate}
                            title={canAssetUpdate ? 'Edit' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {asset.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => archiveAssetMutation.mutate(asset.id)}
                              disabled={!canAssetArchive}
                              title={canAssetArchive ? 'Archive' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 disabled:opacity-30"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreAssetMutation.mutate(asset.id)}
                              disabled={!canAssetRestore}
                              title={canAssetRestore ? 'Restore' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 disabled:opacity-30"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteAssetTarget(asset)}
                            disabled={!canAssetDelete}
                            title={canAssetDelete ? 'Delete' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 disabled:opacity-30"
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
            )
          }
        />
      )}

      {/* SHOT TYPES TABLE */}
      {subTab === 'shots' && (
        <MasterDataTabShell
          subTabs={subTabsNode}
          entity={masterDataEntities.shotTypes}
          items={shotItems}
          isLoading={isShotLoading}
          onCreate={openCreateShot}
          createLabel="Add Shot Type"
          renderTable={(rows) =>
            rows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">No shot types registered.</div>
            ) : (
        <Card className="bg-slate-900 border-slate-800">
          <CardBody className="p-0 overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Shot Type Name</th>
                    <th className="py-3.5 px-4">Code Identifier</th>
                    <th className="py-3.5 px-4">Description</th>
                    <th className="py-3.5 px-4">State</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {(rows as MasterShotType[]).map((shot) => (
                    <tr key={shot.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400">
                            <Clapperboard className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-white">{shot.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-pink-300">{shot.code}</td>
                      <td className="py-3 px-4 text-slate-400 text-xs">{shot.description || '—'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={shot.status === 'active' ? 'success' : 'secondary'} className="text-xs uppercase font-mono">
                          {shot.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingShot(shot);
                              setShotForm({ name: shot.name, code: shot.code, description: shot.description || '' });
                            }}
                            disabled={!canShotUpdate}
                            title={canShotUpdate ? 'Edit' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {shot.status === 'active' ? (
                            <button
                              type="button"
                              onClick={() => archiveShotMutation.mutate(shot.id)}
                              disabled={!canShotArchive}
                              title={canShotArchive ? 'Archive' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 disabled:opacity-30"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreShotMutation.mutate(shot.id)}
                              disabled={!canShotRestore}
                              title={canShotRestore ? 'Restore' : 'Requires permission'}
                              className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 disabled:opacity-30"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteShotTarget(shot)}
                            disabled={!canShotDelete}
                            title={canShotDelete ? 'Delete' : 'Requires permission'}
                            className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 disabled:opacity-30"
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
            )
          }
        />
      )}

      {/* CREATE ASSET MODAL */}
      {isCreateAssetOpen && (
        <Modal isOpen={isCreateAssetOpen} onClose={() => setIsCreateAssetOpen(false)} title="Register Platform Asset Type">
          <form onSubmit={handleCreateAsset} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Asset Type Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Character, Vehicle, Prop"
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Code Slug (Optional)</label>
              <input
                type="text"
                placeholder="character"
                value={assetForm.code}
                onChange={(e) => setAssetForm({ ...assetForm, code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={assetForm.description}
                onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateAssetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={createAssetMutation.isPending}>
                Create Asset Type
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT ASSET MODAL */}
      {editingAsset && (
        <Modal isOpen={Boolean(editingAsset)} onClose={() => setEditingAsset(null)} title={`Edit Asset Type: ${editingAsset.name}`}>
          <form onSubmit={handleUpdateAsset} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Asset Type Name</label>
              <input
                type="text"
                required
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={assetForm.description}
                onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingAsset(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={updateAssetMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE SHOT MODAL */}
      {isCreateShotOpen && (
        <Modal isOpen={isCreateShotOpen} onClose={() => setIsCreateShotOpen(false)} title="Register Platform Shot Type">
          <form onSubmit={handleCreateShot} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Shot Type Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Live Action Plate, Full CG, Matte Painting"
                value={shotForm.name}
                onChange={(e) => setShotForm({ ...shotForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Code Slug (Optional)</label>
              <input
                type="text"
                placeholder="live_action"
                value={shotForm.code}
                onChange={(e) => setShotForm({ ...shotForm, code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={shotForm.description}
                onChange={(e) => setShotForm({ ...shotForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setIsCreateShotOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={createShotMutation.isPending}>
                Create Shot Type
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* EDIT SHOT MODAL */}
      {editingShot && (
        <Modal isOpen={Boolean(editingShot)} onClose={() => setEditingShot(null)} title={`Edit Shot Type: ${editingShot.name}`}>
          <form onSubmit={handleUpdateShot} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Shot Type Name</label>
              <input
                type="text"
                required
                value={shotForm.name}
                onChange={(e) => setShotForm({ ...shotForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                value={shotForm.description}
                onChange={(e) => setShotForm({ ...shotForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingShot(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={updateShotMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE ASSET CONFIRMATION */}
      {deleteAssetTarget && (
        <Modal isOpen={Boolean(deleteAssetTarget)} onClose={() => setDeleteAssetTarget(null)} title="Delete Asset Type">
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">Delete &quot;{deleteAssetTarget.name}&quot;?</p>
                <p className="text-xs text-slate-400 mt-1">This removes the asset taxonomy from global master definitions.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteAssetTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={async () => {
                await deleteAssetMutation.mutateAsync(deleteAssetTarget.id);
                setDeleteAssetTarget(null);
                addNotification({ type: 'success', title: 'Asset Type Deleted', message: `Deleted ${deleteAssetTarget.name}` });
              }}>Confirm Delete</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* DELETE SHOT CONFIRMATION */}
      {deleteShotTarget && (
        <Modal isOpen={Boolean(deleteShotTarget)} onClose={() => setDeleteShotTarget(null)} title="Delete Shot Type">
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">Delete &quot;{deleteShotTarget.name}&quot;?</p>
                <p className="text-xs text-slate-400 mt-1">This removes the shot taxonomy from global master definitions.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteShotTarget(null)}>Cancel</Button>
              <Button variant="danger" onClick={async () => {
                await deleteShotMutation.mutateAsync(deleteShotTarget.id);
                setDeleteShotTarget(null);
                addNotification({ type: 'success', title: 'Shot Type Deleted', message: `Deleted ${deleteShotTarget.name}` });
              }}>Confirm Delete</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
