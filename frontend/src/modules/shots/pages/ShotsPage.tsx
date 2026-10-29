import { useProjects } from '@/modules/production';
import React, { useState, useEffect } from 'react';
import { SmartImg } from '@/components/ui/SmartImg';
import { useShots } from '../hooks/useShots';
import { useShotMutations } from '../hooks/useShotMutations';
import { useBulkShots } from '../hooks/useBulkShots';
;
import { useProductionStore } from '@/core/production/useProductionStore';
import { Card, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Can } from '@/core/permissions/Can';
import { HasRole } from '@/core/permissions/HasRole';
import {
  Clapperboard,
  Plus,
  CheckCircle2,
  SlidersHorizontal,
  Check,
  Eye,
  LayoutGrid,
  List,
  Sparkles,
  Download,
  Terminal,
  PlaySquare,
  Clock,
  Layers,
  ChevronRight,
  Filter,
  Archive,
  RotateCcw,
  ExternalLink,
  Building2,
} from 'lucide-react';

import { Shot } from '@/types/production';
import { ProductionStatus } from '@/types/common';
import { Link } from 'react-router-dom';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';
import { WorkspaceOpenButton } from '@/shared/workspace/canonical/WorkspaceButtons';
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import { ShotBulkManager } from '../components/bulk/ShotBulkManager';
import { BulkUpdatePanel, FieldDefinition } from '@/shared/components/bulk/BulkUpdatePanel';
import { BulkActionBar } from '@/shared/components/bulk/BulkActionBar';
import { ApiErrorState } from '@/components/system/ApiErrorState';

import { ProductionContextGuard } from '@/core/production/ProductionContext';

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

