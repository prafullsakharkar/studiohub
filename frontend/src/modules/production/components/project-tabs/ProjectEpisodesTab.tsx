import React, { useState } from 'react';
import {
  Tv,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Layers,
  Sparkles,
  Filter,
  Edit,
  Archive,
  RotateCcw,
  Trash2,
  Calendar,
  Film,
} from 'lucide-react';
import { Project } from '@/types/production';
import { Episode } from '@/types/production';
import { useProjectEpisodes } from '../../hooks/useProjectScopedData';
import { useEpisodeMutations } from '@/modules/episodes';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { usePermissions } from '@/core/permissions';

interface ProjectEpisodesTabProps {
  project: Project;
  onNavigateTab: (tabId: string, filter?: any) => void;
}

export const ProjectEpisodesTab: React.FC<ProjectEpisodesTabProps> = ({ project, onNavigateTab }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSeason, setNewSeason] = useState(1);
  const [newEpNum, setNewEpNum] = useState(1);
  const [newAirDate, setNewAirDate] = useState('');
  const [newDeliveryDate, setNewDeliveryDate] = useState('');

  // Edit Modal State
  const [editingEpisode, setEditingEpisode] = useState<Episode | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState('In Progress');
  const [editAirDate, setEditAirDate] = useState('');
  const [editDeliveryDate, setEditDeliveryDate] = useState('');

  const addNotification = useNotificationStore((s) => s.addNotification);
  const { can } = usePermissions();

  const canCreate = can('episode.create');
  const canUpdate = can('episode.update');
  const canArchive = can('episode.archive');
  const canRestore = can('episode.restore');

  // Episodes read from the canonical DRF endpoint (/api/v1/episodes/?project_id=).
  const {
    data: episodesData,
    isLoading,
    refetch,
  } = useProjectEpisodes(project.id, {
    search: search || undefined,
    include_deleted: includeArchived,
  });

  const {
    createEpisode,
    updateEpisode,
    archiveEpisode,
    restoreEpisode,
    deleteEpisode,
    isCreating,
    isUpdating,
  } = useEpisodeMutations();

  const episodes = episodesData?.results || [];

  const filteredEpisodes = episodes.filter((ep) => {
    if (statusFilter !== 'ALL' && ep.status !== statusFilter) return false;
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    try {
      await createEpisode({
        project_id: project.id,
        project_code: project.code,
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        description: newDesc.trim(),
        season_number: Number(newSeason),
        episode_number: Number(newEpNum),
        air_date: newAirDate || undefined,
        delivery_date: newDeliveryDate || undefined,
        status: 'In Progress',
        sequence_count: 0,
        shot_count: 0,
      });

      setIsCreateOpen(false);
      setNewCode('');
      setNewName('');
      setNewDesc('');
      setNewAirDate('');
      setNewDeliveryDate('');
      refetch();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Error Creating Episode',
        message: err?.message || 'Failed to create episode',
      });
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEpisode) return;

    try {
      await updateEpisode({
        id: editingEpisode.id,
        data: {
          name: editName.trim(),
          description: editDesc.trim(),
          status: editStatus,
          air_date: editAirDate || undefined,
          delivery_date: editDeliveryDate || undefined,
        },
      });

      setEditingEpisode(null);
      refetch();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Update Error',
        message: err?.message || 'Failed to update episode',
      });
    }
  };

  const openEditModal = (ep: Episode) => {
    setEditingEpisode(ep);
    setEditName(ep.name);
    setEditDesc(ep.description || '');
    setEditStatus(ep.status || 'In Progress');
    setEditAirDate(ep.air_date || '');
    setEditDeliveryDate(ep.delivery_date || '');
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('Are you sure you want to archive this episode?')) return;
    try {
      await archiveEpisode(id);
      refetch();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Archive Failed',
        message: err?.message || 'Failed to archive episode',
      });
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await restoreEpisode(id);
      refetch();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Restore Failed',
        message: err?.message || 'Failed to restore episode',
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await archiveEpisode(id);
    }
    setSelectedIds([]);
    refetch();
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    for (const id of selectedIds) {
      await restoreEpisode(id);
    }
    setSelectedIds([]);
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-64">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search episodes by code, name, description..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="In Progress">In Progress</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Approved">Approved</option>
              <option value="Delivered">Delivered</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
            />
            <span>Include Archived</span>
          </label>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs text-slate-400">{selectedIds.length} selected</span>
              {canArchive && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkArchive}
                  className="text-xs text-amber-400 hover:bg-amber-950/40"
                >
                  <Archive className="w-3.5 h-3.5 mr-1" /> Archive Selected
                </Button>
              )}
              {canRestore && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkRestore}
                  className="text-xs text-emerald-400 hover:bg-emerald-950/40"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore Selected
                </Button>
              )}
            </div>
          )}

          {canCreate && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setNewCode(`${project.code}_EP${episodes.length + 1 < 10 ? '0' : ''}${episodes.length + 1}`);
                setNewEpNum(episodes.length + 1);
                setIsCreateOpen(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <Plus className="w-4 h-4 mr-1.5" /> New Episode
            </Button>
          )}
        </div>
      </div>

      {/* Episodes Table / List */}
      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner size="lg" label="Loading project episodes..." />
        </div>
      ) : filteredEpisodes.length === 0 ? (
        <EmptyState
          icon={<Tv className="w-6 h-6" />}
          title="No episodes found"
          description={
            search || statusFilter !== 'ALL'
              ? 'No episodes match your search criteria.'
              : 'This episodic project has no episodes configured yet. An episode is required before creating sequences and shots.'
          }
          action={
            canCreate && !search && statusFilter === 'ALL' ? (
              <Button
                variant="primary"
                onClick={() => {
                  setNewCode(`${project.code}_EP01`);
                  setNewEpNum(1);
                  setIsCreateOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Create First Episode
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredEpisodes.length && filteredEpisodes.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredEpisodes.map((ep) => ep.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                  />
                </th>
                <th className="py-3 px-4">Code / ID</th>
                <th className="py-3 px-4">Episode Title</th>
                <th className="py-3 px-4">Season / Ep</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sequences</th>
                <th className="py-3 px-4">Air Date</th>
                <th className="py-3 px-4">Delivery Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filteredEpisodes.map((ep) => {
                const isSelected = selectedIds.includes(ep.id);
                return (
                  <tr
                    key={ep.id}
                    className={`hover:bg-slate-850/60 transition-colors ${
                      isSelected ? 'bg-indigo-950/20' : ''
                    } ${ep.is_deleted || ep.archived ? 'opacity-60 bg-slate-950/40' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(ep.id)}
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span className="font-mono font-bold text-white text-xs tracking-tight">
                          {ep.code}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">{ep.name}</div>
                      {ep.description && (
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">
                          {ep.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                      S{ep.season_number || 1} : E{ep.episode_number || 1}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={ep.status || 'In Progress'} />
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => onNavigateTab('sequences', { episode_id: ep.id })}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-800/80 hover:bg-indigo-950 hover:text-indigo-300 border border-slate-700 rounded text-slate-300 text-[11px] font-mono transition-colors"
                      >
                        <Layers className="w-3 h-3 text-indigo-400" />
                        <span>{ep.sequence_count || 0} Sequences</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {ep.air_date || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {ep.delivery_date || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onNavigateTab('sequences', { episode_id: ep.id })}
                          title="View Sequences"
                          className="h-7 w-7 p-0 text-slate-400 hover:text-indigo-400"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </Button>
                        {canUpdate && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditModal(ep)}
                            title="Edit Episode"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {ep.is_deleted || ep.archived ? (
                          canRestore && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRestore(ep.id)}
                              title="Restore Episode"
                              className="h-7 w-7 p-0 text-emerald-400 hover:text-emerald-300"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )
                        ) : (
                          canArchive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleArchive(ep.id)}
                              title="Archive Episode"
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-400"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Episode Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create New Episode"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Episode Code *</label>
              <input
                type="text"
                required
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. SOL_EP01"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Episode Name / Title *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. The Arrival"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Season Number</label>
              <input
                type="number"
                min="1"
                value={newSeason}
                onChange={(e) => setNewSeason(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Episode Number</label>
              <input
                type="number"
                min="1"
                value={newEpNum}
                onChange={(e) => setNewEpNum(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Target Air Date</label>
              <input
                type="date"
                value={newAirDate}
                onChange={(e) => setNewAirDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Delivery Date</label>
              <input
                type="date"
                value={newDeliveryDate}
                onChange={(e) => setNewDeliveryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Synopsis / Description</label>
            <textarea
              rows={3}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Key plot beats and turnover requirements for this episode..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isCreating || !newCode.trim() || !newName.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {isCreating ? 'Creating...' : 'Create Episode'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Episode Modal */}
      <Modal
        isOpen={Boolean(editingEpisode)}
        onClose={() => setEditingEpisode(null)}
        title={`Edit Episode: ${editingEpisode?.code}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Episode Name *</label>
            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Approved">Approved</option>
              <option value="Delivered">Delivered</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Air Date</label>
              <input
                type="date"
                value={editAirDate}
                onChange={(e) => setEditAirDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Delivery Date</label>
              <input
                type="date"
                value={editDeliveryDate}
                onChange={(e) => setEditDeliveryDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingEpisode(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isUpdating || !editName.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {isUpdating ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
