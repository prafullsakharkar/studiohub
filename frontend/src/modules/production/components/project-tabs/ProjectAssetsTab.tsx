import React, { useState } from 'react';
import {
  Box,
  Plus,
  LayoutGrid,
  List,
  Search,
  Cpu,
  Layers,
  ExternalLink,
  Download,
} from 'lucide-react';
import { Project } from '@/types/projects';
import { useAssets } from '@/modules/assets/hooks/useAssets';
import { useAssetMutations } from '@/modules/assets/hooks/useAssetMutations';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Card, CardBody } from '@/shared/components/Card';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Modal } from '@/shared/components/Modal';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link } from 'react-router-dom';
import { Asset, AssetCategory } from '@/types/assets';

interface ProjectAssetsTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectAssetsTab: React.FC<ProjectAssetsTabProps> = ({ project }) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const openInspector = useInspectorStore((state) => state.openInspector);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: assetsData, isLoading } = useAssets({
    project_id: project.id,
    search: search || undefined,
    category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
    page_size: 50,
  });

  const { createAsset, isCreating } = useAssetMutations();

  const [formData, setFormData] = useState({
    name: '',
    code: `AST_${project.code}_`,
    category: 'Character' as AssetCategory,
    description: '',
    software: 'Maya' as const,
    file_format: 'OpenUSD (.usda/.usdc)',
    poly_count: 1200000,
    lod_levels: 4,
    assigned_artist_name: 'Sarah Jenkins',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAsset({
      ...formData,
      project_id: project.id,
      project_code: project.code,
      status: 'Not Started',
      version: 'v001',
      thumbnail_url:
        'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=600&auto=format&fit=crop&q=80',
    } as Partial<Asset>);
    setIsCreateOpen(false);
  };

  const assets = assetsData?.results || [];
  const categories = ['ALL', 'Character', 'Environment', 'Vehicle', 'Prop', 'FX Rig', 'Shader & LookDev'];

  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search asset name or code..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-1 overflow-x-auto">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs transition-colors ${
                viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Dense Table Matrix"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Register Asset
          </Button>

          <Link to="/assets">
            <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>
              Global Assets
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Indexing show OpenUSD assets..." />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Box className="w-8 h-8 text-purple-400" />}
          title="No OpenUSD Assets in this Show"
          description="Register 3D models, vehicles, and environments for pipeline stage composition."
          actionLabel="Register Asset"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              onClick={() => openInspector('asset', asset)}
              className="bg-slate-900 border-slate-800 hover:border-purple-500/40 transition-all cursor-pointer overflow-hidden flex flex-col justify-between group"
            >
              <div className="relative h-36 bg-slate-950 overflow-hidden">
                <img
                  src={asset.thumbnail_url}
                  alt={asset.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900/90 text-white border border-slate-700">
                    {asset.code}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-purple-500 text-white font-bold">
                    {asset.version}
                  </span>
                </div>
                <div className="absolute top-2 right-2">
                  <StatusBadge status={asset.status} />
                </div>
                <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-mono text-slate-300">
                  <span className="font-semibold text-white">{asset.category}</span>
                  <span>{asset.software}</span>
                </div>
              </div>

              <CardBody className="p-3.5 space-y-2">
                <h4 className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors line-clamp-1">
                  {asset.name}
                </h4>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{asset.description}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-indigo-400" />
                    <span>{(asset.poly_count / 1000000).toFixed(2)}M Tris</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-purple-400" />
                    <span>{asset.lod_levels} LODs</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                  <th className="py-2.5 px-3">Asset Code & Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">DCC Software</th>
                  <th className="py-2.5 px-3">Polygon Budget</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Lead Artist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => openInspector('asset', asset)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.name}
                          className="w-10 h-7 rounded object-cover border border-slate-800"
                        />
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-bold text-white">{asset.code}</span>
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                              {asset.version}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{asset.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-medium">{asset.category}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{asset.software}</td>
                    <td className="py-2.5 px-3 font-mono text-indigo-300">
                      {(asset.poly_count / 1000000).toFixed(2)}M Tris ({asset.lod_levels} LODs)
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="py-2.5 px-3 text-slate-200">{asset.assigned_artist_name || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Register Asset Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register OpenUSD Prim Asset"
        subtitle={`Cataloging 3D asset for show ${project.name} (${project.code})`}
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Asset Name</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Cyber Hovercraft Spinner"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Asset Code</label>
              <input
                required
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="AST_VEH_SPINNER_05"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as AssetCategory })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Character">Character</option>
                <option value="Environment">Environment</option>
                <option value="Vehicle">Vehicle</option>
                <option value="Prop">Prop</option>
                <option value="FX Rig">FX Rig</option>
                <option value="Shader & LookDev">Shader & LookDev</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Description</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Asset specifications, lookdev notes, and rigging requirements..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">DCC Software</label>
              <select
                value={formData.software}
                onChange={(e) => setFormData({ ...formData, software: e.target.value as any })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
              >
                <option value="Maya">Maya</option>
                <option value="Houdini">Houdini</option>
                <option value="Blender">Blender</option>
                <option value="ZBrush">ZBrush</option>
                <option value="Substance Painter">Substance Painter</option>
                <option value="Unreal Engine 5">Unreal Engine 5</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Poly Count</label>
              <input
                type="number"
                value={formData.poly_count}
                onChange={(e) => setFormData({ ...formData, poly_count: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">LOD Levels</label>
              <input
                type="number"
                value={formData.lod_levels}
                onChange={(e) => setFormData({ ...formData, lod_levels: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" isLoading={isCreating}>
              Register Prim
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
