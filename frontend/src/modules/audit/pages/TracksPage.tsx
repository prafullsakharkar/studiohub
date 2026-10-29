import { useEditorialTracks, useCreateEditorialTrack, useUpdateEditorialTrack, useDeleteEditorialTrack } from '@/modules/production';
import React, { useState, useMemo } from 'react';
import { useAuditTracks, useRecordAuditTrack } from '../hooks/useAudit';
;
import { usePersistedPagination } from '@/shared/hooks/usePersistedPagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { AuditTrack } from '@/types/audit';
import { EditorialTrack } from '@/types/production';
import {
  Activity,
  Clapperboard,
  Clock,
  Eye,
  Film,
  Filter,
  Layers,
  Lock,
  Mic,
  Music,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Sliders,
  Trash2,
  Unlock,
  User,
  Video,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

export const TracksPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'editorial' | 'telemetry'>('editorial');

  // Pagination for Editorial Tracks
  const {
    page: edPage,
    setPage: setEdPage,
    pageSize: edPageSize,
    setPageSize: setEdPageSize,
    pageSizeOptions: edPageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'editorial_tracks_page',
    defaultPage: 1,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  // Pagination for Telemetry Tracks
  const {
    page: telPage,
    setPage: setTelPage,
    pageSize: telPageSize,
    setPageSize: setTelPageSize,
    pageSizeOptions: telPageSizeOptions,
  } = usePersistedPagination({
    storageKey: 'telemetry_tracks_page',
    defaultPage: 1,
    defaultPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });

  const [search, setSearch] = useState('');
  const [trackTypeFilter, setTrackTypeFilter] = useState<string>('ALL');

  // Modals
  const [isCreateEditorialModalOpen, setIsCreateEditorialModalOpen] = useState(false);
  const [isRecordAuditModalOpen, setIsRecordAuditModalOpen] = useState(false);
  const [selectedAuditTrack, setSelectedAuditTrack] = useState<AuditTrack | null>(null);

  // Forms
  const [newEditorialTrack, setNewEditorialTrack] = useState({
    name: 'V2 - VFX Plate Clean',
    track_type: 'VIDEO',
    track_index: 2,
    channel_index: 1,
    color: '#6366f1',
    is_muted: false,
    is_soloed: false,
    is_locked: false,
    sequence_id: 'seq-sq01',
    project_id: 'proj-omega',
  });

  const [newAuditTrack, setNewAuditTrack] = useState({
    track_name: 'MediaReview_Playback_Interaction',
    event_type: 'playback',
    user_name: 'Lead Compositor',
    duration_ms: 14200,
    metadata: '{\n  "tool": "frame_scrubber",\n  "fps": 24,\n  "cache_hit": true\n}',
  });

  // Hooks
  const {
    data: editorialData,
    isLoading: isEdLoading,
    refetch: refetchEditorial,
    isFetching: isEdFetching,
  } = useEditorialTracks({
    page: edPage,
    page_size: edPageSize,
    search: search || undefined,
  });

  const {
    data: auditData,
    isLoading: isAuditLoading,
    refetch: refetchAudit,
    isFetching: isAuditFetching,
  } = useAuditTracks({
    page: telPage,
    page_size: telPageSize,
    search: search || undefined,
  });

  const createEdTrackMutation = useCreateEditorialTrack();
  const updateEdTrackMutation = useUpdateEditorialTrack();
  const deleteEdTrackMutation = useDeleteEditorialTrack();
  const recordAuditTrackMutation = useRecordAuditTrack();

  const editorialTracks = editorialData?.results || [];
  const editorialTotal = editorialData?.count || 0;

  const auditTracks = auditData?.results || [];
  const auditTotal = auditData?.count || 0;

  // Filtered editorial tracks
  const filteredEditorialTracks = useMemo(() => {
    return editorialTracks.filter((t) => {
      if (trackTypeFilter !== 'ALL' && t.track_type !== trackTypeFilter) {
        return false;
      }
      return true;
    });
  }, [editorialTracks, trackTypeFilter]);

  // Handlers for Editorial Track
  const handleCreateEditorialTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createEdTrackMutation.mutateAsync({
        name: newEditorialTrack.name,
        track_type: newEditorialTrack.track_type as any,
        track_index: Number(newEditorialTrack.track_index),
        channel_index: Number(newEditorialTrack.channel_index),
        color: newEditorialTrack.color,
        is_muted: newEditorialTrack.is_muted,
        is_soloed: newEditorialTrack.is_soloed,
        is_locked: newEditorialTrack.is_locked,
        sequence_id: newEditorialTrack.sequence_id,
        project_id: newEditorialTrack.project_id,
      });
      setIsCreateEditorialModalOpen(false);
      refetchEditorial();
    } catch (err) {
      console.error('Failed to create editorial track', err);
    }
  };

  const handleToggleLock = async (track: EditorialTrack) => {
    try {
      await updateEdTrackMutation.mutateAsync({
        id: track.id,
        data: { is_locked: !track.is_locked },
      });
      refetchEditorial();
    } catch (err) {
      console.error('Failed to toggle lock', err);
    }
  };

  const handleToggleMute = async (track: EditorialTrack) => {
    try {
      await updateEdTrackMutation.mutateAsync({
        id: track.id,
        data: { is_muted: !track.is_muted },
      });
      refetchEditorial();
    } catch (err) {
      console.error('Failed to toggle mute', err);
    }
  };

  const handleToggleSolo = async (track: EditorialTrack) => {
    try {
      await updateEdTrackMutation.mutateAsync({
        id: track.id,
        data: { is_soloed: !track.is_soloed },
      });
      refetchEditorial();
    } catch (err) {
      console.error('Failed to toggle solo', err);
    }
  };

  const handleDeleteEditorialTrack = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this track?')) return;
    try {
      await deleteEdTrackMutation.mutateAsync(id);
      refetchEditorial();
    } catch (err) {
      console.error('Failed to delete track', err);
    }
  };

  // Handlers for Telemetry Track
  const handleRecordAuditTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let parsedMeta = {};
      try {
        parsedMeta = JSON.parse(newAuditTrack.metadata);
      } catch {
        parsedMeta = { text: newAuditTrack.metadata };
      }

      await recordAuditTrackMutation.mutateAsync({
        track_name: newAuditTrack.track_name,
        event_type: newAuditTrack.event_type,
        user_name: newAuditTrack.user_name,
        duration_ms: Number(newAuditTrack.duration_ms),
        metadata: parsedMeta,
      });

      setIsRecordAuditModalOpen(false);
      refetchAudit();
    } catch (err) {
      console.error('Failed to record telemetry track', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Tracks Management & Telemetry Traces
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  Editorial & Audit Tracks
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                  {activeTab === 'editorial' ? `${editorialTotal} Editorial Tracks` : `${auditTotal} Telemetry Traces`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage editorial timeline tracks (Video/Audio/VFX) and inspect user interaction telemetry action tracks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => (activeTab === 'editorial' ? refetchEditorial() : refetchAudit())}
              disabled={isEdFetching || isAuditFetching}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs"
              title="Refresh tracks"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  (activeTab === 'editorial' ? isEdFetching : isAuditFetching) ? 'animate-spin' : ''
                }`}
              />
              <span>Refresh</span>
            </button>
            {activeTab === 'editorial' ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateEditorialModalOpen(true)}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                <Plus className="w-4 h-4" />
                <span>Add Editorial Track</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 py-2 flex items-center gap-2">
        <button
          onClick={() => setActiveTab('editorial')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'editorial'
              ? 'bg-cyan-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Film className="w-3.5 h-3.5" />
          <span>Editorial Timeline Tracks ({editorialTotal})</span>
        </button>
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
            activeTab === 'telemetry'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Audit & Telemetry Action Tracks ({auditTotal})</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Search Toolbar */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <SearchInput
              className="w-full sm:w-80"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (activeTab === 'editorial') setEdPage(1);
                else setTelPage(1);
              }}
              onClear={() => {
                setSearch('');
                if (activeTab === 'editorial') setEdPage(1);
                else setTelPage(1);
              }}
              placeholder="Search tracks by name or ID..."
            />

            {activeTab === 'editorial' && (
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                {['ALL', 'VIDEO', 'AUDIO', 'SUBTITLE', 'TIMECODE'].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setTrackTypeFilter(t);
                      setEdPage(1);
                    }}
                    className={`px-2.5 py-1 font-mono font-medium rounded-md transition-colors text-[11px] ${
                      trackTypeFilter === t
                        ? 'bg-cyan-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tab 1: Editorial Timeline Tracks */}
        {activeTab === 'editorial' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
            {isEdLoading ? (
              <div className="p-12 flex justify-center items-center">
                <LoadingSpinner size="lg" message="Loading editorial timeline tracks..." />
              </div>
            ) : filteredEditorialTracks.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={<Film className="w-6 h-6 text-cyan-400" />}
                  title="No editorial tracks found"
                  description="No timeline tracks configured for this sequence. Add video or audio channels to build your cut."
                  action={
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsCreateEditorialModalOpen(true)}
                      className="mt-2 bg-cyan-600 hover:bg-cyan-500"
                    >
                      Create First Track
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Track Name</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Index</th>
                      <th className="py-3 px-4">Timeline Controls</th>
                      <th className="py-3 px-4">Sequence / Project</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredEditorialTracks.map((track, idx) => (
                      <tr key={track.id || track.uuid || `track-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: track.color || '#6366f1' }}
                            />
                            <div>
                              <div className="font-semibold text-white">{track.name}</div>
                              <div className="text-[10px] text-slate-500">{track.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              track.track_type === 'VIDEO'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                                : track.track_type === 'AUDIO'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {track.track_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-300">
                          T{track.track_index} (Ch {track.channel_index})
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {/* Mute Button */}
                            <button
                              onClick={() => handleToggleMute(track)}
                              className={`p-1 rounded text-xs transition-colors border ${
                                track.is_muted
                                  ? 'bg-rose-500/30 text-rose-300 border-rose-500/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                              title={track.is_muted ? 'Unmute Track' : 'Mute Track'}
                            >
                              {track.is_muted ? (
                                <VolumeX className="w-3.5 h-3.5" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Solo Button */}
                            <button
                              onClick={() => handleToggleSolo(track)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors border ${
                                track.is_soloed
                                  ? 'bg-amber-500/30 text-amber-300 border-amber-500/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                              title={track.is_soloed ? 'Disable Solo' : 'Solo Track'}
                            >
                              S
                            </button>

                            {/* Lock Button */}
                            <button
                              onClick={() => handleToggleLock(track)}
                              className={`p-1 rounded text-xs transition-colors border ${
                                track.is_locked
                                  ? 'bg-purple-500/30 text-purple-300 border-purple-500/50'
                                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                              title={track.is_locked ? 'Unlock Track' : 'Lock Track'}
                            >
                              {track.is_locked ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          <div>{track.sequence_id || 'Global'}</div>
                          <div className="text-[10px] text-slate-600">{track.project_id}</div>
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteEditorialTrack(track.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md hover:bg-slate-800 transition-colors"
                            title="Delete track"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/60">
              <Pagination
                currentPage={edPage}
                totalCount={editorialTotal}
                pageSize={edPageSize}
                pageSizeOptions={edPageSizeOptions}
                onPageChange={setEdPage}
                onPageSizeChange={setEdPageSize}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Audit & Telemetry Action Tracks */}
        {activeTab === 'telemetry' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
            {isAuditLoading ? (
              <div className="p-12 flex justify-center items-center">
                <LoadingSpinner size="lg" message="Loading interaction traces..." />
              </div>
            ) : auditTracks.length === 0 ? (
              <div className="p-12">
                <EmptyState
                  icon={<Activity className="w-6 h-6 text-indigo-400" />}
                  title="No telemetry traces found"
                  description="No user interaction or telemetry tracks recorded in this session."
                  action={
                    undefined
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Track / Action Name</th>
                      <th className="py-3 px-3">Event Type</th>
                      <th className="py-3 px-3">Duration</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {auditTracks.map((trk, idx) => (
                      <tr
                        key={trk.id || trk.uuid || `trk-${idx}`}
                        onClick={() => setSelectedAuditTrack(trk)}
                        className="hover:bg-slate-800/30 cursor-pointer transition-colors group"
                      >
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                            {trk.track_name}
                          </div>
                          <div className="text-[10px] text-slate-500">{trk.id}</div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded text-[10px] font-bold border border-indigo-500/30 uppercase">
                            {trk.event_type}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-cyan-400">
                          {trk.duration_ms ? `${trk.duration_ms} ms` : '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-300">
                          {trk.user_name || 'System / Auto'}
                        </td>
                        <td className="py-3 px-4 text-slate-400 whitespace-nowrap text-[11px]">
                          {new Date(trk.created_at || Date.now()).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAuditTrack(trk);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] transition-colors border border-slate-700 font-sans"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            <div className="border-t border-slate-800 px-4 py-3 bg-slate-950/60">
              <Pagination
                currentPage={telPage}
                totalCount={auditTotal}
                pageSize={telPageSize}
                pageSizeOptions={telPageSizeOptions}
                onPageChange={setTelPage}
                onPageSizeChange={setTelPageSize}
              />
            </div>
          </div>
        )}
      </div>

      {/* Inspect Audit Track Modal */}
      {selectedAuditTrack && (
        <Modal
          isOpen={!!selectedAuditTrack}
          onClose={() => setSelectedAuditTrack(null)}
          title={`Telemetry Trace: ${selectedAuditTrack.track_name}`}
          subtitle={`Event: ${selectedAuditTrack.event_type} • ID: ${selectedAuditTrack.id}`}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedAuditTrack(null)}>
              Close
            </Button>
          }
        >
          <div className="space-y-4 font-mono text-xs text-slate-300">
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Duration</span>
                <span className="font-bold text-cyan-400">{selectedAuditTrack.duration_ms} ms</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">User</span>
                <span className="font-bold text-indigo-400">
                  {selectedAuditTrack.user_name || 'System'}
                </span>
              </div>
            </div>

            <div>
              <div className="text-slate-400 font-semibold mb-1 uppercase text-[10px] tracking-wider font-sans">
                Telemetry Metadata & Breadcrumbs
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-slate-300 text-[11px] overflow-x-auto max-h-56">
                {selectedAuditTrack.metadata ? (
                  <pre>{JSON.stringify(selectedAuditTrack.metadata, null, 2)}</pre>
                ) : (
                  <span className="text-slate-600">No metadata recorded</span>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Editorial Track Modal */}
      {isCreateEditorialModalOpen && (
        <Modal
          isOpen={isCreateEditorialModalOpen}
          onClose={() => setIsCreateEditorialModalOpen(false)}
          title="Create Editorial Timeline Track"
          subtitle="Add a video, audio, or subtitle channel to the project editorial timeline"
          size="lg"
        >
          <form onSubmit={handleCreateEditorialTrack} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Track Name</label>
              <input
                type="text"
                value={newEditorialTrack.name}
                onChange={(e) => setNewEditorialTrack({ ...newEditorialTrack, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-cyan-500 font-mono"
                placeholder="e.g. V3 - Comp VFX Overlays"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Track Type</label>
                <select
                  value={newEditorialTrack.track_type}
                  onChange={(e) =>
                    setNewEditorialTrack({ ...newEditorialTrack, track_type: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-cyan-500 font-mono"
                >
                  <option value="VIDEO">VIDEO</option>
                  <option value="AUDIO">AUDIO</option>
                  <option value="SUBTITLE">SUBTITLE</option>
                  <option value="TIMECODE">TIMECODE</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Track Index</label>
                <input
                  type="number"
                  value={newEditorialTrack.track_index}
                  onChange={(e) =>
                    setNewEditorialTrack({
                      ...newEditorialTrack,
                      track_index: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Channel Index</label>
                <input
                  type="number"
                  value={newEditorialTrack.channel_index}
                  onChange={(e) =>
                    setNewEditorialTrack({
                      ...newEditorialTrack,
                      channel_index: Number(e.target.value),
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-cyan-500 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Track Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newEditorialTrack.color}
                    onChange={(e) =>
                      setNewEditorialTrack({ ...newEditorialTrack, color: e.target.value })
                    }
                    className="w-10 h-9 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer p-1"
                  />
                  <input
                    type="text"
                    value={newEditorialTrack.color}
                    onChange={(e) =>
                      setNewEditorialTrack({ ...newEditorialTrack, color: e.target.value })
                    }
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Sequence ID</label>
                <input
                  type="text"
                  value={newEditorialTrack.sequence_id}
                  onChange={(e) =>
                    setNewEditorialTrack({ ...newEditorialTrack, sequence_id: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono"
                  placeholder="e.g. seq-sq01"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={newEditorialTrack.is_muted}
                  onChange={(e) =>
                    setNewEditorialTrack({ ...newEditorialTrack, is_muted: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-0"
                />
                <span>Muted by Default</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={newEditorialTrack.is_locked}
                  onChange={(e) =>
                    setNewEditorialTrack({ ...newEditorialTrack, is_locked: e.target.checked })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-cyan-600 focus:ring-0"
                />
                <span>Locked</span>
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsCreateEditorialModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={createEdTrackMutation.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 text-white"
              >
                {createEdTrackMutation.isPending ? 'Creating Track...' : 'Create Editorial Track'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Audit Track Modal */}
      {isRecordAuditModalOpen && (
        <Modal
          isOpen={isRecordAuditModalOpen}
          onClose={() => setIsRecordAuditModalOpen(false)}
          title="Record Telemetry Action Trace"
          subtitle="Inject user interaction or pipeline telemetry track to trace timing and tool execution"
          size="lg"
        >
          <form onSubmit={handleRecordAuditTrack} className="space-y-4 text-xs font-sans">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Track / Action Name</label>
              <input
                type="text"
                value={newAuditTrack.track_name}
                onChange={(e) => setNewAuditTrack({ ...newAuditTrack, track_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                placeholder="e.g. CutImport_OTIO_Reconciliation"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Event Type</label>
                <select
                  value={newAuditTrack.event_type}
                  onChange={(e) =>
                    setNewAuditTrack({ ...newAuditTrack, event_type: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                >
                  <option value="playback">playback</option>
                  <option value="export">export</option>
                  <option value="filter">filter</option>
                  <option value="navigation">navigation</option>
                  <option value="edit">edit</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Duration (ms)</label>
                <input
                  type="number"
                  value={newAuditTrack.duration_ms}
                  onChange={(e) =>
                    setNewAuditTrack({ ...newAuditTrack, duration_ms: Number(e.target.value) })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">User Name</label>
                <input
                  type="text"
                  value={newAuditTrack.user_name}
                  onChange={(e) => setNewAuditTrack({ ...newAuditTrack, user_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Metadata (JSON)</label>
              <textarea
                value={newAuditTrack.metadata}
                onChange={(e) => setNewAuditTrack({ ...newAuditTrack, metadata: e.target.value })}
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-hidden focus:border-indigo-500 font-mono text-[11px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button variant="secondary" onClick={() => setIsRecordAuditModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={recordAuditTrackMutation.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {recordAuditTrackMutation.isPending ? 'Recording...' : 'Commit Telemetry Track'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
