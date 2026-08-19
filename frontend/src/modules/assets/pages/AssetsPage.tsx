import React, { useState } from 'react';
import { useAssets } from '../hooks/useAssets';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Card, CardBody } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Pagination } from '@/shared/components/Pagination';
import { Modal } from '@/shared/components/Modal';
import { Can } from '@/core/permissions/Can';
import { HasRole } from '@/core/permissions/HasRole';
import {
  Box,
  Plus,
  CheckCircle2,
  Layers,
  Cpu,
  Database,
  List,
  LayoutGrid,
  Download,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import { Asset, AssetCategory } from '@/mocks/db/assets/assets';
import { ProductionStatus } from '@/types/common';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const AssetsPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const openInspector = useInspectorStore((state) => state.openInspector);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: projectsData } = useProjects();
  const { data, isLoading } = useAssets({
    page,
    page_size: viewMode === 'table' ? 10 : 6,
    search: search || undefined,
    category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
    project_id: projectFilter !== 'ALL' ? projectFilter : undefined,
  });

  const { createAsset, updateAsset, isCreating } = useAssetMutations();

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'Character' as AssetCategory,
    description: '',
    software: 'Maya' as const,
    file_format: 'USD / Alembic (.abc)',
    poly_count: 1500000,
    lod_levels: 4,
    assigned_artist_name: 'Sarah Jenkins',
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAsset({
      ...formData,
      project_id: projectsData?.results[0]?.id || 'proj-001',
      project_code: projectsData?.results[0]?.code || 'NK99',
      status: 'Not Started',
      version: 'v001',
      thumbnail_url: 'https://images.unsplash.com/photo-1546776310-eef45dd6d63c?w=600&auto=format&fit=crop&q=80',
    } as Partial<Asset>);
    setIsCreateOpen(false);
  };

  const exportUSDManifest = () => {
    addNotification({
      type: 'info',
      title: 'OpenUSD Stage Manifest Exported',
      message: 'Generated composition graph with all active assets in NK99.',
    });
  };

  const assets = data?.results || [];
  const totalCount = data?.count || 0;

  const categories: string[] = ['ALL', 'Character', 'Environment', 'Vehicle', 'Prop', 'FX Rig', 'Shader & LookDev'];

  return (
    <div className="space-y-4 max-w-7xl mx-auto font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Box className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              OpenUSD Asset Directory
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-800 text-emerald-300 rounded border border-slate-700">
                {totalCount} Assets
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Geometry sublayers, polygon budgets, MaterialX lookdev versions, and LOD cascades
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={exportUSDManifest}
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Export USDA
          </Button>

          <Can permission="assets:create">
            <Button
              id="register-asset-btn"
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Register Asset
            </Button>
          </Can>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <SearchInput
            className="w-full sm:w-72"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            onClear={() => {
              setSearch('');
              setPage(1);
            }}
            placeholder="Search code, model, artist..."
          />

          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="ALL">All Shows</option>
            {projectsData?.results.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between sm:justify-end space-x-2 w-full md:w-auto overflow-x-auto">
          {/* Category Pills */}
          <div className="flex items-center space-x-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategoryFilter(cat);
                  setPage(1);
                }}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* View Switcher */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Asset Card Grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Dense Matrix Table View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Indexing OpenUSD asset repository..." />
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Box className="w-8 h-8 text-emerald-400" />}
          title="No Digital Assets Found"
          description="There are no assets matching your current filter criteria."
          actionLabel="Register Asset"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'table' ? (
        /* Dense Matrix Table View */
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">
                  <th className="py-2.5 px-3">Asset Code & Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">DCC Software</th>
                  <th className="py-2.5 px-3">Polygon Budget</th>
                  <th className="py-2.5 px-3">LODs & Format</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Lead Modeler</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <div
                        onClick={() => openInspector('asset', asset)}
                        className="flex items-center space-x-2.5 cursor-pointer group"
                      >
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.name}
                          className="w-10 h-7 object-cover rounded bg-slate-950 shrink-0 border border-slate-800 group-hover:border-emerald-500/50 transition-colors"
                        />
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-mono font-bold text-white text-xs group-hover:text-emerald-400 transition-colors">
                              {asset.code}
                            </span>
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                              {asset.version}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{asset.name}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-slate-300 font-medium">
                      {asset.category}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                      {asset.software}
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-indigo-300">
                      {(asset.poly_count / 1000000).toFixed(2)}M Tris
                    </td>

                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {asset.lod_levels} LODs ({asset.file_format.split('/')[0].trim()})
                    </td>

                    <td className="py-2.5 px-3">
                      <select
                        value={asset.status}
                        onChange={(e) =>
                          updateAsset({ id: asset.id, data: { status: e.target.value as ProductionStatus } })
                        }
                        className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-[11px] font-medium focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Pending Review">Pending Review</option>
                        <option value="Approved">Approved</option>
                        <option value="Retake">Retake</option>
                      </select>
                    </td>

                    <td className="py-2.5 px-3 text-slate-300 text-xs">
                      {asset.assigned_artist_name || 'Unassigned'}
                    </td>

                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => openInspector('asset', asset)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-300"
                        title="Inspect OpenUSD Prim Details"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={10}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <Card
                key={asset.id}
                onClick={() => openInspector('asset', asset)}
                className="bg-slate-900 border-slate-800 hover:border-emerald-500/40 transition-all overflow-hidden flex flex-col justify-between cursor-pointer group"
              >
                {/* Thumbnail Header */}
                <div className="relative h-40 bg-slate-950 overflow-hidden">
                  <img
                    src={asset.thumbnail_url}
                    alt={asset.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-900/90 text-white border border-slate-700">
                      {asset.code}
                    </span>
                    <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-emerald-500 text-white font-semibold">
                      {asset.version}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2">
                    <StatusBadge status={asset.status} />
                  </div>
                  <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-slate-300 font-mono">
                    <span className="font-semibold text-white">{asset.category}</span>
                    <span>{asset.software}</span>
                  </div>
                </div>

                {/* Body */}
                <CardBody className="p-3.5 space-y-2.5">
                  <h3 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-1">
                    {asset.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {asset.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3 h-3 text-indigo-400" />
                      <span>{(asset.poly_count / 1000000).toFixed(2)}M Tris</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-3 h-3 text-emerald-400" />
                      <span>{asset.lod_levels} LODs</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                    <span>Artist: <strong className="text-slate-200">{asset.assigned_artist_name || 'Unassigned'}</strong></span>
                    <span className="text-emerald-400 text-[10px] font-mono">Inspect OpenUSD →</span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>

          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={6}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* Register Asset Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register OpenUSD Asset"
        description="Catalog 3D character, vehicle, or environment model for pipeline sharing."
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">Asset Name</label>
            <input
              required
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Cyber Spinner Mark V"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-2 focus:ring-emerald-500"
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
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono"
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
              Register Asset
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
