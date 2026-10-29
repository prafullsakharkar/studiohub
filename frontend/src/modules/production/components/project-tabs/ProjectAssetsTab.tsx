import { useAssets, useAssetMutations, useBulkAssets, AssetBulkManager } from '@/modules/assets';

import React, { useState } from 'react';

import { SmartImg } from '@/components/ui/SmartImg';

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

  CheckSquare,

  Square,

  RotateCcw,

  Archive,

  Edit3,

  FileSpreadsheet,

} from 'lucide-react';

import { Project } from '@/types/production';

import { StatusBadge } from '@/shared/components/StatusBadge';

import { Button } from '@/shared/components/Button';

import { Card, CardBody } from '@/shared/components/Card';

import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

import { EmptyState } from '@/shared/components/EmptyState';

import { Modal } from '@/shared/components/Modal';

import { SearchInput } from '@/shared/components/SearchInput';

import { useInspectorStore } from '@/shared/stores/useInspectorStore';

import { useNotificationStore } from '@/shared/stores/useNotificationStore';

import { Link } from 'react-router-dom';

import { Asset, AssetCategory } from '@/types/production';

import { BulkActionBar } from '@/shared/components/bulk/BulkActionBar';

import { BulkUpdatePanel, FieldDefinition } from '@/shared/components/bulk/BulkUpdatePanel';

import { PermissionButton } from '@/core/permissions/PermissionComponents';

interface ProjectAssetsTabProps {

  project: Project;

  onNavigateTab: (tabId: string) => void;

}

const ASSET_BULK_FIELDS: FieldDefinition[] = [

  {

    key: 'status',

    label: 'Status',

    type: 'select',

    options: ['Not Started', 'In Progress', 'In Review', 'Approved', 'Blocked', 'On Hold'],

  },

  {

    key: 'category',

    label: 'Category',

    type: 'select',

    options: ['Character', 'Environment', 'Vehicle', 'Prop', 'FX Rig', 'Shader & LookDev', 'Matte Painting', 'Crowd Agent', 'Costume / Groom'],

  },

  {

    key: 'software',

    label: 'DCC Tool',

    type: 'select',

    options: ['Maya', 'Houdini', 'Blender', 'ZBrush', 'Substance Painter', 'Unreal Engine 5', 'Solaris', 'Mari'],

  },

  {

    key: 'assigned_artist_name',

    label: 'Assigned Artist',

    type: 'text',

    placeholder: 'e.g. Sarah Jenkins',

  },

  {

    key: 'lod_levels',

    label: 'LOD Levels',

    type: 'number',

    placeholder: '4',

  },

  {

    key: 'description',

    label: 'Asset Description',

    type: 'text',

    placeholder: 'Bulk notes or revision specs...',

  },

];

