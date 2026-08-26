import React, { useState } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Download,
  UploadCloud,
  Star,
  Cpu,
  Clock,
  Sparkles,
  GitBranch,
  ArrowRightLeft,
  FileCheck,
} from 'lucide-react';
import { Asset, AssetVersionRecord } from '@/mocks/db/assets/assets';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import { useAssetMutations } from '../hooks/useAssetMutations';

interface AssetVersionsTabProps {
  asset: Asset;
}

export const AssetVersionsTab: React.FC<AssetVersionsTabProps> = ({ asset }) => {
  const { updateAsset, isUpdating } = useAssetMutations();
  const [selectedVersion, setSelectedVersion] = useState<AssetVersionRecord | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  // Derive versions array
  const versions: AssetVersionRecord[] = asset.versions && asset.versions.length > 0
    ? asset.versions
    : [
        {
          version: asset.version || 'v009',
          published_at: asset.updated_at || '2026-08-20T14:30:00Z',
          published_by: asset.assigned_artist_name || 'Sarah Jenkins',
          published_by_avatar: asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          dcc_software: `${asset.software} 2025 / Solaris`,
          file_format: 'OpenUSD Binary (.usdc)',
          file_size_mb: 480,
          poly_count: asset.poly_count,
          lod_levels: asset.lod_levels,
          usd_layer_path: `@studio/shows/${asset.project_code}/assets/${asset.code.toLowerCase()}/${asset.version}/${asset.code.toLowerCase()}_${asset.version}.usd@`,
          is_hero: true,
          comment: 'Approved hero lookdev release with MaterialX shaders and ACEScg calibrated maps.',
          pyblish_status: 'Passed',
        },
        {
          version: 'v004',
          published_at: '2026-08-10T11:20:00Z',
          published_by: 'Sarah Jenkins',
          published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          dcc_software: `${asset.software} 2025`,
          file_format: 'OpenUSD Binary (.usdc)',
          file_size_mb: 420,
          poly_count: Math.round(asset.poly_count * 0.9),
          lod_levels: 3,
          usd_layer_path: `@studio/shows/${asset.project_code}/assets/${asset.code.toLowerCase()}/v004/${asset.code.toLowerCase()}_v004.usd@`,
          is_hero: false,
          comment: 'Refined SubD topology and generated LOD1 and LOD2 proxy meshes.',
          pyblish_status: 'Passed',
        },
        {
          version: 'v001',
          published_at: '2026-07-15T09:00:00Z',
          published_by: 'Sarah Jenkins',
          published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
          dcc_software: 'ZBrush 2024',
          file_format: 'OpenUSD ASCII (.usda)',
          file_size_mb: 290,
          poly_count: Math.round(asset.poly_count * 0.6),
          lod_levels: 1,
          usd_layer_path: `@studio/shows/${asset.project_code}/assets/${asset.code.toLowerCase()}/v001/${asset.code.toLowerCase()}_v001.usd@`,
          is_hero: false,
          comment: 'Initial rough blocking and proportion silhouette check.',
          pyblish_status: 'Passed',
        },
      ];

  const handlePromoteHero = async (ver: AssetVersionRecord) => {
    const updatedVersions = versions.map((v) => ({
      ...v,
      is_hero: v.version === ver.version,
    }));

    await updateAsset({
      id: asset.id,
      data: {
        version: ver.version,
        versions: updatedVersions,
      },
    });
  };

  const handlePublishNewVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextVerNum = parseInt(asset.version.replace('v', ''), 10) + 1 || 10;
    const nextVer = `v${nextVerNum.toString().padStart(3, '0')}`;

    const newVerRecord: AssetVersionRecord = {
      version: nextVer,
      published_at: new Date().toISOString(),
      published_by: 'Sarah Jenkins',
      published_by_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      dcc_software: `${asset.software} 2025`,
      file_format: 'OpenUSD Binary (.usdc)',
      file_size_mb: 512,
      poly_count: asset.poly_count,
      lod_levels: asset.lod_levels,
      usd_layer_path: `@studio/shows/${asset.project_code}/assets/${asset.code.toLowerCase()}/${nextVer}/${asset.code.toLowerCase()}_${nextVer}.usd@`,
      is_hero: true,
      comment: 'Pyblish auto-validated release payload with new shader parameter overrides.',
      pyblish_status: 'Passed',
    };

    const updatedVersions = [
      newVerRecord,
      ...versions.map((v) => ({ ...v, is_hero: false })),
    ];

    await updateAsset({
      id: asset.id,
      data: {
        version: nextVer,
        versions: updatedVersions,
      },
    });

    setIsPublishModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            OpenUSD Version History & Provenance
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable layer snapshots, Pyblish schema validation, and hero release pointers
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCompareModalOpen(true)}
            leftIcon={<ArrowRightLeft className="w-3.5 h-3.5" />}
          >
            Compare Versions
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsPublishModalOpen(true)}
            leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
          >
            Publish New Version
          </Button>
        </div>
      </div>

      {/* Version Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
              <tr>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Hero Tag</th>
                <th className="py-3 px-4">DCC / Format</th>
                <th className="py-3 px-4">Poly Count / LODs</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Pyblish QC</th>
                <th className="py-3 px-4">Author</th>
                <th className="py-3 px-4">Published Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {versions.map((ver) => (
                <tr
                  key={ver.version}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    ver.is_hero ? 'bg-indigo-950/20' : ''
                  }`}
                >
                  {/* Version */}
                  <td className="py-3.5 px-4 font-bold text-white">
                    <div className="flex items-center space-x-2">
                      <span className="text-emerald-400 font-bold">{ver.version}</span>
                      {ver.version === asset.version && (
                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] rounded font-semibold">
                          LIVE
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Hero Tag */}
                  <td className="py-3.5 px-4">
                    {ver.is_hero ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
                        <Star className="w-3 h-3 fill-amber-400" /> Hero Version
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePromoteHero(ver)}
                        className="text-[10px] h-6 px-2 text-slate-400 hover:text-amber-300"
                      >
                        Make Hero
                      </Button>
                    )}
                  </td>

                  {/* DCC / Format */}
                  <td className="py-3.5 px-4">
                    <div className="text-slate-200">{ver.dcc_software}</div>
                    <div className="text-[10px] text-slate-400">{ver.file_format}</div>
                  </td>

                  {/* Poly Count / LODs */}
                  <td className="py-3.5 px-4">
                    <div className="text-indigo-300">{(ver.poly_count / 1000000).toFixed(2)}M Tris</div>
                    <div className="text-[10px] text-slate-400">{ver.lod_levels} LOD Cascades</div>
                  </td>

                  {/* Size */}
                  <td className="py-3.5 px-4 text-slate-300">{ver.file_size_mb} MB</td>

                  {/* Pyblish QC */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Passed
                    </span>
                  </td>

                  {/* Author */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5">
                      <img
                        src={ver.published_by_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                        alt={ver.published_by}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                      <span className="text-slate-300 font-sans">{ver.published_by}</span>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                    {new Date(ver.published_at).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        leftIcon={<Download className="w-3 h-3" />}
                        onClick={() => alert(`Downloading OpenUSD payload for ${ver.version} (.usdc)`)}
                      >
                        USD
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compare Versions Modal */}
      <Modal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        title={`Compare OpenUSD Versions: ${asset.code}`}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="text-amber-400 font-bold">Hero Release (v009)</div>
              <div className="text-slate-400">Polycount: 3.84M Tris</div>
              <div className="text-slate-400">Materials: 18 MaterialX</div>
              <div className="text-slate-400">LOD Levels: 4</div>
              <div className="text-slate-400">Size: 480 MB</div>
              <div className="text-emerald-400">Status: LookDev Sign-off</div>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2">
              <div className="text-indigo-400 font-bold">Previous Snapshot (v004)</div>
              <div className="text-slate-400">Polycount: 3.20M Tris</div>
              <div className="text-slate-400">Materials: 12 MaterialX</div>
              <div className="text-slate-400">LOD Levels: 3</div>
              <div className="text-slate-400">Size: 420 MB</div>
              <div className="text-slate-400">Status: Intermediate Draft</div>
            </div>
          </div>

          <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-300">
            <span className="font-bold text-white block mb-1">OpenUSD Composition Diff Summary:</span>
            + Added payload reference `@./materials/clearcoat_carbon.mtlx@`<br />
            + Added USD Skel joint binding schema for thruster vectoring<br />
            + Optimized UV seams on UDIM tile 1004 & 1005
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsCompareModalOpen(false)}>
              Close Comparison
            </Button>
          </div>
        </div>
      </Modal>

      {/* Publish Version Modal */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title={`Publish New Version for ${asset.name}`}
      >
        <form onSubmit={handlePublishNewVersion} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Publish Comment / Changelog</label>
            <textarea
              rows={3}
              required
              placeholder="Describe changes, new textures, rig updates, or shader fixes..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs font-mono">
            <div className="text-slate-300 font-bold">Preflight Pyblish Checks</div>
            <div className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> OpenUSD Strict Schema Validation: Passed
            </div>
            <div className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Non-manifold Geometry & UV Overlaps: 0 errors
            </div>
            <div className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> ACEScg Texture Color Space Tags: Valid
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsPublishModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isUpdating}>
              Confirm & Publish OpenUSD Layer
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
