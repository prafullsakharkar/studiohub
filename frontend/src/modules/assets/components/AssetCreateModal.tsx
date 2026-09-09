import React, { useState } from 'react';
import { Asset, AssetCategory, AssetSoftware } from '@/types/assets';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { ProductionStatus } from '@/types/common';

interface AssetCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultProjectCode?: string;
}

export const AssetCreateModal: React.FC<AssetCreateModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId = 'proj-001',
  defaultProjectCode = 'NK99',
}) => {
  const { createAsset, isCreating } = useAssetMutations();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'Vehicle' as AssetCategory,
    project_id: defaultProjectId,
    project_code: defaultProjectCode,
    project_name: 'Neo Kyoto 2099',
    description: '',
    status: 'In Progress' as ProductionStatus,
    software: 'Maya' as AssetSoftware,
    poly_count: 1500000,
    lod_levels: 4,
    thumbnail_url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80',
    file_format: 'OpenUSD (.usda / .usdc)',
    assigned_artist_name: 'Sarah Jenkins',
    department_name: '3D Modeling & Assets',
    team_name: 'Hero Asset Crew',
    tags: 'Hero, Hard-Surface, OpenUSD',
  });

  const handleAutoGenerateCode = (name: string, category: string) => {
    const catCode = category.substring(0, 3).toUpperCase();
    const cleanName = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .substring(0, 14);
    return `AST_${catCode}_${cleanName || 'NEW'}`;
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name: val,
      code: prev.code ? prev.code : handleAutoGenerateCode(val, prev.category),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await createAsset({
      ...formData,
      tags: tagsArray,
      usd_prim_path: `/World/Assets/${formData.code}`,
      assigned_artist_id: 'usr-004',
      assigned_artist_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    } as Partial<Asset>);

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register New Production Asset">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={handleNameChange}
              placeholder="e.g. Cyber Spinner Interceptor Mark V"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Asset Pipeline Code *</label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              placeholder="AST_VEH_SPINNER_05"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Category / Type</label>
            <select
              value={formData.category}
              onChange={(e) => {
                const cat = e.target.value as AssetCategory;
                setFormData({
                  ...formData,
                  category: cat,
                  code: handleAutoGenerateCode(formData.name, cat),
                });
              }}
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
              <option value="Matte Painting">Matte Painting</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Production Project</label>
            <select
              value={formData.project_code}
              onChange={(e) => {
                const val = e.target.value;
                setFormData({
                  ...formData,
                  project_code: val,
                  project_id: val === 'NK99' ? 'proj-001' : 'proj-002',
                  project_name: val === 'NK99' ? 'Neo Kyoto 2099' : 'Aetheria: Age of Dragons',
                });
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="NK99">Neo Kyoto 2099 (NK99)</option>
              <option value="AETH2">Aetheria: Age of Dragons (AETH2)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Primary DCC</label>
            <select
              value={formData.software}
              onChange={(e) => setFormData({ ...formData, software: e.target.value as AssetSoftware })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Maya">Maya 2025</option>
              <option value="Houdini">Houdini 20.5</option>
              <option value="ZBrush">ZBrush 2024</option>
              <option value="Blender">Blender 4.2</option>
              <option value="Substance Painter">Substance 3D Painter</option>
              <option value="Unreal Engine 5">Unreal Engine 5</option>
              <option value="Solaris">Solaris (USD)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Poly Budget</label>
            <input
              type="number"
              min="0"
              step="50000"
              value={formData.poly_count}
              onChange={(e) => setFormData({ ...formData, poly_count: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">LOD Cascades</label>
            <input
              type="number"
              min="1"
              max="6"
              value={formData.lod_levels}
              onChange={(e) => setFormData({ ...formData, lod_levels: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Lead Modeler</label>
            <input
              type="text"
              value={formData.assigned_artist_name}
              onChange={(e) => setFormData({ ...formData, assigned_artist_name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Creative Brief & Description</label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Art direction notes, functional topology specs, or hero shader guidelines..."
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
          <Button variant="primary" size="sm" type="submit" isLoading={isCreating}>
            Register Asset in OpenUSD
          </Button>
        </div>
      </form>
    </Modal>
  );
};
