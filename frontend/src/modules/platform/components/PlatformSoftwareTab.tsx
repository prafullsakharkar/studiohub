import { safeWebUrl } from '@/shared/utils/safeUrl';
import React, { useState } from 'react';
import {
  Terminal,
  Plus,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Layers,
  ExternalLink,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { Software, SoftwareVersion } from '@/types/masterData';
import { usePermissionEvaluator } from '@/core/permissions/usePermissionEvaluator';
import {
  usePlatformSoftwareList,
  usePlatformSoftwareVersions,
  useCreatePlatformSoftwareVersion,
  useUpdatePlatformSoftwareVersion,
  useArchivePlatformSoftwareVersion,
  useRestorePlatformSoftwareVersion,
  useDeletePlatformSoftwareVersion,
  useUpdatePlatformSoftware,
  useArchivePlatformSoftware,
  useRestorePlatformSoftware,
  useDeletePlatformSoftware,
} from '@/core/masterData/useMasterData';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { MasterDataTabShell, MasterDataItem } from '../admin/masterData/MasterDataTabShell';
import { masterDataEntities } from '../admin/masterData/masterDataEntities';

interface PlatformSoftwareTabProps {
  onOpenCreate: () => void;
}

export const PlatformSoftwareTab: React.FC<PlatformSoftwareTabProps> = ({
  onOpenCreate,
}) => {
  const { data: softwareList, isLoading } = usePlatformSoftwareList();
  const { can } = usePermissionEvaluator();
  const { addNotification } = useNotificationStore();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Drawer / Sub-modal states
  const [selectedSoftware, setSelectedSoftware] = useState<Software | null>(null);
  const [editingSoftware, setEditingSoftware] = useState<Software | null>(null);
  const [deleteSoftwareTarget, setDeleteSoftwareTarget] = useState<Software | null>(null);

  // Version management inside drawer
  const [isAddingVersion, setIsAddingVersion] = useState(false);
  const [editingVersion, setEditingVersion] = useState<SoftwareVersion | null>(null);
  const [newVersionForm, setNewVersionForm] = useState({
    version: '',
    version_code: '',
    release_date: new Date().toISOString().split('T')[0],
    end_of_support: '',
  });

  // Edit software form
  const [editSoftwareForm, setEditSoftwareForm] = useState({
    name: '',
    publisher: '',
    category: '',
    description: '',
    website: '',
  });

  // RBAC Permission checks (create is gated by the shell via masterDataEntities.software)
  const canUpdate = can('platform.software.update') || can('platform.master_data.update');
  const canArchive = can('platform.software.archive') || can('platform.master_data.archive');
  const canRestore = can('platform.software.restore') || can('platform.master_data.restore');
  const canDelete = can('platform.software.delete') || can('platform.master_data.delete');

  const canCreateVer = can('platform.software_version.create') || can('platform.software.create');
  const canUpdateVer = can('platform.software_version.update') || can('platform.software.update');
  const canArchiveVer = can('platform.software_version.archive') || can('platform.software.archive');
  const canRestoreVer = can('platform.software_version.restore') || can('platform.software.restore');
  const canDeleteVer = can('platform.software_version.delete') || can('platform.software.delete');

  // Mutations
  const updateSoftwareMutation = useUpdatePlatformSoftware();
  const archiveSoftwareMutation = useArchivePlatformSoftware();
  const restoreSoftwareMutation = useRestorePlatformSoftware();
  const deleteSoftwareMutation = useDeletePlatformSoftware();

  const { data: versionsList, isLoading: isVersionsLoading } = usePlatformSoftwareVersions(selectedSoftware?.id || '');
  const createVerMutation = useCreatePlatformSoftwareVersion();
  const updateVerMutation = useUpdatePlatformSoftwareVersion();
  const archiveVerMutation = useArchivePlatformSoftwareVersion();
  const restoreVerMutation = useRestorePlatformSoftwareVersion();
  const deleteVerMutation = useDeletePlatformSoftwareVersion();

  const shellItems: MasterDataItem[] = (softwareList || []).map((s) => ({
    ...s,
    is_archived: s.status !== 'active',
  }));

  const applyExtraFilter = (item: MasterDataItem) =>
    categoryFilter === 'all' || item.category === categoryFilter;

  const categories = Array.from(new Set((softwareList || []).map((s) => s.category)));

  // Handlers for Software
  const handleOpenEdit = (software: Software) => {
    setEditingSoftware(software);
    setEditSoftwareForm({
      name: software.name,
      publisher: software.publisher,
      category: software.category,
      description: software.description || '',
      website: software.website || '',
    });
  };

  const handleSaveEditSoftware = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSoftware) return;
    try {
      await updateSoftwareMutation.mutateAsync({
        id: editingSoftware.id,
        data: editSoftwareForm,
      });
      setEditingSoftware(null);
      addNotification({
        type: 'success',
        title: 'Software Updated',
        message: `Saved updates for ${editSoftwareForm.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update software.',
      });
    }
  };

  const handleArchiveSoftware = async (software: Software) => {
    try {
      await archiveSoftwareMutation.mutateAsync(software.id);
      addNotification({
        type: 'info',
        title: 'Software Archived',
        message: `Archived ${software.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Archive Failed',
        message: err.message || 'Could not archive software.',
      });
    }
  };

  const handleRestoreSoftware = async (software: Software) => {
    try {
      await restoreSoftwareMutation.mutateAsync(software.id);
      addNotification({
        type: 'success',
        title: 'Software Restored',
        message: `Restored ${software.name} to active catalog.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Restore Failed',
        message: err.message || 'Could not restore software.',
      });
    }
  };

  const handleDeleteSoftware = async () => {
    if (!deleteSoftwareTarget) return;
    try {
      await deleteSoftwareMutation.mutateAsync(deleteSoftwareTarget.id);
      setDeleteSoftwareTarget(null);
      addNotification({
        type: 'success',
        title: 'Software Removed',
        message: `Deleted ${deleteSoftwareTarget.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: err.message || 'Could not delete software.',
      });
    }
  };

  // Handlers for Versions
  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSoftware) return;
    try {
      await createVerMutation.mutateAsync({
        softwareId: selectedSoftware.id,
        data: {
          version: newVersionForm.version,
          version_code: newVersionForm.version_code || `${selectedSoftware.code}-${newVersionForm.version}`.toLowerCase().replace(/\s+/g, '-'),
          release_date: newVersionForm.release_date,
          end_of_support: newVersionForm.end_of_support || null,
        },
      });
      setIsAddingVersion(false);
      setNewVersionForm({
        version: '',
        version_code: '',
        release_date: new Date().toISOString().split('T')[0],
        end_of_support: '',
      });
      addNotification({
        type: 'success',
        title: 'Version Added',
        message: `Added version ${newVersionForm.version} to ${selectedSoftware.name}.`,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Version Creation Failed',
        message: err.message || 'Could not add version.',
      });
    }
  };

  const handleArchiveVersion = async (ver: SoftwareVersion) => {
    if (!selectedSoftware) return;
    try {
      await archiveVerMutation.mutateAsync({ softwareId: selectedSoftware.id, versionId: ver.id });
      addNotification({ type: 'info', title: 'Version Archived', message: `Archived v${ver.version}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleRestoreVersion = async (ver: SoftwareVersion) => {
    if (!selectedSoftware) return;
    try {
      await restoreVerMutation.mutateAsync({ softwareId: selectedSoftware.id, versionId: ver.id });
      addNotification({ type: 'success', title: 'Version Restored', message: `Restored v${ver.version}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleDeleteVersion = async (ver: SoftwareVersion) => {
    if (!selectedSoftware) return;
    try {
      await deleteVerMutation.mutateAsync({ softwareId: selectedSoftware.id, versionId: ver.id });
      addNotification({ type: 'success', title: 'Version Deleted', message: `Deleted v${ver.version}.` });
    } catch (err: any) {
      addNotification({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <MasterDataTabShell
        entity={masterDataEntities.software}
        items={shellItems}
        isLoading={isLoading}
        onCreate={onOpenCreate}
        createLabel="Register DCC Software"
        searchFields={['name', 'code', 'publisher', 'category']}
        extraFilters={
          <select
            aria-label="Category filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        }
        applyExtraFilter={applyExtraFilter}
        renderTable={(rows) =>
          rows.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <Terminal className="w-12 h-12 text-slate-600 mx-auto" />
              <p className="text-slate-400 text-sm">No software definitions found matching filters.</p>
            </div>
          ) : (
      <Card className="bg-slate-900 border-slate-800">
        <CardBody className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Software / Tool</th>
                  <th className="py-3.5 px-4">Code Identifier</th>
                  <th className="py-3.5 px-4">Publisher</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Versions</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-sm">
                {(rows as Software[]).map((software) => (
                  <tr key={software.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                          <Terminal className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {software.name}
                            {safeWebUrl(software.website) && (
                              <a
                                href={safeWebUrl(software.website)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-500 hover:text-cyan-400 transition"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                          {software.description && (
                            <p className="text-xs text-slate-400 truncate max-w-xs">{software.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-cyan-300">{software.code}</td>
                    <td className="py-3 px-4 text-slate-300">{software.publisher}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-xs bg-slate-800/80 text-slate-300 border-slate-700">
                        {software.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => setSelectedSoftware(software)}
                        className="flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Manage Versions ({software.version_count ?? 0})
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={software.status === 'active' ? 'success' : 'secondary'}
                        className="text-xs font-mono uppercase"
                      >
                        {software.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(software)}
                          disabled={!canUpdate}
                          title={canUpdate ? 'Edit software metadata' : 'Requires platform.software.update'}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {software.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => handleArchiveSoftware(software)}
                            disabled={!canArchive}
                            title={canArchive ? 'Archive software' : 'Requires platform.software.archive'}
                            className="p-1.5 rounded hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestoreSoftware(software)}
                            disabled={!canRestore}
                            title={canRestore ? 'Restore software' : 'Requires platform.software.restore'}
                            className="p-1.5 rounded hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setDeleteSoftwareTarget(software)}
                          disabled={!canDelete}
                          title={canDelete ? 'Delete software definition' : 'Requires platform.software.delete'}
                          className="p-1.5 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
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

      {/* VERSIONS DRAWER / MODAL */}
      {selectedSoftware && (
        <Modal
          isOpen={Boolean(selectedSoftware)}
          onClose={() => {
            setSelectedSoftware(null);
            setIsAddingVersion(false);
          }}
          title={`Versions: ${selectedSoftware.name} (${selectedSoftware.code})`}
          size="lg"
        >
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <p className="text-xs text-slate-400">
                Manage released executable builds, support lifecycles, and version code identifiers.
              </p>
              {!isAddingVersion && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                  disabled={!canCreateVer}
                  title={canCreateVer ? 'Add version' : 'Requires platform.software_version.create'}
                  onClick={() => setIsAddingVersion(true)}
                >
                  Add Version
                </Button>
              )}
            </div>

            {isAddingVersion && (
              <form onSubmit={handleCreateVersion} className="p-4 rounded-xl bg-slate-950 border border-cyan-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-cyan-400 uppercase">New Version Specification</h4>
                  <button type="button" onClick={() => setIsAddingVersion(false)} className="text-slate-500 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Version String (e.g. 2026.1)</label>
                    <input
                      type="text"
                      required
                      placeholder="2026.1"
                      value={newVersionForm.version}
                      onChange={(e) => setNewVersionForm({ ...newVersionForm, version: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Version Code (Slug)</label>
                    <input
                      type="text"
                      placeholder="maya-2026-1"
                      value={newVersionForm.version_code}
                      onChange={(e) => setNewVersionForm({ ...newVersionForm, version_code: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Release Date</label>
                    <input
                      type="date"
                      value={newVersionForm.release_date}
                      onChange={(e) => setNewVersionForm({ ...newVersionForm, release_date: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">End of Support (Optional)</label>
                    <input
                      type="date"
                      value={newVersionForm.end_of_support}
                      onChange={(e) => setNewVersionForm({ ...newVersionForm, end_of_support: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAddingVersion(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={createVerMutation.isPending}>
                    Save Version
                  </Button>
                </div>
              </form>
            )}

            {isVersionsLoading ? (
              <div className="py-8 flex justify-center">
                <LoadingSpinner />
              </div>
            ) : !versionsList || versionsList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No versions registered yet for {selectedSoftware.name}.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {versionsList.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-white text-sm">v{ver.version}</span>
                        <span className="text-xs font-mono text-slate-500">({ver.version_code})</span>
                        <Badge
                          variant={ver.status === 'active' ? 'success' : 'secondary'}
                          className="text-[10px] uppercase font-mono"
                        >
                          {ver.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span>Released: {ver.release_date || 'N/A'}</span>
                        {ver.end_of_support && <span>EOS: {ver.end_of_support}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {ver.status === 'active' ? (
                        <button
                          type="button"
                          onClick={() => handleArchiveVersion(ver)}
                          disabled={!canArchiveVer}
                          title={canArchiveVer ? 'Archive version' : 'Requires permission'}
                          className="p-1 rounded text-slate-400 hover:text-amber-400 disabled:opacity-30"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(ver)}
                          disabled={!canRestoreVer}
                          title={canRestoreVer ? 'Restore version' : 'Requires permission'}
                          className="p-1 rounded text-slate-400 hover:text-emerald-400 disabled:opacity-30"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteVersion(ver)}
                        disabled={!canDeleteVer}
                        title={canDeleteVer ? 'Delete version' : 'Requires permission'}
                        className="p-1 rounded text-slate-400 hover:text-red-400 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* EDIT SOFTWARE MODAL */}
      {editingSoftware && (
        <Modal
          isOpen={Boolean(editingSoftware)}
          onClose={() => setEditingSoftware(null)}
          title={`Edit Software: ${editingSoftware.name}`}
        >
          <form onSubmit={handleSaveEditSoftware} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Software Display Name</label>
              <input
                type="text"
                required
                value={editSoftwareForm.name}
                onChange={(e) => setEditSoftwareForm({ ...editSoftwareForm, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Publisher</label>
                <input
                  type="text"
                  required
                  value={editSoftwareForm.publisher}
                  onChange={(e) => setEditSoftwareForm({ ...editSoftwareForm, publisher: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Category</label>
                <input
                  type="text"
                  required
                  value={editSoftwareForm.category}
                  onChange={(e) => setEditSoftwareForm({ ...editSoftwareForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Website URL</label>
              <input
                type="url"
                value={editSoftwareForm.website}
                onChange={(e) => setEditSoftwareForm({ ...editSoftwareForm, website: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
              <textarea
                rows={3}
                value={editSoftwareForm.description}
                onChange={(e) => setEditSoftwareForm({ ...editSoftwareForm, description: e.target.value })}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setEditingSoftware(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={updateSoftwareMutation.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteSoftwareTarget && (
        <Modal
          isOpen={Boolean(deleteSoftwareTarget)}
          onClose={() => setDeleteSoftwareTarget(null)}
          title="Confirm Software Deletion"
        >
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">Delete &quot;{deleteSoftwareTarget.name}&quot;?</p>
                <p className="text-xs text-slate-400 mt-1">
                  If this software has registered active versions or is referenced by tenant organizations, it will be safely archived instead of hard-deleted to preserve database integrity.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteSoftwareTarget(null)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteSoftware} isLoading={deleteSoftwareMutation.isPending}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
