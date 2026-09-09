import React, { useState } from 'react';
import { Playlist, PlaylistEntry } from '@/types/playlists';
import { Button } from '@/shared/components/Button';
import { Film, Plus, X, Monitor, User } from 'lucide-react';

interface AddVersionToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Playlist;
  onSubmit: (entry: Partial<PlaylistEntry>) => Promise<any>;
  isLoading?: boolean;
}

export const AddVersionToPlaylistModal: React.FC<AddVersionToPlaylistModalProps> = ({
  isOpen,
  onClose,
  playlist,
  onSubmit,
  isLoading,
}) => {
  const [entityType, setEntityType] = useState<'Shot' | 'Asset'>('Shot');
  const [entityCode, setEntityCode] = useState('NK_010_020');
  const [versionNumber, setVersionNumber] = useState('v003');
  const [department, setDepartment] = useState('Compositing');
  const [artistName, setArtistName] = useState('Sarah Jenkins');
  const [frames, setFrames] = useState(144);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      entity_type: entityType,
      entity_code: entityCode,
      version_number: versionNumber,
      department,
      artist_name: artistName,
      fps: 24,
      duration_frames: frames,
      frame_range: `1001-${1000 + frames}`,
      thumbnail_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400',
      video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      status: 'In Progress',
      approval_status: 'Pending Review',
      notes_count: 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Add Version Cut to Playlist</h3>
              <p className="text-[11px] font-mono text-slate-400">Reel: {playlist.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Entity Type</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              >
                <option value="Shot">Shot</option>
                <option value="Asset">Asset</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Entity Code</label>
              <input
                type="text"
                value={entityCode}
                onChange={(e) => setEntityCode(e.target.value)}
                placeholder="e.g. NK_010_020"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Version Number</label>
              <input
                type="text"
                value={versionNumber}
                onChange={(e) => setVersionNumber(e.target.value)}
                placeholder="e.g. v003"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              >
                <option value="Compositing">Compositing</option>
                <option value="Lighting & LookDev">Lighting & LookDev</option>
                <option value="FX & Simulation">FX & Simulation</option>
                <option value="Animation">Animation</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Artist Name</label>
              <input
                type="text"
                value={artistName}
                onChange={(e) => setArtistName(e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Frame Count</label>
            <input
              type="number"
              value={frames}
              onChange={(e) => setFrames(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Turnover Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes on what's in this version..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onClose}
              className="text-xs border-slate-700 text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              isLoading={isLoading}
              className="text-xs bg-indigo-600 hover:bg-indigo-500"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add to Playlist
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
