import React, { useState } from 'react';
import { useShots } from '../hooks/useShots';
import { useShotMutations } from '../hooks/useShotMutations';
import { useProjects } from '@/modules/production/hooks/useProjects';
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
  Film,
  Sparkles,
  Download,
  Terminal,
  PlaySquare,
  Clock,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Shot } from '@/types/shots';
import { ProductionStatus } from '@/types/common';
import { Link } from 'react-router-dom';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';

export const ShotsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'filmstrip'>('table');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedShotIds, setSelectedShotIds] = useState<string[]>([]);

  const addNotification = useNotificationStore((state) => state.addNotification);
  const openInspector = useInspectorStore((state) => state.openInspector);

  const { data: projectsData } = useProjects();
  const { data, isLoading } = useShots({
    page,
    page_size: 8,
    search: search || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    project_id: projectFilter !== 'ALL' ? projectFilter : undefined,
  });

  const { createShot, updateShot, approveShot, isApproving, isCreating } = useShotMutations();

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

  const exportCutListCSV = () => {
    const csvContent = [
      ['Shot Code', 'Sequence', 'Frames In-Out', 'Count', 'Status', 'Version', 'Artist'].join(','),
      ...shots.map((s) =>
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

  const shots = data?.results || [];
  const totalCount = data?.count || 0;
  const projects = projectsData?.results || [];

  const statuses: (ProductionStatus | 'ALL')[] = [
    'ALL',
    'Not Started',
    'In Progress',
    'Pending Review',
    'Approved',
    'On Hold',
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
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
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  {totalCount} Cuts
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                NLE timecodes, discipline pass tracker (Layout → Anim → FX → Light → Comp) & OpenUSD versions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {selectedShotIds.length > 0 && (
              <div className="flex items-center space-x-2 bg-indigo-950/60 border border-indigo-500/40 px-2.5 py-1 rounded-lg animate-in fade-in">
                <span className="text-xs font-mono font-bold text-indigo-300">
                  {selectedShotIds.length} selected
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    selectedShotIds.forEach((id) => handleApprove(id));
                    setSelectedShotIds([]);
                  }}
                >
                  Approve All
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={exportCutListCSV}
              leftIcon={<Download className="w-3.5 h-3.5" />}
              title="Export CSV Cut List"
            >
              Export EDL
            </Button>

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
        <div className="flex items-center space-x-2 w-full md:w-auto">
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
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Shows</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between sm:justify-end space-x-2 w-full md:w-auto overflow-x-auto">
          {/* Status Pills */}
          <div className="flex items-center space-x-1">
            {statuses.map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === st
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* View Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Dense Matrix Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Filmstrip Card Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Shots Content */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Querying shot database and OpenUSD scene records..." />
      ) : shots.length === 0 ? (
        <EmptyState
          icon={<Clapperboard className="w-8 h-8 text-indigo-400" />}
          title="No Shots Found"
          description="There are no sequence cut entries matching your current filters."
          actionLabel="Create Shot"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'table' ? (
        /* Dense ftrack / Linear Table Matrix */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                  <th className="py-2.5 px-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedShotIds.length === shots.length && shots.length > 0}
                      onChange={selectAllShots}
                      className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                  </th>
                  <th className="py-2.5 px-3">Shot / Seq</th>
                  <th className="py-2.5 px-3">Frame Cut</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Pipeline Pass Matrix (Layout • Anim • FX • Light • Comp)</th>
                  <th className="py-2.5 px-3">Lead Artist</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {shots.map((shot) => {
                  const isSelected = selectedShotIds.includes(shot.id);
                  return (
                    <tr
                      key={shot.id}
                      className={`hover:bg-slate-800/40 transition-colors ${isSelected ? 'bg-indigo-950/20' : ''}`}
                    >
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectShot(shot.id)}
                          className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                        />
                      </td>

                      {/* Code & Thumbnail */}
                      <td className="py-2.5 px-3">
                        <div
                          onClick={() => openInspector('shot', shot)}
                          className="flex items-center space-x-2.5 cursor-pointer group"
                        >
                          <img
                            src={shot.thumbnail_url}
                            alt={shot.code}
                            className="w-10 h-7 object-cover rounded bg-slate-950 shrink-0 border border-slate-800 group-hover:border-indigo-500/50 transition-colors"
                          />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className="font-mono font-bold text-white text-xs group-hover:text-indigo-400 transition-colors">
                                {shot.code}
                              </span>
                              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold">
                                {shot.current_version}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1">{shot.name}</p>
                          </div>
                        </div>
                      </td>

                      {/* Frame Range */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        <div>
                          <span>{shot.frame_in} - {shot.frame_out}</span>
                          <span className="text-slate-500 ml-1">({shot.frame_count}f)</span>
                        </div>
                        <span className="text-[10px] text-slate-500">±{shot.handle_frames || 8} handles</span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <select
                          value={shot.status}
                          onChange={(e) => handleStatusChange(shot, e.target.value as ProductionStatus)}
                          className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[11px] font-medium focus:ring-1 focus:ring-indigo-500"
                        >
                          {statuses.filter((s) => s !== 'ALL').map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Pipeline Pass Interactive Matrix */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center justify-center space-x-1 font-mono text-[10px]">
                          {['layout', 'animation', 'fx', 'lighting', 'comp'].map((discipline) => {
                            const st = (shot.pipeline as any)?.[discipline] || 'Not Started';
                            return (
                              <button
                                key={discipline}
                                onClick={() => {
                                  const next =
                                    st === 'Not Started'
                                      ? 'In Progress'
                                      : st === 'In Progress'
                                      ? 'Pending Review'
                                      : st === 'Pending Review'
                                      ? 'Approved'
                                      : 'Not Started';
                                  handlePipelinePassChange(shot, discipline, next);
                                }}
                                title={`${discipline.toUpperCase()}: ${st} (Click to advance)`}
                                className={`px-1.5 py-0.5 rounded font-bold uppercase transition-all truncate border ${
                                  st === 'Approved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : st === 'In Progress'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : st === 'Pending Review'
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                    : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                                }`}
                              >
                                {discipline.slice(0, 3)}
                              </button>
                            );
                          })}
                        </div>
                      </td>

                      {/* Lead Artist */}
                      <td className="py-2.5 px-3 text-slate-300 text-xs">
                        <div className="flex items-center space-x-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-800 text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                            {(shot.assigned_artist_name || 'U')[0]}
                          </div>
                          <span className="truncate max-w-[110px]">{shot.assigned_artist_name || 'Unassigned'}</span>
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => openInspector('shot', shot)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-300"
                            title="Inspect OpenUSD Details & Versions"
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </button>
                          <Link to="/reviews">
                            <button
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                              title="Screening Room"
                            >
                              <PlaySquare className="w-3.5 h-3.5" />
                            </button>
                          </Link>
                          <HasRole role={['VFX Supervisor', 'Platform Admin', 'Organization Admin']}>
                            {!shot.supervisor_approved ? (
                              <button
                                onClick={() => handleApprove(shot.id)}
                                className="p-1 rounded hover:bg-emerald-950 text-emerald-400"
                                title="Approve Shot"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-[10px] font-mono text-emerald-400 px-1 py-0.5">✓ Super</span>
                            )}
                          </HasRole>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={8}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </div>
      ) : (
        /* Grid Filmstrip View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {shots.map((shot) => (
              <Card
                key={shot.id}
                onClick={() => openInspector('shot', shot)}
                className="bg-slate-900 border-slate-800 hover:border-indigo-500/40 transition-all overflow-hidden flex flex-col justify-between cursor-pointer group"
              >
                <div className="relative h-36 bg-slate-950 overflow-hidden">
                  <img
                    src={shot.thumbnail_url}
                    alt={shot.code}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-900/90 text-white border border-slate-700">
                      {shot.code}
                    </span>
                    <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-indigo-500 text-white font-semibold">
                      {shot.current_version}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <StatusBadge status={shot.status} />
                  </div>
                  <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-slate-300 font-mono">
                    <span>{shot.sequence_code}</span>
                    <span>{shot.frame_in}-{shot.frame_out} ({shot.frame_count}f)</span>
                  </div>
                </div>

                <CardBody className="p-3 space-y-2">
                  <h3 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">{shot.name}</h3>

                  <div className="grid grid-cols-5 gap-1 text-[9px] text-center font-mono">
                    {Object.entries(shot.pipeline || {}).map(([stage, st]) => (
                      <div
                        key={stage}
                        className={`py-0.5 rounded font-bold uppercase truncate ${
                          st === 'Approved'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : st === 'In Progress'
                            ? 'bg-amber-500/20 text-amber-300'
                            : st === 'Pending Review'
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-slate-800/80 text-slate-500'
                        }`}
                      >
                        {stage.slice(0, 3)}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    <span className="truncate">{shot.assigned_artist_name || 'Unassigned'}</span>
                    <span className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-mono">
                      Inspect →
                    </span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={8}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* Create Shot Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Shot in Cut"
        description="Add a sequence shot boundary with timecodes and initial discipline allocation."
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Shot Code</label>
              <input
                type="text"
                required
                placeholder="NK_010_050"
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
                placeholder="NK_010"
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
    </div>
  );
};
