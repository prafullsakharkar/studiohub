import React, { useState } from 'react';
import {
  PlaySquare,
  Film,
  Lock,
  Unlock,
  Play,
  Share2,
  Clock,
  CheckCircle2,
  ListPlus,
  Tv,
  MessageSquare,
  Plus,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { Playlist } from '@/types/playlists';
import { usePlaylists } from '@/modules/playlists/hooks/usePlaylists';
import { usePlaylistMutations } from '@/modules/playlists/hooks/usePlaylistMutations';
import { Button } from '@/shared/components/Button';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Modal } from '@/shared/components/Modal';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

interface ProjectPlaylistsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectPlaylistsTab: React.FC<ProjectPlaylistsTabProps> = ({ project, onNavigateTab }) => {
  const { data: playlistsData, isLoading } = usePlaylists({
    project_id: project.id,
    page_size: 50,
  });
  const playlists: Playlist[] = (playlistsData as any)?.results ?? playlistsData ?? [];

  const { createPlaylist, isCreating } = usePlaylistMutations();

  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const activePlaylist = playlists.find((p) => p.id === selectedPlaylistId) ?? playlists[0];
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPlayingReel, setIsPlayingReel] = useState(false);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<'Dailies' | 'Client Review' | 'Editorial Sync' | 'Executive Screening'>('Dailies');
  const [newDesc, setNewDesc] = useState('');

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const created = await createPlaylist({
      name: newTitle,
      project_id: project.id,
      project_code: project.code,
      type: newType,
      description: newDesc || 'Curated review reel for show milestone.',
      status: 'In Progress',
      entries: [],
    } as Partial<Playlist>);

    setSelectedPlaylistId(created.id);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDesc('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div>
          <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
            <PlaySquare className="w-4 h-4 text-indigo-400" />
            Review Playlists & Dailies Screening Reels
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Curate linear shot cuts, sync review sessions, and launch synchronous playback in Screening Room
          </p>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          New Playlist
        </Button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Playlist Index */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono px-1">
            Available Playlists ({playlists.length})
          </h4>

          <div className="space-y-2">
            {playlists.map((pl) => {
              const isSelected = pl.id === activePlaylist?.id;
              return (
                <div
                  key={pl.id}
                  onClick={() => setSelectedPlaylistId(pl.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500/40 shadow-lg'
                      : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-400">{pl.code}</span>
                        {pl.is_locked && (
                          <span title="Locked Playlist">
                            <Lock className="w-3 h-3 text-amber-400" />
                          </span>
                        )}
                      </div>
                      <h5 className="text-sm font-bold text-white mt-0.5">{pl.name}</h5>
                    </div>
                    <StatusBadge status={pl.status} />
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-1">{pl.description}</p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      {pl.type}
                    </span>
                    <span>{pl.items_count} cuts • {pl.total_duration_timecode}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Selected Playlist Details & Shot Cuts */}
        <div className="lg:col-span-2 space-y-4">
          {!activePlaylist && !isLoading && (
            <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-500">
              No playlists available for this project yet. Create one to get started.
            </div>
          )}
          {activePlaylist && (
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            {/* Header of Active Playlist */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-400">{activePlaylist.code}</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-slate-800 text-slate-300 rounded border border-slate-700">
                    {activePlaylist.type}
                  </span>
                  <StatusBadge status={activePlaylist.status} />
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{activePlaylist.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{activePlaylist.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setIsPlayingReel(true);
                    addNotification({
                      type: 'info',
                      title: 'Screening Room Synced',
                      message: `Initiating real-time synchronized playback of ${activePlaylist.name}.`,
                    });
                  }}
                  leftIcon={<Play className="w-3.5 h-3.5 fill-white" />}
                >
                  Launch Player
                </Button>
              </div>
            </div>

            {/* Cuts Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-2">
                <span>REEL CUT SEQUENCE ({(activePlaylist?.entries || []).length} items)</span>
                <span>TOTAL DURATION: {activePlaylist?.total_duration_timecode || '00:00:00:00'}</span>
              </div>

              <div className="space-y-2 divide-y divide-slate-800/40">
                {(activePlaylist?.entries || []).map((entry) => (
                  <div
                    key={entry.item_order}
                    className="pt-2 flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-slate-500 w-6">
                        #{entry.item_order.toString().padStart(2, '0')}
                      </span>

                      {entry.thumbnail_url && (
                        <img
                          src={entry.thumbnail_url}
                          alt={entry.entity_code}
                          className="w-16 h-10 object-cover rounded bg-slate-950 border border-slate-800"
                        />
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">{entry.entity_code}</span>
                          <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
                            {entry.version_number}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Frames {entry.frame_range || '1001-1050'} ({entry.duration_frames || 0} f)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-slate-400 font-mono">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                        <span>{entry.notes_count}</span>
                      </div>
                      <StatusBadge status={entry.approval_status || 'Pending Review'} />
                    </div>
                  </div>
                ))}

                {(!activePlaylist?.entries || activePlaylist.entries.length === 0) && (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No cuts currently in this playlist reel. Drag and drop shots from the Shots tab.
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Create Playlist Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Review Playlist Reel"
        subtitle={`Organize dailies reel for show ${project.code}`}
      >
        <form onSubmit={handleCreatePlaylist} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Playlist Name</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Sequence 010 Morning Dailies"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Playlist Category</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            >
              <option value="Dailies">Dailies</option>
              <option value="Client Review">Client Review</option>
              <option value="Editorial Sync">Editorial Sync</option>
              <option value="Executive Screening">Executive Screening</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description / Goal</label>
            <textarea
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Curated review notes..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Create Playlist
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