export const ProjectAssetsTab: React.FC<ProjectAssetsTabProps> = ({ project }) => {

  const [search, setSearch] = useState('');

  const [categoryFilter, setCategoryFilter] = useState('ALL');

  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const [isBulkManagerOpen, setIsBulkManagerOpen] = useState(false);

  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);

  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);

  const openInspector = useInspectorStore((state) => state.openInspector);

  const addNotification = useNotificationStore((state) => state.addNotification);

  const { data: assetsData, isLoading, refetch } = useAssets({

    project_id: project.id,

    search: search || undefined,

    category: categoryFilter !== 'ALL' ? categoryFilter : undefined,

    include_archived: includeDeleted ? 'true' : undefined,

    page_size: 50,

  });

  const { createAsset, isCreating } = useAssetMutations();

  const { bulkUpdate, bulkArchive, bulkRestore } = useBulkAssets();

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

  const assets = assetsData?.results || [];

  const selectedAssets = assets.filter((a) => selectedAssetIds.includes(a.id));

  const toggleSelectAsset = (id: string) => {

    setSelectedAssetIds((prev) =>

      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]

    );

  };

  const selectAllAssets = () => setSelectedAssetIds(assets.map((a) => a.id));

  const clearSelection = () => setSelectedAssetIds([]);

  const handleBulkArchive = async () => {

    if (selectedAssetIds.length === 0) return;

    await bulkArchive({ ids: selectedAssetIds });

    clearSelection();

    refetch();

  };

  const handleBulkRestore = async () => {

    if (selectedAssetIds.length === 0) return;

    await bulkRestore({ ids: selectedAssetIds });

    clearSelection();

    refetch();

  };

  const handleApplyBulkUpdate = async (changes: Partial<Asset>) => {

    const resp = await bulkUpdate({

      ids: selectedAssetIds,

      changes,

    });

    refetch();

    return resp;

  };

  const exportAssetsData = (format: 'csv' | 'json' = 'csv') => {

    const dataToExport = selectedAssets.length > 0 ? selectedAssets : assets;

    if (format === 'json') {

      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });

      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');

      link.href = url;

      link.download = `${project.code}_assets_${Date.now()}.json`;

      link.click();

      URL.revokeObjectURL(url);

      return;

    }

    const csvContent = [

      ['Asset Code', 'Name', 'Category', 'DCC Software', 'Poly Count', 'LODs', 'Status', 'Artist'].join(','),

      ...dataToExport.map((a) =>

        [

          a.code,

          `"${a.name}"`,

          a.category,

          a.software,

          a.poly_count,

          a.lod_levels,

          a.status,

          `"${a.assigned_artist_name || 'Unassigned'}"`,

        ].join(',')

      ),

    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download = `${project.code}_assets_${Date.now()}.csv`;

    link.click();

    URL.revokeObjectURL(url);

  };

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

  const categories = ['ALL', 'Character', 'Environment', 'Vehicle', 'Prop', 'FX Rig', 'Shader & LookDev'];

  return (

    <div className="space-y-4">

      {/* Filter and Action Bar */}

      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">

        <div className="flex items-center space-x-2 w-full sm:w-auto">

          <div className="w-full sm:w-64">

            <SearchInput

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              onClear={() => setSearch('')}

              placeholder="Search asset name or code..."

              className="w-full"

            />

          </div>

          <div className="flex items-center space-x-1 overflow-x-auto">

            {categories.slice(0, 5).map((cat) => (

              <button

                key={cat}

                onClick={() => setCategoryFilter(cat)}

                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap ${

                  categoryFilter === cat

                    ? 'bg-cyan-600 text-white shadow-xs'

                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'

                }`}

              >

                {cat}

              </button>

            ))}

          </div>

          <label className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 font-mono cursor-pointer ml-2">

            <input

              type="checkbox"

              checked={includeDeleted}

              onChange={(e) => setIncludeDeleted(e.target.checked)}

              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-cyan-500/20"

            />

            <span>Show Archived</span>

          </label>

        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">

          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">

            <button

              onClick={() => setViewMode('grid')}

              className={`p-1.5 rounded text-xs transition-colors ${

                viewMode === 'grid' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'

              }`}

              title="Grid View"

            >

              <LayoutGrid className="w-3.5 h-3.5" />

            </button>

            <button

              onClick={() => setViewMode('table')}

              className={`p-1.5 rounded text-xs transition-colors ${

                viewMode === 'table' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'

              }`}

              title="Dense Table Matrix"

            >

              <List className="w-3.5 h-3.5" />

            </button>

          </div>

          <PermissionButton

            permission="asset.bulk_update"

            context={{ projectId: project.id, organizationId: project.organization_id }}

            variant="secondary"

            size="sm"

            onClick={() => setIsBulkManagerOpen(true)}

            leftIcon={<FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />}

            className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/40"

          >

            Bulk Operations

          </PermissionButton>

          <PermissionButton

            permission="asset.create"

            context={{ projectId: project.id, organizationId: project.organization_id }}

            variant="primary"

            size="sm"

            onClick={() => setIsCreateOpen(true)}

            leftIcon={<Plus className="w-3.5 h-3.5" />}

            className="bg-cyan-600 hover:bg-cyan-500 text-white"

          >

            Register Asset

          </PermissionButton>

          <Link to="/assets">

            <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="w-3 h-3" />}>

              Global Assets

            </Button>

          </Link>

        </div>

      </div>

      {/* Bulk Action Bar for Selected Rows */}

      {selectedAssetIds.length > 0 && (

        <BulkActionBar

          selectedCount={selectedAssetIds.length}

          totalCount={assets.length}

          onClearSelection={clearSelection}

          onSelectAll={selectAllAssets}

          onOpenBulkUpdate={() => setIsBulkUpdateOpen(true)}

          onBulkArchive={handleBulkArchive}

          onBulkRestore={handleBulkRestore}

          onExportCSV={() => exportAssetsData('csv')}

          onExportJSON={() => exportAssetsData('json')}

          entityType="Asset"

        />

      )}

      {/* Content */}

      {isLoading ? (

        <LoadingSpinner size="lg" label="Indexing show OpenUSD assets..." />

      ) : assets.length === 0 ? (

        <EmptyState

          icon={<Box className="w-8 h-8 text-cyan-400" />}

          title="No OpenUSD Assets in this Show"

          description="Register 3D models, vehicles, and environments for pipeline stage composition or use Bulk Operations to import from spreadsheet."

          actionLabel="Register Asset"

          onAction={() => setIsCreateOpen(true)}

        />

      ) : viewMode === 'grid' ? (

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {assets.map((asset) => {

            const isSelected = selectedAssetIds.includes(asset.id);

            return (

              <Card

                key={asset.id}

                className={`bg-slate-900 border-slate-800 hover:border-cyan-500/40 transition-all overflow-hidden flex flex-col justify-between group relative ${

                  isSelected ? 'ring-2 ring-cyan-500 border-cyan-500' : ''

                }`}

              >

                {/* Checkbox overlay */}

                <div

                  className="absolute top-2.5 left-2.5 z-20 cursor-pointer"

                  onClick={(e) => {

                    e.stopPropagation();

                    toggleSelectAsset(asset.id);

                  }}

                >

                  <div className="p-1 rounded bg-slate-950/80 backdrop-blur-xs border border-slate-700 hover:border-cyan-400 transition-colors">

                    {isSelected ? (

                      <CheckSquare className="w-4 h-4 text-cyan-400" />

                    ) : (

                      <Square className="w-4 h-4 text-slate-400" />

                    )}

                  </div>

                </div>

                <div

                  onClick={() => openInspector('asset', asset)}

                  className="relative h-36 bg-slate-950 overflow-hidden cursor-pointer"

                >

                  <SmartImg

                    src={asset.thumbnail_url}

                    alt={asset.name}

                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"

                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                  <div className="absolute top-2 left-10 flex items-center gap-1.5">

                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900/90 text-white border border-slate-700">

                      {asset.code}

                    </span>

                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-cyan-500 text-white font-bold">

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

                <CardBody

                  onClick={() => openInspector('asset', asset)}

                  className="p-3.5 space-y-2 cursor-pointer"

                >

                  <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">

                    {asset.name}

                  </h4>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{asset.description}</p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">

                    <div className="flex items-center gap-1">

                      <Cpu className="w-3 h-3 text-cyan-400" />

                      <span>{(asset.poly_count / 1000000).toFixed(2)}M Tris</span>

                    </div>

                    <div className="flex items-center gap-1">

                      <Layers className="w-3 h-3 text-cyan-400" />

                      <span>{asset.lod_levels} LODs</span>

                    </div>

                  </div>

                </CardBody>

              </Card>

            );

          })}

        </div>

      ) : (

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">

          <div className="overflow-x-auto custom-scrollbar">

            <table className="w-full text-left border-collapse text-xs">

              <thead>

                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase tracking-wider text-slate-400 select-none">

                  <th className="py-2.5 px-3 w-8">

                    <button

                      onClick={selectedAssetIds.length === assets.length ? clearSelection : selectAllAssets}

                      className="text-slate-400 hover:text-white"

                    >

                      {selectedAssetIds.length === assets.length && assets.length > 0 ? (

                        <CheckSquare className="w-4 h-4 text-cyan-400" />

                      ) : (

                        <Square className="w-4 h-4" />

                      )}

                    </button>

                  </th>

                  <th className="py-2.5 px-3">Asset Code & Name</th>

                  <th className="py-2.5 px-3">Category</th>

                  <th className="py-2.5 px-3">DCC Software</th>

                  <th className="py-2.5 px-3">Polygon Budget</th>

                  <th className="py-2.5 px-3">Status</th>

                  <th className="py-2.5 px-3">Lead Artist</th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-800/60 font-sans">

                {assets.map((asset) => {

                  const isSelected = selectedAssetIds.includes(asset.id);

                  return (

                    <tr

                      key={asset.id}

                      className={`hover:bg-slate-800/40 transition-colors ${

                        isSelected ? 'bg-cyan-950/20' : ''

                      }`}

                    >

                      <td className="py-2.5 px-3">

                        <button

                          onClick={() => toggleSelectAsset(asset.id)}

                          className="text-slate-400 hover:text-white"

                        >

                          {isSelected ? (

                            <CheckSquare className="w-4 h-4 text-cyan-400" />

                          ) : (

                            <Square className="w-4 h-4" />

                          )}

                        </button>

                      </td>

                      <td

                        className="py-2.5 px-3 cursor-pointer"

                        onClick={() => openInspector('asset', asset)}

                      >

                        <div className="flex items-center gap-2">

                          <SmartImg

                            src={asset.thumbnail_url}

                            alt={asset.name}

                            className="w-10 h-7 rounded object-cover border border-slate-800"

                          />

                          <div>

                            <div className="flex items-center gap-1">

                              <span className="font-mono font-bold text-white">{asset.code}</span>

                              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300">

                                {asset.version}

                              </span>

                            </div>

                            <p className="text-[11px] text-slate-400">{asset.name}</p>

                          </div>

                        </div>

                      </td>

                      <td className="py-2.5 px-3 text-slate-300 font-medium">{asset.category}</td>

                      <td className="py-2.5 px-3 font-mono text-slate-300">{asset.software}</td>

                      <td className="py-2.5 px-3 font-mono text-cyan-300">

                        {(asset.poly_count / 1000000).toFixed(2)}M Tris ({asset.lod_levels} LODs)

                      </td>

                      <td className="py-2.5 px-3">

                        <StatusBadge status={asset.status} />

                      </td>

                      <td className="py-2.5 px-3 text-slate-200">{asset.assigned_artist_name || 'Unassigned'}</td>

                    </tr>

                  );

                })}

              </tbody>

            </table>

          </div>

        </div>

      )}

      {/* Bulk Update Modal Drawer */}

      {isBulkUpdateOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">

          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl p-6">

            <BulkUpdatePanel

              entityType="Asset"

              selectedEntities={selectedAssets}

              fieldDefinitions={ASSET_BULK_FIELDS}

              onApplyUpdate={handleApplyBulkUpdate}

              onClose={() => setIsBulkUpdateOpen(false)}

            />

          </div>

        </div>

      )}

      {/* Bulk Operations Manager Modal */}

      <AssetBulkManager

        projectId={project.id}

        projectCode={project.code}

        isOpen={isBulkManagerOpen}

        onClose={() => setIsBulkManagerOpen(false)}

        onSuccess={() => {

          refetch();

        }}

      />

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

              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-cyan-500"

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

                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-cyan-500"

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

            <Button

              variant="primary"

              size="sm"

              type="submit"

              isLoading={isCreating}

              className="bg-cyan-600 hover:bg-cyan-500 text-white"

            >

              Register Prim

            </Button>

          </div>

        </form>

      </Modal>

    </div>

  );

};
