import React, { useState } from 'react';
import type { Asset } from '@/types/production';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useAssetMutations } from '@/modules/assets/hooks/useAssetMutations';
import { UserCheck, Users, Shield, Cpu } from 'lucide-react';

export interface AssetAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
}

const ARTIST_SUGGESTIONS = [
  { name: 'Sarah Jenkins', department: '3D Modeling & Assets', role: 'Lead Modeler', dcc: 'Maya / ZBrush' },
  { name: 'Elena Rostova', department: 'LookDev & Shading', role: 'Senior LookDev TD', dcc: 'Substance / Solaris' },
  { name: 'Marcus Vance', department: 'Character & Creature Rigging', role: 'Lead Rigging TD', dcc: 'Maya' },
  { name: 'Kai Thorne', department: 'CFX & Groom', role: 'Senior Groom TD', dcc: 'Houdini / Houdini Groom' },
  { name: 'Alex Chen', department: 'VFX Supervision', role: 'Asset Supervisor', dcc: 'OpenUSD / Solaris' },
  { name: 'David Mercer', department: '3D Modeling & Assets', role: 'Hard-surface Modeler', dcc: 'Blender / Maya' },
];

export const AssetAssignModal: React.FC<AssetAssignModalProps> = ({ isOpen, onClose, asset }) => {
  const { updateAsset, isUpdating } = useAssetMutations();
  const [artistName, setArtistName] = useState(asset.assigned_artist_name || 'Sarah Jenkins');
  const [departmentName, setDepartmentName] = useState(asset.department_name || '3D Modeling & Assets');
  const [teamName, setTeamName] = useState(asset.team_name || 'Hero Asset Crew');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateAsset({
      id: asset.id,
      data: {
        assigned_artist_name: artistName,
        department_name: departmentName,
        team_name: teamName,
      },
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assign Lead Artist & Crew — ${asset.code}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Lead Modeler / Artist Name
          </label>
          <Input
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            placeholder="Type artist name..."
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Department</label>
            <select
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="3D Modeling & Assets">3D Modeling & Assets</option>
              <option value="LookDev & Shading">LookDev & Shading</option>
              <option value="Character & Creature Rigging">Rigging & Deformation</option>
              <option value="CFX & Groom">CFX & Groom</option>
              <option value="FX & Simulation">FX Simulation</option>
              <option value="VFX Supervision">Supervision & Review</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Crew Team</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Hero Asset Crew"
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-2">
            Suggested Department Artists
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {ARTIST_SUGGESTIONS.map((artist) => (
              <button
                type="button"
                key={artist.name}
                onClick={() => {
                  setArtistName(artist.name);
                  setDepartmentName(artist.department);
                }}
                className={`p-2.5 rounded-xl border text-left flex items-start justify-between transition-colors cursor-pointer ${
                  artistName === artist.name
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-white">{artist.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {artist.department}
                  </div>
                  <div className="text-[9px] text-emerald-400 font-mono mt-0.5">{artist.dcc}</div>
                </div>
                {artistName === artist.name && (
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
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
