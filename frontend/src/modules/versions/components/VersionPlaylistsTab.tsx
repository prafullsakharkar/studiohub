import React, { useState } from 'react';
import {
  ListMusic,
  Plus,
  Play,
  Clock,
  Layers,
  Calendar,
  CheckCircle2,
  Trash2,
  Share2,
} from 'lucide-react';
import { ProductionVersion } from '@/types/versions';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { useVersionMutations } from '../hooks/useVersionMutations';

interface VersionPlaylistsTabProps {
  version: ProductionVersion;
}

export const VersionPlaylistsTab: React.FC<VersionPlaylistsTabProps> = ({ version }) => {
  const { addToPlaylist, isAddingToPlaylist } = useVersionMutations();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('pl-001');
  const [playlistName, setPlaylistName] = useState('Daily Morning Executive Review');
  const [playlistType, setPlaylistType] = useState('dailies');

  const playlists = version.playlists || [
    {
      id: 'pl-001',
      name: 'Episode 04 — Dailies Review Reel (Aug 24)',
      type: 'dailies',
      order: 1,
      total_items: 8,
      created_at: '2026-08-24T08:00:00Z',
    },
    {
      id: 'pl-002',
      name: 'Hero Character LookDev Signoff Cut',
      type: 'client',
      order: 3,
      total_items: 4,
      created_at: '2026-08-23T16:00:00Z',
    },
  ];

  const handleAddToPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    await addToPlaylist({
      id: version.id,
      payload: {
        playlist_id: selectedPlaylistId,
        playlist_name: playlistName,
        playlist_type: playlistType,
      },
    });
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div>
          <h3 className="text-sm font-mono font-bold text-slate-200 uppercase">
            Review Reels & Playlists
          </h3>
          <p className="text-xs text-slate-400">
            Organize {version.version_number} into daily screening playlists, edit reels, and client approval decks.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          className="font-mono text-xs"
        >
          Add to Playlist
        </Button>
      </div>

      {/* Playlists List */}
      <div className="space-y-3">
        {playlists.map((pl) => (
          <div
            key={pl.id}
            className="flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors shadow-sm"
          >
            <div className="flex items-center space-x-3.5 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
                <ListMusic className="w-5 h-5" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-slate-200 truncate">{pl.name}</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono text-purple-400 border-purple-500/30">
                    {pl.type}
                  </Badge>
                </div>
                <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
                  <span>Reel Position: <strong className="text-cyan-400">#{pl.order}</strong></span>
                  <span>•</span>
                  <span>{pl.total_items} items in playlist</span>
                  <span>•</span>
                  <span>Created {new Date(pl.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button size="xs" variant="outline" leftIcon={<Play className="w-3 h-3" />}>
                Launch Screening
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Add To Playlist Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Version to Playlist" size="md">
        <form onSubmit={handleAddToPlaylist} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Target Playlist / Reel</label>
            <input
              type="text"
              required
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="e.g. Episode 04 Final Dailies"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Playlist Category</label>
            <select
              value={playlistType}
              onChange={(e) => setPlaylistType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="dailies">Dailies / Internal Screening</option>
              <option value="client">Client & Showrunner Review</option>
              <option value="cut">Editorial Cut Sequence</option>
              <option value="approval">Final Delivery Signoff</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isAddingToPlaylist}>
              Add to Reel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
