import React, { useState } from 'react';
import { Playlist, PlaylistEntry } from '@/types/playlists';
import { Card, CardBody, CardHeader } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import {
  Film,
  Play,
  Plus,
  Share2,
  Archive,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Building,
  Layers,
  Sparkles,
  Monitor,
  Calendar,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { AddVersionToPlaylistModal } from './AddVersionToPlaylistModal';
import { SharePlaylistModal } from './SharePlaylistModal';
import { usePlaylistMutations } from '@/modules/playlists/hooks/usePlaylistMutations';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface PlaylistWorkspaceProps {
  playlist: Playlist;
  onBack?: () => void;
  onLaunchReviewSession?: (entry: PlaylistEntry) => void;
}

export const PlaylistWorkspace: React.FC<PlaylistWorkspaceProps> = ({
  playlist,
  onBack,
  onLaunchReviewSession,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'entries' | 'activity'>('entries');
  const [isAddVersionModalOpen, setIsAddVersionModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const {
    addEntry,
    removeEntry,
    reorderEntries,
    sharePlaylist,
    archivePlaylist,
    restorePlaylist,
    isAddingEntry,
    isRemovingEntry,
    isReordering,
    isSharing,
    isArchiving,
    isRestoring,
  } = usePlaylistMutations();

  const entries = playlist.entries || [];

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const newEntries = [...entries];
    const temp = newEntries[index - 1];
    newEntries[index - 1] = newEntries[index];
    newEntries[index] = temp;
    await reorderEntries({ playlistId: playlist.id, entries: newEntries });
  };

  const handleMoveDown = async (index: number) => {
    if (index >= entries.length - 1) return;
    const newEntries = [...entries];
    const temp = newEntries[index + 1];
    newEntries[index + 1] = newEntries[index];
    newEntries[index] = temp;
    await reorderEntries({ playlistId: playlist.id, entries: newEntries });
  };

  const handleRemoveEntry = async (entryId: string) => {
    await removeEntry({ playlistId: playlist.id, entryId });
  };

  return (
    <div id="playlist-workspace" className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* 1. Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Back to Playlists"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}

            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono text-xs font-bold border border-indigo-500/20">
                  {playlist.project_code}
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs font-bold border border-slate-700">
                  {playlist.type}
                </span>
                <StatusBadge status={playlist.status} />
              </div>

              <div className="flex items-center space-x-2 mt-1">
                <h2 className="text-lg font-bold text-white tracking-tight">{playlist.name}</h2>
                <span className="text-xs font-mono text-slate-500">•</span>
                <span className="text-xs font-mono text-slate-400">{playlist.code}</span>
              </div>
            </div>
          </div>

          {/* Quick Operations */}
          <div className="flex flex-wrap items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
              leftIcon={<Share2 className="w-3.5 h-3.5" />}
            >
              Share Reel
            </Button>

            {playlist.status === 'Archived' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => restorePlaylist(playlist.id)}
                isLoading={isRestoring}
                className="text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              >
                Restore Reel
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => archivePlaylist(playlist.id)}
                isLoading={isArchiving}
                className="text-xs border-slate-700 text-slate-400 hover:text-white"
                leftIcon={<Archive className="w-3.5 h-3.5" />}
              >
                Archive Reel
              </Button>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddVersionModalOpen(true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-500"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Version
            </Button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono">
          <div>
            <span className="text-slate-500 uppercase text-[10px]">Total Cuts / Shots</span>
            <div className="text-white font-bold text-sm">{entries.length} Versions</div>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px]">Sequence Duration</span>
            <div className="text-amber-400 font-bold text-sm">{playlist.total_duration_timecode || '00:01:24:00'}</div>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px]">Total Frames</span>
            <div className="text-emerald-400 font-bold text-sm">{playlist.total_duration_frames || 2016} Frames</div>
          </div>
          <div>
            <span className="text-slate-500 uppercase text-[10px]">Authorized Client</span>
            <div className="text-cyan-400 font-bold text-sm truncate">{playlist.client?.name || 'Warner Media'}</div>
          </div>
        </div>
      </div>

      {/* 2. Sub-Tabs */}
      <div className="bg-slate-900/60 border-b border-slate-800 px-6 flex items-center space-x-2 shrink-0">
        <button
          onClick={() => setActiveTab('entries')}
          className={`py-3 px-3 border-b-2 text-xs font-medium flex items-center space-x-2 transition-colors ${
            activeTab === 'entries'
              ? 'border-indigo-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Film className="w-4 h-4 text-indigo-400" />
          <span>Screening Sequence ({entries.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`py-3 px-3 border-b-2 text-xs font-medium flex items-center space-x-2 transition-colors ${
            activeTab === 'activity'
              ? 'border-indigo-500 text-white font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4 text-slate-400" />
          <span>Activity & Screening Audit</span>
        </button>
      </div>

      {/* 3. Tab Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {activeTab === 'entries' ? (
          <div className="max-w-6xl mx-auto space-y-4">
            {entries.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
                <Film className="w-8 h-8 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-white">Screening Reel is Empty</div>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Add approved shots and published version iterations to build continuity and screening dailies.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsAddVersionModalOpen(true)}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Add First Version
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {entries.map((entry, index) => (
                  <Card
                    key={entry.id}
                    className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all"
                  >
                    <CardBody className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      {/* Left: Index + Thumbnail + Metadata */}
                      <div className="flex items-center space-x-3.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-400">
                          #{index + 1}
                        </div>

                        <div className="relative w-24 h-14 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0">
                          <img
                            src={entry.thumbnail_url}
                            alt={entry.entity_code}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-mono font-bold text-indigo-400">
                              {entry.entity_code}
                            </span>
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              {entry.version_number}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">({entry.department})</span>
                            <StatusBadge status={entry.approval_status || 'Pending Review'} />
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                            <span>Artist: {entry.artist_name}</span>
                            <span>•</span>
                            <span>{entry.duration_frames || 0} frames</span>
                            <span>•</span>
                            <span>Range: {entry.frame_range || '1001-1144'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Reorder & Actions */}
                      <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                        {/* Launch Review */}
                        {onLaunchReviewSession && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => onLaunchReviewSession(entry)}
                            className="text-xs bg-indigo-600 hover:bg-indigo-500 py-1 px-2.5"
                            leftIcon={<Play className="w-3 h-3" />}
                          >
                            Review Cut
                          </Button>
                        )}

                        {/* Reorder Buttons */}
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
                          title="Move Earlier in Reel"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === entries.length - 1}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 rounded-lg transition-colors"
                          title="Move Later in Reel"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>

                        {/* Remove */}
                        <button
                          onClick={() => handleRemoveEntry(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors ml-1"
                          title="Remove from Playlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Activity Log */
          <div className="max-w-4xl mx-auto space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Playlist Modification History
            </h4>
            <div className="space-y-3">
              {(playlist.activity || []).map((act) => (
                <div
                  key={act.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-indigo-400 font-bold">{act.actor_name}:</span>
                    <span className="text-slate-200">{act.description}</span>
                  </div>
                  <span className="text-slate-500">
                    {new Date(act.timestamp).toLocaleDateString()} at{' '}
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddVersionToPlaylistModal
        isOpen={isAddVersionModalOpen}
        onClose={() => setIsAddVersionModalOpen(false)}
        playlist={playlist}
        onSubmit={(entry) => addEntry({ playlistId: playlist.id, entry })}
        isLoading={isAddingEntry}
      />

      <SharePlaylistModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        playlist={playlist}
        onShare={(settings) => sharePlaylist({ playlistId: playlist.id, settings })}
        isLoading={isSharing}
      />
    </div>
  );
};
