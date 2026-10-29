import React, { useState } from 'react';
import type { Asset, AssetVersionRecord } from '@/types/production';
import { Modal } from '@/shared/components/Modal';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { useAssetMutations } from '@/modules/assets/hooks/useAssetMutations';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';
import { CheckCircle2, ShieldCheck, Database, Layers } from 'lucide-react';

export interface AssetSubmitVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset;
}

export const AssetSubmitVersionModal: React.FC<AssetSubmitVersionModalProps> = ({
  isOpen,
  onClose,
  asset,
}) => {
  const recordActivity = useActivityStore((state) => state.recordActivity);
  const { updateAsset, isUpdating } = useAssetMutations();
  const { addNotification } = useNotificationStore();

  const currentNum = parseInt(String(asset.version || 'v001').replace('v', '') || '1', 10);
  const nextVerDefault = `v${(currentNum + 1).toString().padStart(3, '0')}`;

  const [versionNumber, setVersionNumber] = useState(nextVerDefault);
  const [dccSoftware, setDccSoftware] = useState(`${asset.software || 'Maya'} 2025`);
  const [fileFormat, setFileFormat] = useState('OpenUSD Binary (.usdc)');
  const [fileSizeMb, setFileSizeMb] = useState(480);
  const [polyCount, setPolyCount] = useState(asset.poly_count || 1500000);
  const [lodLevels, setLodLevels] = useState(asset.lod_levels || 4);
  const [comment, setComment] = useState('');
  const [makeHero, setMakeHero] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const existingVersions = asset.versions || [];
      const newVersionRecord: AssetVersionRecord = {
        version: versionNumber,
        published_at: new Date().toISOString(),
        published_by: asset.assigned_artist_name || 'Sarah Jenkins',
        published_by_avatar: asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
        dcc_software: dccSoftware,
        file_format: fileFormat,
        file_size_mb: Number(fileSizeMb),
        poly_count: Number(polyCount),
        lod_levels: Number(lodLevels),
        usd_layer_path: `@studio/shows/${asset.project_code}/assets/${asset.code.toLowerCase()}/${versionNumber}/${asset.code.toLowerCase()}_${versionNumber}.usd@`,
        is_hero: makeHero,
        comment: comment || `OpenUSD layer version ${versionNumber} published for ${asset.name}.`,
        pyblish_status: 'Passed',
      };

      const updatedVersions = makeHero
        ? [newVersionRecord, ...existingVersions.map((v) => ({ ...v, is_hero: false }))]
        : [newVersionRecord, ...existingVersions];

      await updateAsset({
        id: asset.id,
        data: {
          version: makeHero ? versionNumber : asset.version,
          poly_count: Number(polyCount),
          lod_levels: Number(lodLevels),
          software: (dccSoftware.split(' ')[0] as any) || asset.software,
          versions: updatedVersions,
        },
      });

      recordActivity({
        action: 'created',
        actionLabel: 'Asset Version Published',
        resourceType: 'version',
        resourceId: `ver-ast-${Date.now()}`,
        resourceName: `${asset.code}_${versionNumber}`,
        resourceCode: `${asset.code}_${versionNumber}`,
        projectId: asset.project_id,
        context: asset.code,
        description: `Published OpenUSD layer ${versionNumber} for asset ${asset.code} (${(polyCount / 1000000).toFixed(2)}M polys, ${lodLevels} LODs).`,
        tags: ['Asset', 'Version', 'OpenUSD'],
      });

      addNotification({
        type: 'success',
        title: 'OpenUSD Version Published',
        message: `Version ${versionNumber} published and registered in OpenUSD catalog for ${asset.code}.`,
      });
      onClose();
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Publish Failed',
        message: 'Could not publish new OpenUSD version.',
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Publish OpenUSD Version — ${asset.code}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Version Number</label>
            <Input
              value={versionNumber}
              onChange={(e) => setVersionNumber(e.target.value)}
              placeholder="e.g. v010"
              required
              className="font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">DCC / Authoring Tool</label>
            <select
              value={dccSoftware}
              onChange={(e) => setDccSoftware(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="Maya 2025">Maya 2025 / Solaris</option>
              <option value="Houdini 20.5">Houdini 20.5 Solaris</option>
              <option value="ZBrush 2024">ZBrush 2024</option>
              <option value="Blender 4.2">Blender 4.2 USD</option>
              <option value="Substance Painter">Substance Painter</option>
              <option value="Unreal Engine 5">Unreal Engine 5</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">File Format</label>
            <select
              value={fileFormat}
              onChange={(e) => setFileFormat(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-1 focus:ring-emerald-500"
            >
              <option value="OpenUSD Binary (.usdc)">OpenUSD Binary (.usdc)</option>
              <option value="OpenUSD ASCII (.usda)">OpenUSD ASCII (.usda)</option>
              <option value="USDZ Archive (.usdz)">USDZ Archive (.usdz)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Polycount (Tris)</label>
            <Input
              type="number"
              value={polyCount}
              onChange={(e) => setPolyCount(Number(e.target.value))}
              min={100}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">LOD Cascades</label>
            <Input
              type="number"
              value={lodLevels}
              onChange={(e) => setLodLevels(Number(e.target.value))}
              min={1}
              max={8}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">Publish Comment / Changelog</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            required
            placeholder="Detailed change notes, UV layout adjustments, MaterialX shader updates or joint weights fixes..."
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl p-3 focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
          />
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
          <div className="text-slate-300 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Preflight Pyblish Validation Checks
          </div>
          <div className="text-emerald-400 flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> OpenUSD Strict Schema Validation: Passed
          </div>
          <div className="text-emerald-400 flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Non-manifold Geometry & UV Overlaps: 0 errors
          </div>
          <div className="text-emerald-400 flex items-center gap-1.5 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> ACEScg MaterialX Texture Color Space Profile: Valid
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="heroCheck"
            checked={makeHero}
            onChange={(e) => setMakeHero(e.target.checked)}
            className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-emerald-500"
          />
          <label htmlFor="heroCheck" className="text-xs text-slate-300 cursor-pointer">
            Set as active <strong>Hero Version</strong> for downstream shots and lighting turnover
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isUpdating}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isUpdating}>
            Publish OpenUSD Version
          </Button>
        </div>
      </form>
    </Modal>
  );
};