const ShotsPageContent: React.FC = () => {
  const {
    page,
    setPage,
    pageSize,
    setPageSize,
    pageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'shots',
    defaultPage: 1,
    defaultPageSize: 8,
    pageSizeOptions: [8, 16, 24, 48],
  });
  const activeProjectId = useProductionStore((state) => state.activeProjectId);
  const setActiveProject = useProductionStore((state) => state.setActiveProject);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>(activeProjectId || 'ALL');

  useEffect(() => {
    if (activeProjectId) {
      setProjectFilter(activeProjectId);
      setPage(1);
    }
  }, [activeProjectId, setPage]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);

  const addNotification = useNotificationStore((state) => state.addNotification);
  const openInspector = useInspectorStore((state) => state.openInspector);

  const { data: projectsData } = useProjects();
  const { data, isLoading, error, refetch } = useShots({
    page,
    page_size: pageSize,
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    project_id: projectFilter !== 'ALL' ? projectFilter : undefined,
    include_deleted: includeDeleted,
  });

  const { createShot, updateShot, approveShot, isApproving, isCreating } = useShotMutations();
  const { bulkUpdate, bulkArchive, bulkRestore } = useBulkShots();

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    sequence_code: 'NK_010',
    description: '',
    frame_in: 1001,
    frame_out: 1145,
    handle_frames: 8,
    assigned_artist_name: 'Elena Rostova',
  });

  const shots: Shot[] = data?.results || [];
  const totalCount = data?.count || 0;
  const projects = projectsData?.results || [];
  const selectedShots = shots.filter((s) => selectedShotIds.includes(s.id));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const frame_count = formData.frame_out - formData.frame_in + 1;
    const selectedProj = projectsData?.results.find((p) => p.id === projectFilter) || projectsData?.results[0];

    await createShot({
      ...formData,
      frame_count,
      project_id: selectedProj?.id || 'proj-001',
      project_code: selectedProj?.code || 'NK99',
      status: 'Not Started',
      current_version: 'v001',
      supervisor_approved: false,
      client_approved: false,
      thumbnail_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
      pipeline: {
        layout: 'Not Started',
        animation: 'Not Started',
        fx: 'Not Started',
        lighting: 'Not Started',
        comp: 'Not Started',
      },
    } as Partial<Shot>);

    setIsCreateOpen(false);
    setFormData({
      code: '',
      name: '',
      sequence_code: 'NK_010',
      description: '',
      frame_in: 1001,
      frame_out: 1145,
      handle_frames: 8,
      assigned_artist_name: 'Elena Rostova',
    });
    refetch();
  };

  const handleStatusChange = async (shot: Shot, newStatus: ProductionStatus) => {
    await updateShot({
      id: shot.id,
      data: { status: newStatus },
    });
  };

  const handlePipelinePassChange = async (shot: Shot, discipline: string, newStageStatus: string) => {
    const updatedPipeline = {
      ...(shot.pipeline || {}),
      [discipline]: newStageStatus,
    };
    await updateShot({
      id: shot.id,
      data: { pipeline: updatedPipeline as any },
    });
    addNotification({
      type: 'info',
      title: 'Discipline Pass Updated',
      message: `${shot.code} → ${discipline.toUpperCase()} set to ${newStageStatus}`,
    });
  };

  const handleApprove = async (shotId: string) => {
    await approveShot(shotId);
  };

  const toggleSelectShot = (id: string) => {
    setSelectedShotIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllShots = () => {
    if (selectedShotIds.length === shots.length) {
      setSelectedShotIds([]);
    } else {
      setSelectedShotIds(shots.map((s) => s.id));
    }
  };

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
      link.download = `StudioHub_ShotCutList_${new Date().toISOString().slice(0, 10)}.json`;
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
    link.setAttribute('href', url);
    link.setAttribute('download', `StudioHub_ShotCutList_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addNotification({
      type: 'success',
      title: 'EDL / CSV Exported',
      message: 'Downloaded production shot list manifest.',
    });
  };

  const statuses: (ProductionStatus | 'ALL')[] = [
    'ALL',
    'Not Started',
    'In Progress',
    'Pending Review',
    'Approved',
    'On Hold',
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100 pb-16">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-xl text-indigo-400">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Sequence Breakdown & Shot Matrix
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-indigo-300 border border-indigo-500/30 rounded-md flex items-center gap-1">
                  <Building2 className="w-3 h-3 text-indigo-400" />
                  Studio Context
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full font-mono">
                  {totalCount} Cuts
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                NLE timecodes, discipline pass tracker (Layout → Anim → FX → Light → Comp) & OpenUSD versions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Show Archived Toggle */}
            <button
              onClick={() => setIncludeDeleted(!includeDeleted)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 ${
                includeDeleted
                  ? 'bg-purple-950/40 text-purple-300 border-purple-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{includeDeleted ? 'Showing Archived' : 'Show Archived'}</span>
            </button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCutListCSV('csv')}
              leftIcon={<Download className="w-3.5 h-3.5" />}
              title="Export CSV Cut List"
            >
              Export EDL
            </Button>

            {/* Bulk Create Shots Button */}
            <Can permission="shot.bulk_create">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsBulkManagerOpen(true)}
                leftIcon={<Layers className="w-3.5 h-3.5 text-indigo-400" />}
                className="text-xs font-mono"
              >
                Bulk Create Shots
              </Button>
            </Can>

            <Can permission="shots:create">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Shot
              </Button>
            </Can>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-4 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Filter Toolbar with View Toggles */}
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-2 w-full md:w-auto flex-wrap gap-2">
            <SearchInput
              className="w-full sm:w-72"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              onClear={() => {
                setSearch('');
                setPage(1);
              }}
              placeholder="Filter code, sequence or description..."
            />

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  Status: {s}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-colors ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Storyboard Grid Cards"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 border transition-colors ${
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Table Grid View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
          </div>
        </div>

        {/* Content View */}
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <ApiErrorState error={error} onRetry={() => refetch()} />
        ) : shots.length === 0 ? (
          <EmptyState
            title="No shots found"
            description="Create new production cuts or import editorial cut lists."
            actionLabel="Create Shot"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : viewMode === 'table' ? (
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800">
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
                    <th className="py-2.5 px-3">Timecodes & Range</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Discipline Pass (Layout/Anim/FX/Lgt/Comp)</th>
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
                        className={`hover:bg-slate-800/50 cursor-pointer transition-colors ${
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
                            className="hover:text-indigo-300 transition-colors underline-offset-2 hover:underline flex items-center gap-1.5"
                          >
                            <span>{shot.code}</span>
                          </Link>
                          {shot.is_deleted && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              Archived
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-normal">
                            ({shot.current_version})
                          </span>
                        </td>
                        <td className="py-2 px-3 text-indigo-400 font-semibold">
                          {shot.sequence_code}
                        </td>
                        <td className="py-2 px-3 text-slate-400">
                          {shot.frame_in} - {shot.frame_out}{' '}
                          <span className="text-slate-500">({shot.frame_count} frames)</span>
                        </td>
                        <td className="py-2 px-3">
                          <StatusBadge status={shot.status} />
                        </td>
                        <td className="py-2 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center space-x-1 text-[10px]">
                            {['layout', 'animation', 'fx', 'lighting', 'comp'].map((stage) => {
                              const stageVal = (shot.pipeline as any)?.[stage] || 'Not Started';
                              const isAppr = stageVal === 'Approved';
                              const isInProg = stageVal === 'In Progress' || stageVal === 'WIP';
                              return (
                                <button
                                  key={stage}
                                  onClick={() =>
                                    handlePipelinePassChange(
                                      shot,
                                      stage,
                                      isAppr ? 'Not Started' : isInProg ? 'Approved' : 'In Progress'
                                    )
                                  }
                                  className={`px-1.5 py-0.5 rounded uppercase font-bold border transition-colors ${
                                    isAppr
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      : isInProg
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                      : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                                  }`}
                                  title={`Click to cycle ${stage.toUpperCase()} (${stageVal})`}
                                >
                                  {stage.slice(0, 3)}
                                </button>
                              );
                            })}
                          </div>
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
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => openInspector('shot', shot)}
                              className="p-1 h-7 w-7 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Inspect Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View - Matches Projects -> details -> shot tab */
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
                        className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-indigo-500 cursor-pointer"
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
                      <span className="text-xs text-slate-400 font-mono">{shot.current_version || 'v001'}</span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-400 truncate max-w-[120px]">
                        {shot.assigned_artist_name || 'Unassigned'}
                      </span>
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
        )}

        {/* Pagination */}
        <div className="pt-2">
          <Pagination
            id="pagination-bar"
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            totalPages={Math.max(1, Math.ceil(totalCount / pageSize))}
            pageSizeOptions={pageSizeOptions}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="shots"
          />
        </div>
      </div>

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
        projectId={projectFilter !== 'ALL' ? projectFilter : 'proj-001'}
        projectCode="NK99"
        isOpen={isBulkManagerOpen}
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
        title="Add Production Cut"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Shot Code</label>
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
              <label className="text-xs font-semibold text-slate-300">Sequence Code</label>
              <input
                type="text"
                required
                placeholder="e.g. NK_010"
                value={formData.sequence_code}
                onChange={(e) => setFormData({ ...formData, sequence_code: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Shot Description</label>
            <input
              type="text"
              required
              placeholder="Close-up laser sparks on titanium hull"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Start Frame</label>
              <input
                type="number"
                value={formData.frame_in}
                onChange={(e) => setFormData({ ...formData, frame_in: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">End Frame</label>
              <input
                type="number"
                value={formData.frame_out}
                onChange={(e) => setFormData({ ...formData, frame_out: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Handles</label>
              <input
                type="number"
                value={formData.handle_frames}
                onChange={(e) => setFormData({ ...formData, handle_frames: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Lead Artist</label>
            <input
              type="text"
              placeholder="Elena Rostova"
              value={formData.assigned_artist_name}
              onChange={(e) => setFormData({ ...formData, assigned_artist_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isCreating}>
              Register Shot
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const ShotsPage: React.FC = () => (
  <ProductionContextGuard>
    <ShotsPageContent />
  </ProductionContextGuard>
);
