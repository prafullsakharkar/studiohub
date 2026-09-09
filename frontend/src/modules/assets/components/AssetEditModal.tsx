import React, { useState } from 'react';
import { Asset, AssetCategory, AssetSoftware } from '@/types/assets';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { ProductionStatus } from '@/types/common';

interface AssetEditModalProps {
  asset: Asset;
  isOpen: boolean;
  onClose: () => void;
}

export const AssetEditModal: React.FC<AssetEditModalProps> = ({ asset, isOpen, onClose }) => {
  const { updateAsset, isUpdating } = useAssetMutations();

  const [formData, setFormData] = useState({
    name: asset.name,
    code: asset.code,
    category: asset.category,
    status: asset.status,
    software: asset.software,
    poly_count: asset.poly_count,
    lod_levels: asset.lod_levels,
    description: asset.description,
    thumbnail_url: asset.thumbnail_url,
    assigned_artist_name: asset.assigned_artist_name || 'Sarah Jenkins',
    department_name: asset.department_name || '3D Modeling & Assets',
    team_name: asset.team_name || 'Hero Asset Crew',
    bounding_box: asset.bounding_box || '5.4m x 2.2m x 1.8m',
    texture_resolution: asset.texture_resolution || '8K UDIM (42 tiles)',
    usd_prim_path: asset.usd_prim_path || `/World/Assets/${asset.code}`,
    tags: (asset.tags || []).join(', '),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await updateAsset({
      id: asset.id,
      data: {
        ...formData,
        tags: tagsArray,
      },
    });

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Asset: ${asset.code}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Pipeline Code</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value as AssetCategory })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Character">Character</option>
              <option value="Vehicle">Vehicle</option>
              <option value="Environment">Environment</option>
              <option value="Prop">Prop</option>
              <option value="FX Rig">FX Rig</option>
              <option value="Shader & LookDev">Shader & LookDev</option>
              <option value="Crowd Agent">Crowd Agent</option>
              <option value="Costume / Groom">Costume / Groom</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as ProductionStatus })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending Review">Pending Review</option>
              <option value="Approved">Approved</option>
              <option value="Retake">Retake</option>
              <option value="On Hold">On Hold</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Software</label>
            <select
              value={formData.software}
              onChange={(e) => setFormData({ ...formData, software: e.target.value as AssetSoftware })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Maya">Maya 2025</option>
              <option value="Houdini">Houdini 20.5</option>
              <option value="ZBrush">ZBrush 2024</option>
              <option value="Blender">Blender 4.2</option>
              <option value="Substance Painter">Substance Painter</option>
              <option value="Unreal Engine 5">Unreal Engine 5</option>
              <option value="Solaris">Solaris (USD)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Texture Resolution</label>
            <input
              type="text"
              value={formData.texture_resolution}
              onChange={(e) => setFormData({ ...formData, texture_resolution: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Bounding Box</label>
            <input
              type="text"
              value={formData.bounding_box}
              onChange={(e) => setFormData({ ...formData, bounding_box: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Tags (Comma-separated)</label>
          <input
            type="text"
            value={formData.tags}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" isLoading={isUpdating}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
