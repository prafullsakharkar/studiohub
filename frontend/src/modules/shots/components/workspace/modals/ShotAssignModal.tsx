import React, { useState } from 'react';
import { Shot } from '@/types/production';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useShotMutations } from '@/modules/shots/hooks/useShotMutations';
import { UserCheck, Users, Shield } from 'lucide-react';

export interface ShotAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  shot: Shot;
}

const ARTIST_SUGGESTIONS = [
  { name: 'Elena Rostova', department: 'Compositing', role: 'Senior Lead' },
  { name: 'Kai Thorne', department: 'FX Simulation', role: 'Lead TD' },
  { name: 'Marcus Vance', department: 'Lighting', role: 'Senior Artist' },
  { name: 'Aria Chen', department: 'Animation', role: 'Keyframe Artist' },
  { name: 'David Mercer', department: 'Layout / Matchmove', role: 'Lead' },
  { name: 'Maya Lin', department: 'Matte Painting', role: 'Senior Artist' },
];

export const ShotAssignModal: React.FC<ShotAssignModalProps> = ({ isOpen, onClose, shot }) => {
  const { updateShot, isUpdating } = useShotMutations();
  const [artistName, setArtistName] = useState(shot.assigned_artist_name || '');
  const [department, setDepartment] = useState(shot.department || 'Compositing');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateShot({
      id: shot.id,
      data: {
        assigned_artist_name: artistName,
        department,
      },
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Artist — ${shot.code}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Primary Artist Name
          </label>
          <Input
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Type artist name..."
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="Compositing">Compositing</option>
            <option value="FX">FX</option>
            <option value="Lighting">Lighting</option>
            <option value="Animation">Animation</option>
            <option value="Layout">Layout</option>
            <option value="Matte Painting">Matte Painting</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            Suggested Roster Artists
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ARTIST_SUGGESTIONS.map((artist) => (
              <button
                type="button"
                key={artist.name}
                onClick={() => {
                  setArtistName(artist.name);
                  setDepartment(artist.department);
                }}
                className={`p-2.5 rounded-xl border text-left flex items-start justify-between transition-colors ${
                  artistName === artist.name
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-white">{artist.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {artist.department} • {artist.role}
                  </div>
                </div>
                {artistName === artist.name && (
                  <UserCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isUpdating}>
            Confirm Assignment
          </Button>
        </div>
      </form>
    </Modal>
  );
};
