import React, { useState } from 'react';
import { useAssets } from '../hooks/useAssets';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { useProjects } from '@/modules/production/hooks/useProjects';
import { Button } from '@/shared/components/Button';
import { SearchInput } from '@/shared/components/SearchInput';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Badge } from '@/shared/components/Badge';
import { Modal } from '@/shared/components/Modal';
import {
  Box,
  Plus,
  Layers,
  Cpu,
  Database,
  List,
  LayoutGrid,
  Sparkles,
  FolderTree,
  Image as ImageIcon,
  Filter,
  ExternalLink,
  Archive,
  RotateCcw,
  Edit,
  Trash2,
  Download,
  Users2,
  Film,
  SlidersHorizontal,
} from 'lucide-react';
import { Asset, AssetCategory, AssetSoftware } from '@/mocks/db/assets/assets';
import { ProductionStatus } from '@/types/common';
import { useInspectorStore } from '@/shared/stores/useInspectorStore';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link } from 'react-router-dom';

// Subcomponents
import { AssetGalleryView } from '../components/AssetGalleryView';
import { AssetHierarchyTree } from '../components/AssetHierarchyTree';
import { AssetCreateModal } from '../components/AssetCreateModal';
import { AssetEditModal } from '../components/AssetEditModal';

export const AssetsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('ALL');
  const [artistFilter, setArtistFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [versionFilter, setVersionFilter] = useState<string>('ALL');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [archiveFilter, setArchiveFilter] = useState<'active' | 'archived' | 'all'>('active');

  const [viewMode, setViewMode] = useState<'table' | 'grid' | 'gallery' | 'hierarchy'>('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const openInspector = useInspectorStore((state) => state.openInspector);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: projectsData } = useProjects();
  const { data, isLoading } = useAssets({
    search: search || undefined,
    project_id: projectFilter !== 'ALL' ? projectFilter : undefined,
  });

  const { updateAsset, archiveAsset, restoreAsset, deleteAsset, isDeleting } = useAssetMutations();

  const allAssets = data?.results || [];

  // Filter pipeline
  const filteredAssets = allAssets.filter((asset) => {
    // Search
    if (search) {
      const q = search.toLowerCase();
      const match =
        asset.name.toLowerCase().includes(q) ||
        asset.code.toLowerCase().includes(q) ||
        (asset.description && asset.description.toLowerCase().includes(q)) ||
        (asset.assigned_artist_name && asset.assigned_artist_name.toLowerCase().includes(q));
      if (!match) return false;
    }

    // Category / Asset Type
    if (categoryFilter !== 'ALL' && asset.category !== categoryFilter) return false;

    // Department
    if (departmentFilter !== 'ALL' && asset.department_name !== departmentFilter) return false;

    // Status
    if (statusFilter !== 'ALL' && asset.status !== statusFilter) return false;

    // Task Status
    if (taskStatusFilter !== 'ALL' && asset.task_status !== taskStatusFilter) return false;

    // Artist
    if (artistFilter !== 'ALL' && asset.assigned_artist_name !== artistFilter) return false;

    // Team
    if (teamFilter !== 'ALL' && asset.team_name !== teamFilter) return false;

    // Version
    if (versionFilter !== 'ALL' && asset.version !== versionFilter) return false;

    // Review Status
    if (reviewStatusFilter !== 'ALL' && asset.review_status !== reviewStatusFilter) return false;

    // Project
    if (projectFilter !== 'ALL' && asset.project_id !== projectFilter && asset.project_code !== projectFilter)
      return false;

    // Archive
    if (archiveFilter === 'active' && asset.is_archived) return false;
    if (archiveFilter === 'archived' && !asset.is_archived) return false;

    return true;
  });

  const categories: string[] = [
    'ALL',
    'Character',
    'Environment',
    'Vehicle',
    'Prop',
    'FX Rig',
    'Shader & LookDev',
    'Crowd Agent',
    'Costume / Groom',
  ];

  const handleStatusQuickChange = async (asset: Asset, newStatus: ProductionStatus) => {
    await updateAsset({
      id: asset.id,
      data: { status: newStatus },
    });
  };

  const handleToggleArchive = async (asset: Asset) => {
    if (asset.is_archived) {
      await restoreAsset(asset.id);
    } else {
      await archiveAsset(asset.id);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingAsset) {
      await deleteAsset(deletingAsset.id);
      setDeletingAsset(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 text-slate-100">
      {/* Studio Header Bar */}
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 py-3.5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Box className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  Production Assets
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-semibold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  OpenUSD 23.11
                </span>
                <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
                  {filteredAssets.length} Assets
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Production asset entities, OpenUSD composition sublayers, LOD cascades, and lookdev turnovers
              </p>
            </div>
          </div>

          {/* View Switchers & Actions */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* 4 View Modes */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('gallery')}
                title="Showcase Gallery"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'gallery'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('hierarchy')}
                title="Stage Hierarchy Tree"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'hierarchy'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FolderTree className="w-4 h-4" />
              </button>
            </div>

            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Register Asset
            </Button>
          </div>
        </div>
      </div>

      {/* Main Studio View */}
      <div className="flex-1 min-h-0 p-4 sm:p-6 space-y-6 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Main Filter & Category Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="w-full md:w-80">
            <SearchInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets by code, name, artist, prim..."
            />
          </div>

          {/* Quick Category Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs font-mono">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all ${
                  categoryFilter === cat
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                {cat === 'ALL' ? 'All Types' : cat}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant={showAdvancedFilters ? 'primary' : 'outline'}
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            className="text-xs h-9"
          >
            Filters {showAdvancedFilters ? '▲' : '▼'}
          </Button>
        </div>

        {/* Expandable Advanced Multi-Filter Grid */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
            {/* Department */}
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Depts</option>
                <option value="3D Modeling & Assets">3D Modeling</option>
                <option value="LookDev & Shading">LookDev & Shading</option>
                <option value="Character & Creature Rigging">Rigging</option>
                <option value="CFX & Groom">CFX Groom</option>
                <option value="FX & Simulation">FX Simulation</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Asset Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="In Progress">In Progress</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Retake">Retake</option>
                <option value="On Hold">On Hold</option>
                <option value="Not Started">Not Started</option>
                <option value="Archived">Archived</option>
              </select>
            </div>

            {/* Artist */}
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Artist</label>
              <select
                value={artistFilter}
                onChange={(e) => setArtistFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Artists</option>
                <option value="Sarah Jenkins">Sarah Jenkins</option>
                <option value="Elena Rostova">Elena Rostova</option>
                <option value="Marcus Vance">Marcus Vance</option>
                <option value="Kenji Takahashi">Kenji Takahashi</option>
              </select>
            </div>

            {/* Team */}
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Team Crew</label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Teams</option>
                <option value="Hero Asset Crew">Hero Asset Crew</option>
                <option value="Cyber Creature Unit">Cyber Creature Unit</option>
                <option value="LookDev & Shading Unit">LookDev Unit</option>
              </select>
            </div>

            {/* Version */}
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Version</label>
              <select
                value={versionFilter}
                onChange={(e) => setVersionFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">All Versions</option>
                <option value="v001">v001</option>
                <option value="v004">v004</option>
                <option value="v005">v005</option>
                <option value="v006">v006</option>
                <option value="v007">v007</option>
                <option value="v008">v008</option>
                <option value="v009">v009</option>
                <option value="v011">v011</option>
              </select>
            </div>

            {/* Archive Filter */}
            <div>
              <label className="text-[10px] uppercase text-slate-500 block mb-1">Archive State</label>
              <select
                value={archiveFilter}
                onChange={(e) => setArchiveFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-1 focus:ring-emerald-500"
              >
                <option value="active">Active Only</option>
                <option value="archived">Archived Only</option>
                <option value="all">Include All</option>
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
          <span>
            Displaying <strong className="text-white">{filteredAssets.length}</strong> production asset{filteredAssets.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => {
              setSearch('');
              setCategoryFilter('ALL');
              setDepartmentFilter('ALL');
              setStatusFilter('ALL');
              setArtistFilter('ALL');
              setTeamFilter('ALL');
              setVersionFilter('ALL');
              setReviewStatusFilter('ALL');
              setArchiveFilter('active');
            }}
            className="text-indigo-400 hover:text-indigo-300"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Main Content View Switcher */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <LoadingSpinner size="lg" />
          <span className="text-xs text-slate-400 mt-3 font-mono">Querying OpenUSD asset catalog...</span>
        </div>
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          icon={<Box className="w-10 h-10 text-slate-500" />}
          title="No production assets matched your filters"
          description="Try broadening your category or filter selections, or register a new asset."
          actionLabel="Register Asset"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : viewMode === 'gallery' ? (
        <AssetGalleryView assets={filteredAssets} />
      ) : viewMode === 'hierarchy' ? (
        <AssetHierarchyTree assets={filteredAssets} />
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Asset</th>
                  <th className="py-3.5 px-4">Code / Prim</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Show</th>
                  <th className="py-3.5 px-4">DCC / Version</th>
                  <th className="py-3.5 px-4">Poly Budget</th>
                  <th className="py-3.5 px-4">Lead Modeler</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAssets.map((asset) => {
                  const polyMillions = (asset.poly_count / 1000000).toFixed(2);
                  return (
                    <tr
                      key={asset.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        asset.is_archived ? 'opacity-60 bg-slate-950/40' : ''
                      }`}
                    >
                      {/* Asset */}
                      <td className="py-3 px-4">
                        <Link to={`/assets/${asset.id}`} className="flex items-center space-x-3 group">
                          <img
                            src={asset.thumbnail_url}
                            alt={asset.name}
                            className="w-10 h-10 rounded-lg object-cover ring-1 ring-slate-800 shrink-0 group-hover:ring-emerald-500"
                          />
                          <div>
                            <span className="font-bold text-white group-hover:text-emerald-400 transition-colors font-sans text-xs line-clamp-1">
                              {asset.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono block">
                              {asset.department_name}
                            </span>
                          </div>
                        </Link>
                      </td>

                      {/* Code / Prim */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-emerald-400">{asset.code}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[130px]" title={asset.usd_prim_path}>
                          {asset.usd_prim_path || `/World/Assets/${asset.code}`}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] font-mono text-indigo-300 border-indigo-500/30">
                          {asset.category}
                        </Badge>
                      </td>

                      {/* Show */}
                      <td className="py-3 px-4 font-bold text-slate-300">{asset.project_code}</td>

                      {/* DCC / Version */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-cyan-300 font-semibold">{asset.software}</span>
                          <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 text-[10px] rounded font-bold">
                            {asset.version}
                          </span>
                        </div>
                      </td>

                      {/* Poly Budget */}
                      <td className="py-3 px-4">
                        <div className="text-indigo-300">
                          {asset.poly_count > 0 ? `${polyMillions}M Tris` : 'Volumetric'}
                        </div>
                        <div className="text-[10px] text-slate-500">{asset.lod_levels} LODs</div>
                      </td>

                      {/* Artist */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5 font-sans">
                          <img
                            src={asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                            alt={asset.assigned_artist_name || 'Artist'}
                            className="w-5 h-5 rounded-full object-cover"
                          />
                          <span className="text-slate-300 text-xs">{asset.assigned_artist_name || 'Sarah Jenkins'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <select
                          value={asset.status}
                          onChange={(e) => handleStatusQuickChange(asset, e.target.value as ProductionStatus)}
                          className="bg-slate-950 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-emerald-500 font-medium"
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Pending Review">Pending Review</option>
                          <option value="Approved">Approved</option>
                          <option value="Retake">Retake</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Link to={`/assets/${asset.id}`}>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="Open Asset Workspace">
                              <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setEditingAsset(asset)}
                            title="Edit Asset Metadata"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-amber-400"
                            onClick={() => handleToggleArchive(asset)}
                            title={asset.is_archived ? 'Restore Asset' : 'Archive Asset'}
                          >
                            {asset.is_archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-rose-400 hover:text-rose-300"
                            onClick={() => setDeletingAsset(asset)}
                            title="Delete Asset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map((asset) => {
            const polyMillions = (asset.poly_count / 1000000).toFixed(2);
            return (
              <div
                key={asset.id}
                className={`group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden shadow-xl transition-all hover:-translate-y-1 flex flex-col justify-between ${
                  asset.is_archived ? 'opacity-70' : ''
                }`}
              >
                <div>
                  {/* Thumbnail Card Header */}
                  <div className="relative aspect-16/10 bg-slate-950 overflow-hidden">
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-950/85 backdrop-blur-md text-emerald-400 border border-slate-800">
                        {asset.version}
                      </span>
                      <StatusBadge status={asset.status} />
                    </div>

                    <div className="absolute bottom-2.5 left-2.5">
                      <Badge variant="outline" className="text-[10px] font-mono bg-slate-950/80 backdrop-blur-md text-indigo-300 border-indigo-500/30">
                        {asset.category}
                      </Badge>
                    </div>

                    {asset.is_archived && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-mono font-bold">
                          ARCHIVED
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-3">
                    <div>
                      <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                        <span>{asset.project_code}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{asset.code}</span>
                      </div>
                      <Link to={`/assets/${asset.id}`}>
                        <h3 className="text-sm font-bold text-white hover:text-emerald-400 transition-colors mt-0.5 line-clamp-1">
                          {asset.name}
                        </h3>
                      </Link>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {asset.description}
                    </p>

                    {/* Specs Pills */}
                    <div className="flex items-center justify-between text-[11px] font-mono bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      <span className="text-cyan-300">{asset.software}</span>
                      <span className="text-indigo-300">{asset.poly_count > 0 ? `${polyMillions}M Tris` : 'Volumetric'}</span>
                      <span className="text-slate-400">{asset.lod_levels} LODs</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-slate-950/70 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <img
                      src={asset.assigned_artist_avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                      alt={asset.assigned_artist_name || 'Artist'}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                    <span className="text-xs text-slate-300">{asset.assigned_artist_name || 'Sarah Jenkins'}</span>
                  </div>

                  <Link to={`/assets/${asset.id}`}>
                    <Button size="sm" variant="ghost" className="text-xs h-7 px-2 hover:bg-slate-800">
                      Workspace <ExternalLink className="w-3 h-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <AssetCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Edit Modal */}
      {editingAsset && (
        <AssetEditModal
          asset={editingAsset}
          isOpen={!!editingAsset}
          onClose={() => setEditingAsset(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingAsset && (
        <Modal
          isOpen={!!deletingAsset}
          onClose={() => setDeletingAsset(null)}
          title="Confirm Asset Deletion"
        >
          <div className="space-y-4 text-xs text-slate-300">
            <p>
              Are you sure you want to permanently delete asset <strong className="text-white font-mono">{deletingAsset.name} ({deletingAsset.code})</strong>?
            </p>
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 font-mono">
              Warning: This will remove this asset from the OpenUSD project catalog and delete its layer references.
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setDeletingAsset(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={isDeleting}
                onClick={handleDeleteConfirm}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                Delete Asset
              </Button>
            </div>
          </div>
        </Modal>
      )}
      </div>
    </div>
  );
};
