import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Box,
  ChevronLeft,
  Edit,
  CheckSquare,
  GitBranch,
  Film,
  Image as ImageIcon,
  Paperclip,
  Database,
  Activity,
  Archive,
  RotateCcw,
  Trash2,
  ExternalLink,
  Layers,
  Cpu,
  Sparkles,
  AlertCircle,
  Tag,
  Share2,
} from 'lucide-react';
import { useAsset, useAssets } from '../hooks/useAssets';
import { useAssetMutations } from '../hooks/useAssetMutations';
import { Button } from '@/shared/components/Button';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { Modal } from '@/shared/components/Modal';

// Tabs
import { AssetOverviewTab } from '../components/AssetOverviewTab';
import { AssetTasksTab } from '../components/AssetTasksTab';
import { AssetVersionsTab } from '../components/AssetVersionsTab';
import { AssetReviewsTab } from '../components/AssetReviewsTab';
import { AssetMediaTab } from '../components/AssetMediaTab';
import { AssetAttachmentsTab } from '../components/AssetAttachmentsTab';
import { AssetPublishingTab } from '../components/AssetPublishingTab';
import { AssetActivityTab } from '../components/AssetActivityTab';
import { AssetEditModal } from '../components/AssetEditModal';
import { ProductionStatus } from '@/types/common';

export const AssetWorkspacePage: React.FC = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { data: asset, isLoading, error } = useAsset(assetId || '');
  const { updateAsset, archiveAsset, restoreAsset, deleteAsset, isDeleting, isArchiving } = useAssetMutations();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
        <span className="text-xs text-slate-400 mt-3 font-mono">Loading OpenUSD asset manifest...</span>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Asset Entity Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested asset identifier could not be resolved in the production database.
        </p>
        <Link to="/assets">
          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
            Back to Asset Catalog
          </Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Box },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'versions', label: 'Versions', icon: GitBranch },
    { id: 'reviews', label: 'Reviews', icon: Film },
    { id: 'media', label: 'Media', icon: ImageIcon },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'publishing', label: 'Publishing', icon: Database },
    { id: 'activity', label: 'Activity', icon: Activity },
  ];

  const handleStatusChange = async (newStatus: ProductionStatus) => {
    await updateAsset({
      id: asset.id,
      data: { status: newStatus },
    });
  };

  const handleToggleArchive = async () => {
    if (asset.is_archived) {
      await restoreAsset(asset.id);
    } else {
      await archiveAsset(asset.id);
    }
  };

  const handleDeleteConfirm = async () => {
    await deleteAsset(asset.id);
    navigate('/assets');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back link & Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link to="/assets">
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>
              Asset Catalog
            </Button>
          </Link>
          <span className="text-slate-600">/</span>
          <Link to={`/projects/${asset.project_id}/assets`} className="text-xs font-mono text-slate-400 hover:text-white">
            {asset.project_code} ({asset.project_name || 'Production'})
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-xs font-mono text-emerald-400 font-bold">{asset.code}</span>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleArchive}
            isLoading={isArchiving}
            leftIcon={asset.is_archived ? <RotateCcw className="w-3.5 h-3.5 text-emerald-400" /> : <Archive className="w-3.5 h-3.5 text-amber-400" />}
          >
            {asset.is_archived ? 'Restore Asset' : 'Archive Asset'}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditOpen(true)}
            leftIcon={<Edit className="w-3.5 h-3.5" />}
          >
            Edit Metadata
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
            onClick={() => setIsDeleteModalOpen(true)}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Hero Workspace Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 backdrop-blur-md p-6 shadow-2xl relative overflow-hidden">
        {asset.is_archived && (
          <div className="mb-4 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300 font-mono">
            <span className="flex items-center gap-2">
              <Archive className="w-4 h-4" /> This asset is ARCHIVED. It is hidden from standard project turnarounds.
            </span>
            <Button size="sm" variant="primary" onClick={handleToggleArchive}>
              Restore to Active
            </Button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Left info */}
          <div className="flex items-start sm:items-center space-x-4">
            <img
              src={asset.thumbnail_url}
              alt={asset.name}
              className="w-20 h-20 rounded-xl object-cover ring-2 ring-emerald-500/30 shadow-lg shrink-0"
            />
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{asset.name}</h1>
                <Badge variant="outline" className="font-mono text-xs text-indigo-300 border-indigo-500/30">
                  {asset.category}
                </Badge>
                <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  {asset.version}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                <span>Code: <strong className="text-slate-200">{asset.code}</strong></span>
                <span>•</span>
                <span>Project: <strong className="text-slate-200">{asset.project_code}</strong></span>
                <span>•</span>
                <span>DCC: <strong className="text-cyan-300">{asset.software}</strong></span>
                <span>•</span>
                <span>Department: <strong className="text-slate-200">{asset.department_name}</strong></span>
              </div>
            </div>
          </div>

          {/* Right Status & Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-slate-950/80 p-2 rounded-xl border border-slate-800 flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase text-slate-500 pl-2">Status:</span>
              <select
                value={asset.status}
                onChange={(e) => handleStatusChange(e.target.value as ProductionStatus)}
                className="bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
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

            <Button
              size="sm"
              variant="primary"
              leftIcon={<Database className="w-4 h-4" />}
              onClick={() => alert(`Launching Hydra Viewport stage for ${asset.usd_prim_path || asset.code}`)}
            >
              USD Viewport
            </Button>
          </div>
        </div>

        {/* 8 First-Class Tabs Navigation Bar */}
        <div className="flex items-center space-x-1 border-t border-slate-800 mt-6 pt-3 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Render Active Tab Component */}
      <div className="mt-6">
        {activeTab === 'overview' && <AssetOverviewTab asset={asset} onNavigateTab={setActiveTab} />}
        {activeTab === 'tasks' && <AssetTasksTab asset={asset} />}
        {activeTab === 'versions' && <AssetVersionsTab asset={asset} />}
        {activeTab === 'reviews' && <AssetReviewsTab asset={asset} />}
        {activeTab === 'media' && <AssetMediaTab asset={asset} />}
        {activeTab === 'attachments' && <AssetAttachmentsTab asset={asset} />}
        {activeTab === 'publishing' && <AssetPublishingTab asset={asset} />}
        {activeTab === 'activity' && <AssetActivityTab asset={asset} />}
      </div>

      {/* Modals */}
      <AssetEditModal
        asset={asset}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Confirm Permanent Deletion"
      >
        <div className="space-y-4 text-xs text-slate-300">
          <p>
            Are you sure you want to permanently delete asset <strong className="text-white font-mono">{asset.name} ({asset.code})</strong>?
          </p>
          <p className="text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20 font-mono">
            Warning: This action will purge all registered OpenUSD composition layers, version records, and metadata links for this asset.
          </p>

          <div className="flex justify-end space-x-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
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
    </div>
  );
};
