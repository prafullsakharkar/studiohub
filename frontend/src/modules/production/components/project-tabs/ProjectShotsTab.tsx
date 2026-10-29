import { useShots, useShotMutations, useBulkShots, ShotBulkManager } from '@/modules/shots';

import React, { useState, useEffect } from 'react';

import { SmartImg } from '@/components/ui/SmartImg';

import {

  Film,

  Plus,

  LayoutGrid,

  List,

  Search,

  CheckCircle2,

  Clock,

  Eye,

  Sliders,

  ExternalLink,

  Layers,

  Archive,

  RotateCcw,

  Tv,

} from 'lucide-react';

import { Project, isEpisodicProject } from '@/types/production';

import { useProjectEpisodes, useProjectSequences } from '../../hooks/useProjectScopedData';

import { useEpisodeMutations } from '@/modules/episodes';

import { useSequenceMutations } from '@/modules/sequences';

import { StatusBadge } from '@/shared/components/StatusBadge';

import { Button } from '@/shared/components/Button';

import { Card, CardBody } from '@/shared/components/Card';

import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

import { EmptyState } from '@/shared/components/EmptyState';

import { Modal } from '@/shared/components/Modal';

import { SearchInput } from '@/shared/components/SearchInput';

import { useInspectorStore } from '@/shared/stores/useInspectorStore';

import { Link } from 'react-router-dom';


import { WorkspaceOpenButton } from '@/shared/workspace/canonical/WorkspaceButtons';

import { ProductionStatus } from '@/types/common';

import { BulkUpdatePanel, FieldDefinition } from '@/shared/components/bulk/BulkUpdatePanel';

import { BulkActionBar } from '@/shared/components/bulk/BulkActionBar';

import { PermissionButton } from '@/core/permissions/PermissionComponents';

import { WorkflowStateTransitionControl } from '@/core/permissions/components/WorkflowStateTransitionControl';

// REST-only shim: mock engine removed; backend is the source of truth.
import type { Shot } from '@/types/production';

interface ProjectShotsTabProps {

  project: Project;

  onNavigateTab: (tabId: string) => void;

}

const SHOT_UPDATE_FIELDS: FieldDefinition[] = [

  {

    key: 'status',

    label: 'Production Status',

    type: 'select',

    options: ['Not Started', 'In Progress', 'Ready for Review', 'Approved', 'On Hold', 'Archived'],

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

    options: ['Compositing', 'Animation', 'Lighting', 'FX', 'Layout', 'Matte Painting'],

  },

  {

    key: 'assigned_artist_name',

    label: 'Assigned Artist',

    type: 'text',

    placeholder: 'e.g. Elena Rostova',

  },

  {

    key: 'handle_frames',

    label: 'Handles (Frames)',

    type: 'number',

    placeholder: '8',

  },

  {

    key: 'notes',

    label: 'Turnover Notes',

    type: 'text',

    placeholder: 'Bulk notes or revision requirements',

  },

];

