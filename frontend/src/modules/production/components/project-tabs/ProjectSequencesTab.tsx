import React, { useState } from 'react';
import {
  Film,
  Layers,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ExternalLink,
  Users,
  Sparkles,
  Filter,
  Tv,
  AlertCircle,
} from 'lucide-react';
import { Project, isEpisodicProject } from '@/types/production';
import { useProjectSequences, useProjectEpisodes } from '../../hooks/useProjectScopedData';
import { useSequenceMutations } from '@/modules/sequences';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { SearchInput } from '@/shared/components/SearchInput';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectSequencesTabProps {
  project: Project;
  onNavigateTab: (tabId: string, filter?: any) => void;
}

export const ProjectSequencesTab: React.FC<ProjectSequencesTabProps> = ({ project, onNavigateTab }) => {
  const isEpisodic = isEpisodicProject(project);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [episodeFilter, setEpisodeFilter] = useState('ALL');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDept, setNewDept] = useState('Compositing');
  const [newComplexity, setNewComplexity] = useState<'Extreme' | 'High' | 'Medium' | 'Low'>('Extreme');
  const [newEpisodeId, setNewEpisodeId] = useState('');

  const addNotification = useNotificationStore((s) => s.addNotification);

  const { data: sequencesData, isLoading, refetch } = useProjectSequences(project.id, {
    search: search || undefined,
  });

  const { data: episodesData } = useProjectEpisodes(project.id);
  const episodes = episodesData?.results || [];

  const { createSequence, isCreating } = useSequenceMutations();

  const sequences = sequencesData?.results || [];

  const filteredSequences = sequences.filter((seq) => {
    if (statusFilter !== 'ALL' && seq.status !== statusFilter) return false;
    if (isEpisodic && episodeFilter !== 'ALL') {
      if (seq.episode_id !== episodeFilter && seq.episode_code !== episodeFilter) return false;
    }
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;

    if (isEpisodic && !newEpisodeId) {
      addNotification({
        type: 'error',
        title: 'Episode Required',
        message: 'Please select an episode for this sequence in episodic projects.',
      });
      return;
    }

    const selectedEp = episodes.find((ep) => ep.id === newEpisodeId);

    try {
      await createSequence({
        project_id: project.id,
        project_code: project.code,
        episode_id: isEpisodic ? newEpisodeId : undefined,
        episode_code: selectedEp?.code,
        episode_name: selectedEp?.name,
        code: newCode.trim().toUpperCase(),
        name: newName.trim(),
        description: newDesc.trim(),
        department: newDept,
        complexity: newComplexity as any,
        status: 'In Progress',
        start_frame: 1001,
        end_frame: 2500,
        shot_count: 0,
        approved_shots: 0,
        in_progress_shots: 0,
      });

      addNotification({
        type: 'success',
        title: 'Sequence Created',
        message: `Sequence ${newCode} added to project ${project.code}`,
      });

      setIsCreateOpen(false);
      setNewCode('');
      setNewName('');
      setNewDesc('');
      setNewEpisodeId('');
      refetch();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Failed to create sequence',
        message: err.message || 'Error occurred',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Episodic Notice if No Episodes Exist */}
      {isEpisodic && episodes.length === 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Episodic Show Setup Required</h4>
              <p className="text-xs text-slate-300">
                This project uses an Episodic workflow. Create an episode before structuring sequences.
              </p>
            </div>
          </div>
          <Button
            size="xs"
            variant="primary"
            leftIcon={<Tv className="w-3.5 h-3.5" />}
            onClick={() => onNavigateTab('episodes')}
          >
            Go to Episodes
          </Button>
        </div>
      )}

      {/* Top Banner / Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Total Sequences</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-1">{sequences.length}</p>
          <span className="text-[11px] text-slate-500">In show container</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Total Sequence Shots</span>
            <Film className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {sequences.reduce((acc, s) => acc + (s.shot_count || 0), 0)}
          </p>
          <span className="text-[11px] text-emerald-500/80">
            {sequences.reduce((acc, s) => acc + (s.approved_shots || 0), 0)} approved
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Completion</span>
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {sequences.length > 0
              ? Math.round(
                  (sequences.reduce((acc, s) => acc + (s.approved_shots || 0), 0) /
                    Math.max(1, sequences.reduce((acc, s) => acc + (s.shot_count || 0), 0))) *
                    100
                )
              : 0}
            %
          </p>
          <span className="text-[11px] text-cyan-500/80">Approved percentage</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">Hero Sequences</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {sequences.filter((s) => s.complexity === 'Extreme' || s.complexity === 'High').length}
          </p>
          <span className="text-[11px] text-amber-500/80">High complexity passes</span>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
          <SearchInput
            placeholder="Search sequence code, title, lead artist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end flex-wrap">
          {isEpisodic && episodes.length > 0 && (
            <select
              value={episodeFilter}
              onChange={(e) => setEpisodeFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Episodes</option>
              {episodes.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.code} - {ep.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 font-mono focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="In Progress">In Progress</option>
            <option value="Approved">Approved</option>
            <option value="On Hold">On Hold</option>
            <option value="Archived">Archived</option>
          </select>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (isEpisodic && episodes.length > 0 && !newEpisodeId) {
                setNewEpisodeId(episodes[0].id);
              }
              setIsCreateOpen(true);
            }}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Sequence
          </Button>
        </div>
      </div>

      {/* Sequences Grid */}
      {isLoading ? (
        <div className="py-16 flex justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredSequences.length === 0 ? (
        <EmptyState
          title="No Sequences Found"
          description={`No production sequences match the search query in ${project.name}.`}
          actionLabel="Create Sequence"
          onAction={() => {
            if (isEpisodic && episodes.length > 0 && !newEpisodeId) {
              setNewEpisodeId(episodes[0].id);
            }
            setIsCreateOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredSequences.map((seq) => (
            <div
              key={seq.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {seq.code}
                    </span>

                    {isEpisodic && (seq.episode_code || seq.episode_name) && (
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                        <Tv className="w-3 h-3" />
                        {seq.episode_code || seq.episode_name}
                      </span>
                    )}

                    <span className="font-mono text-xs text-slate-400">{seq.department}</span>
                    <StatusBadge status={seq.status} />
                  </div>

                  <h3 className="text-base font-bold text-white tracking-tight">{seq.name}</h3>
                </div>

                <div className="text-right font-mono text-xs text-slate-400 shrink-0">
                  <span className="text-white font-bold">{seq.shot_count} shots</span>
                  <p className="text-[11px] text-emerald-400">{seq.approved_shots} approved</p>
                </div>
              </div>

              {seq.description && (
                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/50">
                  {seq.description}
                </p>
              )}

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Shot Approval Progress</span>
                  <span className="text-indigo-400">
                    {(seq.shot_count ?? 0) > 0
                      ? Math.round(((seq.approved_shots ?? 0) / (seq.shot_count ?? 1)) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/80">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${
                        (seq.shot_count ?? 0) > 0
                          ? ((seq.approved_shots ?? 0) / (seq.shot_count ?? 1)) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Action row */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                <span className="font-mono text-[11px] text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Lead: <strong className="text-slate-200">{seq.lead_artist || 'Unassigned'}</strong>
                </span>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onNavigateTab('shots', {
                      sequence_code: seq.code,
                      ...(seq.episode_code ? { episode_code: seq.episode_code } : {}),
                    })
                  }
                  leftIcon={<Film className="w-3.5 h-3.5" />}
                >
                  View Shots ({seq.shot_count})
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Sequence Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Production Sequence"
        subtitle={`Add new sequence container to ${project.name} (${project.code})`}
      >
        <form onSubmit={handleCreate} className="space-y-4">
          {isEpisodic && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-purple-400" />
                Target Episode <span className="text-rose-400">*</span>
              </label>
              {episodes.length === 0 ? (
                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800 text-xs text-rose-300 flex items-center justify-between">
                  <span>No episodes found. Please create an episode first.</span>
                  <Button
                    size="xs"
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      onNavigateTab('episodes');
                    }}
                  >
                    Go to Episodes
                  </Button>
                </div>
              ) : (
                <select
                  required
                  value={newEpisodeId}
                  onChange={(e) => setNewEpisodeId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="" disabled>
                    Select an Episode
                  </option>
                  {episodes.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.code} - {ep.name} (Season {ep.season_number || 1}, Ep {ep.episode_number || 1})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Sequence Code</label>
              <input
                required
                type="text"
                placeholder={isEpisodic ? 'e.g. EP101_SQ01' : 'e.g. NK_010'}
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Department</label>
              <select
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                <option value="Compositing">Compositing</option>
                <option value="Animation">Animation</option>
                <option value="Lighting">Lighting</option>
                <option value="FX">FX & Simulation</option>
                <option value="Layout">Layout</option>
                <option value="Matte Painting">Matte Painting</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Sequence Name / Title</label>
            <input
              required
              type="text"
              placeholder="e.g. Neon Canyon Spinner Chase"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Complexity Class</label>
            <select
              value={newComplexity}
              onChange={(e) => setNewComplexity(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:ring-1 focus:ring-indigo-500 font-mono"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Extreme">Extreme</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description / Narrative Context</label>
            <textarea
              rows={3}
              placeholder="Detail the sequence story beat, camera dynamics, and major visual effects scope..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isCreating || (isEpisodic && episodes.length === 0)}
            >
              {isCreating ? 'Creating...' : 'Create Sequence'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
