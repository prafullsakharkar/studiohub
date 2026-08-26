import React, { useState } from 'react';
import { Playlist } from '@/types/playlists';
import { Button } from '@/shared/components/Button';
import { Film, ListPlus, X, Building } from 'lucide-react';
import { useAuth } from '@/modules/auth/hooks/useAuth';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Playlist>) => Promise<any>;
  isLoading?: boolean;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [projectCode, setProjectCode] = useState('NK99');
  const [playlistType, setPlaylistType] = useState<Playlist['type']>('Dailies');
  const [description, setDescription] = useState('');
  const [isClientVisible, setIsClientVisible] = useState(true);
  const [clientName, setClientName] = useState('Warner Bros. Discovery');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name: name.trim(),
      project_id: projectCode === 'NK99' ? 'proj-001' : 'proj-002',
      project_code: projectCode,
      project_name: projectCode === 'NK99' ? 'Neo Kyoto 2099' : 'Aetheria Chronicles Season 2',
      type: playlistType,
      description,
      status: 'In Progress',
      author_id: user?.id || 'usr-001',
      author_name: user?.full_name || 'Alex Chen',
      author_avatar: user?.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      client: {
        id: 'cli-001',
        code: 'WARNER-MEDIA',
        name: clientName,
        representative_name: 'Michael Sterling',
      },
      entries: [],
      items_count: 0,
      total_duration_frames: 0,
      total_duration_timecode: '00:00:00:00',
      is_locked: false,
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
              <ListPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Create Screening Playlist / Reel</h3>
              <p className="text-[11px] text-slate-400">
                Assemble sequence cuts, dailies, or client delivery screening reels.
              </p>
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
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Playlist Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SEQ-010 Main Chase - Client Screening Reel"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Project</label>
              <select
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              >
                <option value="NK99">Neo Kyoto 2099 (NK99)</option>
                <option value="AETH2">Aetheria Chronicles S2 (AETH2)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">Reel Type</label>
              <select
                value={playlistType}
                onChange={(e) => setPlaylistType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
              >
                <option value="Dailies">Dailies</option>
                <option value="Sequence Review">Sequence Review</option>
                <option value="Client Turnover">Client Turnover</option>
                <option value="Executive Screening">Executive Screening</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe scope, continuity requirements, or specific review objectives..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">Client Organization</label>
            <select
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
            >
              <option value="Warner Bros. Discovery">Warner Bros. Discovery (Michael Sterling)</option>
              <option value="Netflix Originals">Netflix Originals (Amanda Vance)</option>
              <option value="Universal Pictures">Universal Pictures (David Miller)</option>
            </select>
          </div>

          <label className="flex items-center space-x-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isClientVisible}
              onChange={(e) => setIsClientVisible(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
            />
            <span className="text-xs text-slate-300">Authorize Client Portal Access for this Playlist</span>
          </label>

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
              leftIcon={<ListPlus className="w-3.5 h-3.5" />}
            >
              Create Reel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