export const ProjectShotsTab: React.FC<ProjectShotsTabProps> = ({ project }) => {

  const [search, setSearch] = useState('');

  const [statusFilter, setStatusFilter] = useState('ALL');

  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false);

  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);

  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);

  const openInspector = useInspectorStore((state) => state.openInspector);

  const { data: shotsData, isLoading, refetch } = useShots({

    project_id: project.id,

    search: search || undefined,

    status: statusFilter !== 'ALL' ? statusFilter : undefined,

    include_deleted: includeDeleted,

    page_size: 50,

  });

  const { createShot, updateShot, isCreating } = useShotMutations();

  const { bulkUpdate, bulkArchive, bulkRestore } = useBulkShots();

  const isEpisodic = isEpisodicProject(project);

  const { data: episodesData, refetch: refetchEpisodes } = useProjectEpisodes(project.id);

  const episodes = episodesData?.results || [];

  const { data: sequencesData, refetch: refetchSequences } = useProjectSequences(project.id);

  const projectSequences = sequencesData?.results || [];

  const { createEpisode, isCreating: isCreatingEpisode } = useEpisodeMutations();

  const { createSequence } = useSequenceMutations();

  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');

  const [episodeError, setEpisodeError] = useState('');

  const [isEpisodeCreateOpen, setIsEpisodeCreateOpen] = useState(false);

  const [pendingShotForm, setPendingShotForm] = useState<typeof formData | null>(null);

  const [pendingEpisode, setPendingEpisode] = useState({

    code: '',

    name: '',

    description: '',

    season: 1,

    number: 1,

    airDate: '',

    deliveryDate: '',

  });

  // Revalidate the episode selection when the project changes or episodes
  // load: standard projects carry no episode; stale selections reset to
  // episodes[0] so the required picker always submits a live id chain.
  useEffect(() => {

    if (!isEpisodic) {

      setSelectedEpisodeId('');

      setEpisodeError('');

      return;

    }

    if (episodes.length === 0) {

      setSelectedEpisodeId('');

      return;

    }

    if (!episodes.some((ep) => ep.id === selectedEpisodeId)) {

      setSelectedEpisodeId(episodes[0].id);

    }

  }, [isEpisodic, project.id, episodes, selectedEpisodeId]);

  const openCreate = () => {

    if (isEpisodic && episodes.length > 0 && !selectedEpisodeId) {

      setSelectedEpisodeId(episodes[0].id);

    }

    setEpisodeError('');

    setIsCreateOpen(true);

  };

  const openEpisodeCreate = () => {

    setPendingShotForm({ ...formData });

    setIsEpisodeCreateOpen(true);

  };

  const handleCreateEpisode = async (e: React.FormEvent) => {

    e.preventDefault();

    if (!pendingEpisode.code.trim() || !pendingEpisode.name.trim()) return;

    const created = await createEpisode({

      project_id: project.id,

      project_code: project.code,

      code: pendingEpisode.code.trim().toUpperCase(),

      name: pendingEpisode.name.trim(),

      description: pendingEpisode.description.trim(),

      season_number: Number(pendingEpisode.season),

      episode_number: Number(pendingEpisode.number),

      air_date: pendingEpisode.airDate || undefined,

      delivery_date: pendingEpisode.deliveryDate || undefined,

      status: 'In Progress',

      sequence_count: 0,

      shot_count: 0,

    });

    if (pendingShotForm) {

      setFormData({ ...pendingShotForm });

    }

    if (created?.id) {

      setSelectedEpisodeId(created.id);

    }

    setPendingEpisode({

      code: '',

      name: '',

      description: '',

      season: 1,

      number: 1,

      airDate: '',

      deliveryDate: '',

    });

    setIsEpisodeCreateOpen(false);

    refetchEpisodes();

  };

  // Bulk inline-parent creation, backed by the real episode/sequence
  // mutations so the ShotBulkManager continue-flows work in production.
  const handleBulkCreateEpisode = async (input: {
    project_id: string;
    project_code: string;
    code: string;
    name: string;
  }) => {
    const created = await createEpisode({

      project_id: input.project_id,

      project_code: input.project_code,

      code: input.code,

      name: input.name,

      season_number: 1,

      episode_number: episodes.length + 1,

      status: 'In Progress',

      sequence_count: 0,

      shot_count: 0,

    });

    refetchEpisodes();

    return created;
  };

  const handleBulkCreateSequence = async (input: {
    project_id: string;
    project_code: string;
    episode_id: string;
    code: string;
  }) => {
    const targetEp = episodes.find((ep) => ep.id === input.episode_id);

    const created = await createSequence({

      project_id: input.project_id,

      project_code: input.project_code,

      episode_id: input.episode_id,

      episode_code: targetEp?.code,

      episode_name: targetEp?.name,

      code: input.code.trim().toUpperCase(),

      name: input.code.trim().toUpperCase(),

      status: 'In Progress',

      start_frame: 1001,

      end_frame: 2500,

      shot_count: 0,

      approved_shots: 0,

      in_progress_shots: 0,

    });

    refetchSequences();

    return created;
  };

  const [formData, setFormData] = useState({

    code: `${project.code}_010_`,

    name: '',

    sequence_code: `${project.code}_010`,

    description: '',

    frame_in: 1001,

    frame_out: 1120,

    handle_frames: 8,

    assigned_artist_name: 'Elena Rostova',

  });

  const shots = shotsData?.results || [];

  const selectedShots = shots.filter((s) => selectedShotIds.includes(s.id));

  const toggleSelectShot = (id: string) => {

    setSelectedShotIds((prev) =>

      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]

    );

  };

  const selectAllShots = () => setSelectedShotIds(shots.map((s) => s.id));

  const clearSelection = () => setSelectedShotIds([]);

  const handleBulkArchive = async () => {

    if (selectedShotIds.length === 0) return;

    await bulkArchive({ ids: selectedShotIds });

    clearSelection();

    refetch();

  };

  const handleBulkRestore = async () => {

    if (selectedShotIds.length === 0) return;

    await bulkRestore({ ids: selectedShotIds });

    clearSelection();

    refetch();

  };

  const handleApplyBulkUpdate = async (changes: Partial<Shot>) => {

    const resp = await bulkUpdate({

      ids: selectedShotIds,

      changes,

    });

    refetch();

    return resp;

  };

  const exportCutListCSV = (format: 'csv' | 'json' = 'csv') => {

    const dataToExport = selectedShots.length > 0 ? selectedShots : shots;

    if (format === 'json') {

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');

      link.href = url;

      link.download = `${project.code}_shots_${Date.now()}.json`;

      link.click();

      URL.revokeObjectURL(url);

      return;

    }

    const csvContent = [

      ['Shot Code', 'Sequence', 'Frames In-Out', 'Count', 'Status', 'Version', 'Artist'].join(','),

      ...dataToExport.map((s) =>

        [

          s.code,

          s.sequence_code,

          `${s.frame_in}-${s.frame_out}`,

          s.frame_count,

          s.status,

          s.current_version,

          `"${s.assigned_artist_name || 'Unassigned'}"`,

        ].join(',')

      ),

    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download = `${project.code}_shots_${Date.now()}.csv`;

    link.click();

    URL.revokeObjectURL(url);

  };

  const handleCreate = async (e: React.FormEvent) => {

    e.preventDefault();

    let episodeFields: { episode_id?: string; episode_code?: string; episode_name?: string } = {};

    if (isEpisodic) {

      const selectedEpisode = episodes.find((ep) => ep.id === selectedEpisodeId);

      if (!selectedEpisode) {

        setEpisodeError('An episode is required to create a shot in an episodic project.');

        return;

      }

      episodeFields = {

        episode_id: selectedEpisode.id,

        episode_code: selectedEpisode.code,

        episode_name: selectedEpisode.name,

      };

    }

    const frame_count = formData.frame_out - formData.frame_in + 1;

    await createShot({

      ...formData,

      ...episodeFields,

      frame_count,

      project_id: project.id,

      project_code: project.code,

      status: 'Not Started',

      current_version: 'v001',

      supervisor_approved: false,

      client_approved: false,

      thumbnail_url:

        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',

      pipeline: {

        layout: 'Not Started',

        animation: 'Not Started',

        fx: 'Not Started',

        lighting: 'Not Started',

        comp: 'Not Started',

      },

    } as Partial<Shot>);

    setIsCreateOpen(false);

    refetch();

  };

  return (

    <div className="space-y-4 pb-16">

      {/* Filter and Action Bar */}

      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">

        <div className="flex items-center space-x-2 w-full sm:w-auto flex-wrap gap-2">

          <div className="w-full sm:w-64">

            <SearchInput

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              onClear={() => setSearch('')}

              placeholder="Search shot code or description..."

              className="w-full"

            />

          </div>

          <select

            value={statusFilter}

            onChange={(e) => setStatusFilter(e.target.value)}

            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-hidden focus:border-indigo-500 font-mono"

          >

            <option value="ALL">All Shot Statuses</option>

            <option value="Not Started">Not Started</option>

            <option value="In Progress">In Progress</option>

            <option value="Pending Review">Pending Review</option>

            <option value="Approved">Approved</option>

            <option value="On Hold">On Hold</option>

          </select>

          <button

            onClick={() => setIncludeDeleted(!includeDeleted)}

            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 ${

              includeDeleted

                ? 'bg-purple-950/40 text-purple-300 border-purple-500/40'

                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'

            }`}

          >

            <Archive className="w-3.5 h-3.5" />

            <span>{includeDeleted ? 'Showing Archived' : 'Show Archived'}</span>

          </button>

        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end flex-wrap gap-2">

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">

            <button

              onClick={() => setViewMode('grid')}

              className={`p-1.5 rounded text-xs transition-colors ${

                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'

              }`}

              title="Grid View"

            >

              <LayoutGrid className="w-3.5 h-3.5" />

            </button>

            <button

              onClick={() => setViewMode('table')}

              className={`p-1.5 rounded text-xs transition-colors ${

                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'

              }`}

              title="Dense Table Matrix"

            >

              <List className="w-3.5 h-3.5" />

            </button>

          </div>

          <PermissionButton

            permission="shot.bulk_create"

            context={{ projectId: project.id, organizationId: project.organization_id }}

            variant="secondary"

            size="sm"

            onClick={() => setIsBulkManagerOpen(true)}

            leftIcon={<Layers className="w-3.5 h-3.5 text-indigo-400" />}

            className="text-xs font-mono"

          >

            Bulk Create Shots

          </PermissionButton>

          <PermissionButton

            permission="shot.create"

            context={{ projectId: project.id, organizationId: project.organization_id }}

            variant="primary"

            size="sm"

            onClick={openCreate}

            leftIcon={<Plus className="w-3.5 h-3.5" />}

          >

            New Shot

          </PermissionButton>

          <Link to="/shots">

            <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>

              Global Directory

            </Button>

          </Link>

        </div>

      </div>

      {/* Content */}

      {isLoading ? (

        <LoadingSpinner size="lg" label="Loading show shots..." />

      ) : shots.length === 0 ? (

        <EmptyState

          title="No shots found for project"

          description="Create shots manually or stage turnovers using bulk creation."

          actionLabel="Bulk Stage Shots"

          onAction={() => setIsBulkManagerOpen(true)}

        />

      ) : viewMode === 'grid' ? (

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {shots.map((shot) => {

            const isSelected = selectedShotIds.includes(shot.id);

            return (

              <Card

                key={shot.id}

                onClick={() => toggleSelectShot(shot.id)}

                className={`overflow-hidden border cursor-pointer transition-all ${

                  shot.is_deleted

                    ? 'bg-purple-950/10 border-purple-500/30 opacity-70'

                    : isSelected

                    ? 'bg-indigo-950/30 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'

                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'

                }`}

              >

                <div className="relative aspect-video bg-slate-950 overflow-hidden">

                  <SmartImg

                    src={shot.thumbnail_url}

                    alt={shot.name}

                    referrerPolicy="no-referrer"

                    className="w-full h-full object-cover"

                  />

                  <div className="absolute top-2 left-2 flex items-center gap-1.5">

                    <input

                      type="checkbox"

                      checked={isSelected}

                      onChange={() => toggleSelectShot(shot.id)}

                      onClick={(e) => e.stopPropagation()}

                      className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500"

                    />

                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-black/80 text-white backdrop-blur-xs border border-white/10">

                      {shot.code}

                    </span>

                  </div>

                  <div className="absolute top-2 right-2">

                    <StatusBadge status={shot.status} />

                  </div>

                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono text-slate-300 bg-black/60 backdrop-blur-xs px-2 py-1 rounded">

                    <span>

                      {shot.frame_in} - {shot.frame_out}

                    </span>

                    <span>{shot.frame_count} frames</span>

                  </div>

                </div>

                <CardBody className="p-3 space-y-2">

                  <div className="flex items-center justify-between">

                    <span className="text-xs text-slate-400 font-mono">

                      Seq: <strong className="text-indigo-400">{shot.sequence_code}</strong>

                    </span>

                    <span className="text-xs text-slate-400 font-mono">{shot.current_version}</span>

                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">

                    <span className="text-slate-400 truncate max-w-[120px]">{shot.assigned_artist_name || 'Unassigned'}</span>

                    <div className="flex items-center gap-1.5 shrink-0">

                      <WorkspaceOpenButton

                        to={`/shots/${shot.id}`}

                        title="Open Shot Workspace"

                      />

                      <button

                        onClick={(e) => {

                          e.stopPropagation();

                          openInspector('shot', shot);

                        }}

                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"

                        title="Inspect Shot"

                      >

                        <Eye className="w-3.5 h-3.5" />

                      </button>

                    </div>

                  </div>

                </CardBody>

              </Card>

            );

          })}

        </div>

      ) : (

        /* Table View */

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900">

          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs font-mono">

              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">

                <tr>

                  <th className="py-2.5 px-3 w-8 text-center">

                    <input

                      type="checkbox"

                      checked={selectedShotIds.length === shots.length && shots.length > 0}

                      onChange={selectAllShots}

                      className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500"

                    />

                  </th>

                  <th className="py-2.5 px-3">Shot</th>

                  <th className="py-2.5 px-3">Sequence</th>

                  <th className="py-2.5 px-3">Frames</th>

                  <th className="py-2.5 px-3">Status</th>

                  <th className="py-2.5 px-3">Artist</th>

                  <th className="py-2.5 px-3 text-right">Workspace & Actions</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800/80">

                {shots.map((shot) => {

                  const isSelected = selectedShotIds.includes(shot.id);

                  return (

                    <tr

                      key={shot.id}

                      onClick={() => toggleSelectShot(shot.id)}

                      className={`hover:bg-slate-800/50 cursor-pointer ${

                        shot.is_deleted

                          ? 'bg-purple-950/10 opacity-70'

                          : isSelected

                          ? 'bg-indigo-950/30'

                          : ''

                      }`}

                    >

                      <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>

                        <input

                          type="checkbox"

                          checked={isSelected}

                          onChange={() => toggleSelectShot(shot.id)}

                          className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500"

                        />

                      </td>

                      <td className="py-2 px-3 font-bold text-white flex items-center gap-2">

                        <Link

                          to={`/shots/${shot.id}`}

                          onClick={(e) => e.stopPropagation()}

                          className="hover:text-indigo-300 transition-colors underline-offset-2 hover:underline"

                        >

                          <span>{shot.code}</span>

                        </Link>

                        {shot.is_deleted && (

                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">

                            Archived

                          </span>

                        )}

                      </td>

                      <td className="py-2 px-3 text-indigo-400">{shot.sequence_code}</td>

                      <td className="py-2 px-3 text-slate-400">

                        {shot.frame_in}-{shot.frame_out} ({shot.frame_count})

                      </td>

                      <td className="py-2 px-3">

                        <WorkflowStateTransitionControl

                          entityType="shot"

                          currentState={

                            shot.status === 'In Progress'

                              ? 'IN_PROGRESS'

                              : shot.status === 'Ready for Review'

                              ? 'READY_FOR_REVIEW'

                              : shot.status === 'Approved'

                              ? 'APPROVED'

                              : shot.status === 'On Hold'

                              ? 'PAUSED'

                              : shot.status === 'Archived'

                              ? 'ARCHIVED'

                              : 'NOT_STARTED'

                          }

                          entity={shot}

                          context={{ projectId: project.id, organizationId: project.organization_id }}

                          onTransition={async (targetState) => {

                            const map: Record<string, any> = {

                              NOT_STARTED: 'Not Started',

                              IN_PROGRESS: 'In Progress',

                              READY_FOR_REVIEW: 'Ready for Review',

                              APPROVED: 'Approved',

                              REVISION_REQUESTED: 'In Progress',

                              FINAL: 'Approved',

                              ARCHIVED: 'Archived',

                            };

                            await updateShot({

                              id: shot.id,

                              data: {

                                status: map[targetState] || targetState,

                              },

                            });

                            refetch();

                          }}

                        />

                      </td>

                      <td className="py-2 px-3 text-slate-300">

                        {shot.assigned_artist_name || 'Unassigned'}

                      </td>

                      <td className="py-2 px-3 text-right" onClick={(e) => e.stopPropagation()}>

                        <div className="flex items-center justify-end gap-1.5">

                          <WorkspaceOpenButton

                            to={`/shots/${shot.id}`}

                            title="Open Shot Workspace"

                          />

                          <button

                            onClick={() => openInspector('shot', shot)}

                            className="p-1 h-7 w-7 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"

                            title="Inspect Details"

                          >

                            <Eye className="w-3.5 h-3.5" />

                          </button>

                        </div>

                      </td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

          </div>

        </div>

      )}

      {/* Bulk Action Bar */}

      <BulkActionBar

        entityType="shot"

        selectedCount={selectedShotIds.length}

        totalCount={shots.length}

        onClearSelection={clearSelection}

        onSelectAll={selectAllShots}

        onBulkUpdate={() => setIsBulkUpdateOpen(true)}

        onBulkArchive={handleBulkArchive}

        onBulkRestore={handleBulkRestore}

        onExportSelected={exportCutListCSV}

      />

      {/* Bulk Shot Creation Modal */}

      <ShotBulkManager

        projectId={project.id}

        projectCode={project.code}

        defaultSequenceCode={`${project.code}_010`}

        isOpen={isBulkManagerOpen}

        {...(isEpisodic
          ? {

            isEpisodic: true,

            episodeId: selectedEpisodeId || undefined,

            episodes: episodes.map((ep) => ({ id: ep.id, code: ep.code, name: ep.name })),

            sequences: sequencesData ? projectSequences.map((seq) => ({ id: seq.id, code: seq.code, episode_id: seq.episode_id })) : undefined,

            onCreateEpisode: handleBulkCreateEpisode,

            onCreateSequence: handleBulkCreateSequence,

          }
          : {})}

        onClose={() => {

          setIsBulkManagerOpen(false);

          refetch();

        }}

        onSuccess={() => {

          refetch();

        }}

      />

      {/* Bulk Update Modal Panel */}

      {isBulkUpdateOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">

          <div className="max-w-2xl w-full">

            <BulkUpdatePanel<Shot>

              entityType="Shot"

              selectedEntities={selectedShots}

              fieldDefinitions={SHOT_UPDATE_FIELDS}

              onApplyUpdate={handleApplyBulkUpdate}

              onClose={() => {

                setIsBulkUpdateOpen(false);

                clearSelection();

              }}

            />

          </div>

        </div>

      )}

      {/* Single Add Shot Modal */}

      <Modal

        isOpen={isCreateOpen}

        onClose={() => setIsCreateOpen(false)}

        title={`Add Cut to ${project.name}`}

      >

        <form onSubmit={handleCreate} className="space-y-4">

          {isEpisodic && (

            <div className="space-y-1">

              <label htmlFor="shot-episode" className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-1.5">

                <Tv className="w-3.5 h-3.5 text-purple-400" />

                Target Episode <span className="text-rose-400">*</span>

              </label>

              {episodes.length === 0 ? (

                <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800 text-xs text-rose-300">

                  <p>No episodes found. An episode is required to create a shot in an episodic project.</p>

                  <div className="flex items-center justify-end gap-2 mt-2">

                    <Button variant="ghost" size="sm" type="button" onClick={() => setIsCreateOpen(false)}>

                      Cancel

                    </Button>

                    <Button variant="primary" size="sm" type="button" onClick={openEpisodeCreate}>

                      Create Episode

                    </Button>

                  </div>

                </div>

              ) : (

                <select

                  id="shot-episode"

                  required

                  value={selectedEpisodeId}

                  onChange={(e) => {

                    setSelectedEpisodeId(e.target.value);

                    setEpisodeError('');

                  }}

                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"

                >

                  <option value="" disabled>

                    Select an Episode

                  </option>

                  {episodes.map((ep) => (

                    <option key={ep.id} value={ep.id}>

                      {ep.code} - {ep.name}

                    </option>

                  ))}

                </select>

              )}

              {episodeError && (

                <p role="alert" className="text-xs text-rose-400 font-mono">

                  {episodeError}

                </p>

              )}

            </div>

          )}

          <div className="grid grid-cols-2 gap-3">

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300 font-mono">Shot Code</label>

              <input

                type="text"

                required

                placeholder="e.g. NK_010_030"

                value={formData.code}

                onChange={(e) => setFormData({ ...formData, code: e.target.value })}

                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300 font-mono">Sequence</label>

              <input

                type="text"

                required

                value={formData.sequence_code}

                onChange={(e) => setFormData({ ...formData, sequence_code: e.target.value })}

                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"

              />

            </div>

          </div>

          <div className="space-y-1">

            <label className="text-xs font-semibold text-slate-300 font-mono">Shot Name</label>

            <input

              type="text"

              required

              placeholder="Close up hero transformation"

              value={formData.name}

              onChange={(e) => setFormData({ ...formData, name: e.target.value })}

              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500"

            />

          </div>

          <div className="grid grid-cols-3 gap-3 font-mono">

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Frame In</label>

              <input

                type="number"

                value={formData.frame_in}

                onChange={(e) => setFormData({ ...formData, frame_in: Number(e.target.value) })}

                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Frame Out</label>

              <input

                type="number"

                value={formData.frame_out}

                onChange={(e) => setFormData({ ...formData, frame_out: Number(e.target.value) })}

                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Handles</label>

              <input

                type="number"

                value={formData.handle_frames}

                onChange={(e) => setFormData({ ...formData, handle_frames: Number(e.target.value) })}

                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"

              />

            </div>

          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">

            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>

              Cancel

            </Button>

            <Button variant="primary" size="sm" type="submit" isLoading={isCreating} disabled={isEpisodic && episodes.length === 0}>

              Create Shot

            </Button>

          </div>

        </form>

      </Modal>

      {/* Inline Episode Creation (episodic shot flow) */}

      <Modal

        isOpen={isEpisodeCreateOpen}

        onClose={() => setIsEpisodeCreateOpen(false)}

        title="Create New Episode"

        subtitle={`Project-prefilled for ${project.name} (${project.code})`}

      >

        <form onSubmit={handleCreateEpisode} className="space-y-4">

          <div className="grid grid-cols-2 gap-4">

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Episode Code *</label>

              <input

                type="text"

                required

                value={pendingEpisode.code}

                onChange={(e) => setPendingEpisode({ ...pendingEpisode, code: e.target.value })}

                placeholder="e.g. SOL_EP01"

                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono uppercase focus:outline-hidden focus:border-indigo-500"

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Episode Name / Title *</label>

              <input

                type="text"

                required

                value={pendingEpisode.name}

                onChange={(e) => setPendingEpisode({ ...pendingEpisode, name: e.target.value })}

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

                value={pendingEpisode.season}

                onChange={(e) => setPendingEpisode({ ...pendingEpisode, season: Number(e.target.value) })}

                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Episode Number</label>

              <input

                type="number"

                min="1"

                value={pendingEpisode.number}

                onChange={(e) => setPendingEpisode({ ...pendingEpisode, number: Number(e.target.value) })}

                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"

              />

            </div>

          </div>

          <div className="grid grid-cols-2 gap-4">

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Target Air Date</label>

              <input

                type="date"

                value={pendingEpisode.airDate}

                onChange={(e) => setPendingEpisode({ ...pendingEpisode, airDate: e.target.value })}

                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"

              />

            </div>

            <div className="space-y-1">

              <label className="text-xs font-semibold text-slate-300">Delivery Date</label>

              <input

                type="date"

                value={pendingEpisode.deliveryDate}

                onChange={(e) => setPendingEpisode({ ...pendingEpisode, deliveryDate: e.target.value })}

                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-indigo-500"

              />

            </div>

          </div>

          <div className="space-y-1">

            <label className="text-xs font-semibold text-slate-300">Synopsis / Description</label>

            <textarea

              rows={3}

              value={pendingEpisode.description}

              onChange={(e) => setPendingEpisode({ ...pendingEpisode, description: e.target.value })}

              placeholder="Key plot beats and turnover requirements for this episode..."

              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-indigo-500"

            />

          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">

            <Button

              type="button"

              variant="outline"

              onClick={() => setIsEpisodeCreateOpen(false)}

            >

              Cancel

            </Button>

            <Button

              type="submit"

              variant="primary"

              disabled={isCreatingEpisode || !pendingEpisode.code.trim() || !pendingEpisode.name.trim()}

            >

              {isCreatingEpisode ? 'Creating...' : 'Create Episode'}

            </Button>

          </div>

        </form>

      </Modal>

    </div>

  );

};
