import { useVersions } from '@/modules/versions';

import { useTasks } from '@/modules/tasks';

import React, { useState, useMemo } from 'react';

import { SmartImg } from '@/components/ui/SmartImg';

import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';

import { useAsset, useAssets } from '../hooks/useAssets';

import { useAssetMutations } from '../hooks/useAssetMutations';

import { useNotificationStore } from '@/shared/stores/useNotificationStore';

import {

  Box,

  LayoutGrid,

  CheckSquare,

  GitBranch,

  Film,

  FileText,

  Activity,

  HardDrive,

  Users,

  Clock,

  Edit,

  UserCheck,

  Plus,

  Copy,

  CheckCircle2,

  Archive,

  RotateCcw,

  Trash2,

  AlertCircle,

  ChevronLeft,

  Share2,

  Layers,

  Database,

  Cpu,

  Sparkles,

  GitFork,

  Clapperboard,

  Paperclip,

  History,

  Image as ImageIcon,

} from 'lucide-react';

import {

  CanonicalWorkspaceHeader,

  WorkspaceShell,

  WorkspaceAction,

  BreadcrumbItem,

} from '@/shared/workspace/canonical';

import { ScrollableTabs, TabItem } from '@/shared/components/tabs/ScrollableTabs';

import { LoadingSpinner } from '@/shared/components/LoadingSpinner';

import { Button } from '@/shared/components/Button';

import { Modal } from '@/shared/components/Modal';

import { ProductionStatus } from '@/types/common';

// Tab components

import { AssetOverviewTab } from '../components/AssetOverviewTab';

import { AssetShotsPanel, EntityTasksPanel, WorkHistoryPanel } from '@/modules/production/work/panels';

import { AssetVersionsTab } from '../components/AssetVersionsTab';

import { AssetReviewsTab } from '../components/AssetReviewsTab';

import { AssetAssignmentsTab } from '../components/AssetAssignmentsTab';

import { AssetDependenciesTab } from '../components/AssetDependenciesTab';


import { AssetNotesTab } from '../components/AssetNotesTab';

import { AssetMediaTab } from '../components/AssetMediaTab';

import { AssetAttachmentsTab } from '../components/AssetAttachmentsTab';

import { AssetPublishingTab } from '../components/AssetPublishingTab';


// Modals

import { AssetAssignModal } from '../components/modals/AssetAssignModal';

import { AssetSubmitVersionModal } from '../components/modals/AssetSubmitVersionModal';

import { AssetAddNoteModal } from '../components/modals/AssetAddNoteModal';

export const AssetWorkspacePage: React.FC = () => {

  const params = useParams<{

    projectId?: string;

    assetId?: string;

    id?: string;

    tab?: string;

  }>();

  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();

  const { addNotification } = useNotificationStore();

  const resolvedAssetId = params.assetId || params.id || '';

  const resolvedTab = params.tab || searchParams.get('tab') || 'overview';

  // Query asset data

  const { data: asset, isLoading, error } = useAsset(resolvedAssetId);

  const { data: assetsData } = useAssets({ project_id: asset?.project_id });

  const allAssetsList = useMemo(() => {

    if (!assetsData) return [];

    if (Array.isArray(assetsData)) return assetsData;

    return assetsData.results || [];

  }, [assetsData]);

  const {

    updateAsset,

    archiveAsset,

    restoreAsset,

    deleteAsset,

    isArchiving,

    isDeleting,

  } = useAssetMutations();

  // Queries for related child entities

  const { data: tasksData } = useTasks({ page_size: 100 });

  const { data: versionsData } = useVersions({ page_size: 100 });

  // Filter tasks & versions for this asset

  const assetTasks = useMemo(() => {

    if (!tasksData?.results || !asset) return [];

    return tasksData.results.filter(

      (t) =>

        t.entity_id === asset.id ||

        (t as any).asset_id === asset.id ||

        t.code?.startsWith(asset.code) ||

        t.title?.includes(asset.code) ||

        (t as any).name?.includes(asset.code)

    );

  }, [tasksData, asset]);

  const assetVersions = useMemo(() => {

    if (asset?.versions && asset.versions.length > 0) {

      return asset.versions;

    }

    if (!versionsData?.results || !asset) return [];

    return versionsData.results.filter(

      (v) =>

        v.entity_id === asset.id ||

        v.entity_name === asset.code ||

        v.code?.startsWith(asset.code)

    );

  }, [versionsData, asset]);

  // Modals state

  const [isAssignOpen, setIsAssignOpen] = useState(false);

  const [isSubmitVersionOpen, setIsSubmitVersionOpen] = useState(false);

  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleTabChange = (tabId: string) => {

    if (params.tab) {

      const basePath = window.location.pathname.substring(

        0,

        window.location.pathname.lastIndexOf('/')

      );

      navigate(`${basePath}/${tabId}`);

    } else {

      setSearchParams({ tab: tabId });

    }

  };

  // Breadcrumbs

  const breadcrumbs: BreadcrumbItem[] = useMemo(() => {

    if (!asset) return [];

    const projId = params.projectId || asset.project_id;

    return [

      {

        label: 'StudioHub',

        href: '/',

      },

      {

        label: asset.project_code || 'Project',

        href: projId ? `/projects/${projId}` : '/projects',

      },

      {

        label: 'Assets',

        href: projId ? `/projects/${projId}/assets` : '/assets',

      },

      {

        label: asset.code,

        isCurrent: true,

      },

    ];

  }, [asset, params]);

  // Standardized Declarative Workspace Actions

  const workspaceActions: WorkspaceAction[] = useMemo(() => {

    if (!asset) return [];

    const isArchived = Boolean(asset.is_archived || asset.status === 'Archived');

    return [

      // Primary Action

      {

        id: 'edit-asset',

        label: 'Edit Asset',

        icon: <Edit className="w-3.5 h-3.5" />,

        variant: 'primary',

        permission: 'asset.update',

        shortcut: '⌘E',

        onClick: () => navigate(`/assets/${asset.id}/edit`),

      },

      // Secondary Action: Assign

      {

        id: 'assign-artist',

        label: asset.assigned_artist_name ? 'Reassign Artist' : 'Assign Artist',

        icon: <UserCheck className="w-3.5 h-3.5" />,

        variant: 'secondary',

        permission: 'asset.assign',

        onClick: () => setIsAssignOpen(true),

      },

      // Secondary Action: Add Task

      {

        id: 'add-task',

        label: 'Add Task',

        icon: <Plus className="w-3.5 h-3.5" />,

        variant: 'outline',

        permission: 'task.create',

        onClick: () => navigate(`/tasks/new?project=${asset.project_id}&entity_type=Asset&entity_id=${asset.id}`),

      },

      // Overflow Actions

      {

        id: 'submit-version',

        label: 'Publish OpenUSD Version',

        icon: <GitBranch className="w-3.5 h-3.5" />,

        permission: 'version.create',

        onClick: () => setIsSubmitVersionOpen(true),

      },

      {

        id: 'add-note',

        label: 'Add Production Note',

        icon: <FileText className="w-3.5 h-3.5" />,

        onClick: () => setIsAddNoteOpen(true),

      },

      {

        id: 'approve-asset',

        label: 'Approve & Sign-off Asset',

        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,

        permission: 'asset.approve',

        visible: asset.status !== 'Approved',

        onClick: async () => {

          await updateAsset({

            id: asset.id,

            data: { status: 'Approved' },

          });

          addNotification({

            type: 'success',

            title: 'Asset Approved',

            message: `Asset ${asset.code} signed off for production turnover.`,

          });

        },

      },

      {

        id: 'usd-viewport',

        label: 'Launch USD Viewport',

        icon: <Database className="w-3.5 h-3.5 text-cyan-400" />,

        onClick: () => {

          handleTabChange('overview');

          addNotification({

            type: 'info',

            title: 'Hydra Viewport Active',

            message: `Loading stage @${asset.usd_prim_path || asset.code}@`,

          });

        },

      },

      {

        id: 'copy-asset-code',

        label: 'Copy Asset Code',

        icon: <Copy className="w-3.5 h-3.5" />,

        onClick: () => {

          navigator.clipboard.writeText(asset.code);

          addNotification({

            type: 'info',

            title: 'Copied to Clipboard',

            message: `Asset code ${asset.code} copied.`,

          });

        },

      },

      {

        id: 'copy-usd-prim',

        label: 'Copy USD Prim Path',

        icon: <Layers className="w-3.5 h-3.5" />,

        onClick: () => {

          const prim = asset.usd_prim_path || `/World/Assets/${asset.code}`;

          navigator.clipboard.writeText(prim);

          addNotification({

            type: 'info',

            title: 'USD Prim Path Copied',

            message: prim,

          });

        },

      },

      // Archive / Restore

      {

        id: isArchived ? 'restore-asset' : 'archive-asset',

        label: isArchived ? 'Restore Asset' : 'Archive Asset',

        icon: isArchived ? (

          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />

        ) : (

          <Archive className="w-3.5 h-3.5 text-amber-400" />

        ),

        dividerBefore: true,

        permission: 'asset.archive',

        loading: isArchiving,

        confirm: isArchived

          ? undefined

          : {

              title: `Archive Asset ${asset.code}?`,

              message:

                'Archiving will lock the asset from active shot turnovers while preserving historical versions.',

              confirmText: 'Archive Asset',

              variant: 'warning',

            },

        onClick: async () => {

          if (isArchived) {

            await restoreAsset(asset.id);

          } else {

            await archiveAsset(asset.id);

          }

        },

      },

      // Delete Permanent

      {

        id: 'delete-asset',

        label: 'Delete Asset Permanently',

        icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,

        variant: 'danger',

        permission: 'asset.delete',

        onClick: () => setIsDeleteModalOpen(true),

      },

    ];

  }, [asset, isArchiving, updateAsset, restoreAsset, archiveAsset, addNotification]);

  // Tab Definitions

  const workspaceTabs: TabItem[] = useMemo(() => {

    return [

      {

        id: 'overview',

        label: 'Overview',

        icon: Box,

      },

      {

        id: 'tasks',

        label: 'Tasks',

        icon: CheckSquare,

        badge: assetTasks.length > 0 ? assetTasks.length : undefined,

      },

      {

        id: 'versions',

        label: 'Versions',

        icon: GitBranch,

        badge: assetVersions.length > 0 ? assetVersions.length : undefined,

      },

      {

        id: 'reviews',

        label: 'Reviews',

        icon: Film,

      },

      {

        id: 'assignments',

        label: 'Assignments',

        icon: Users,

      },

      {

        id: 'dependencies',

        label: 'Dependencies',

        icon: GitFork,

      },

      {

        id: 'usage',

        label: 'Shot Usage',

        icon: Clapperboard,

      },

      {

        id: 'notes',

        label: 'Notes',

        icon: FileText,

      },

      {

        id: 'media',

        label: 'Media & Files',

        icon: ImageIcon,

      },

      {

        id: 'attachments',

        label: 'Attachments',

        icon: Paperclip,

      },

      {

        id: 'publishing',

        label: 'OpenUSD Publishing',

        icon: Database,

      },

      {

        id: 'activity',

        label: 'Activity',

        icon: Activity,

      },

      {

        id: 'history',

        label: 'Milestone History',

        icon: History,

      },

    ];

  }, [assetTasks.length, assetVersions.length]);

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

  const polyCountText = asset.poly_count > 0 ? `${(asset.poly_count / 1000000).toFixed(2)}M Tris` : 'Volumetric';

  const headerMetadata = [

    {

      label: 'Category',

      value: asset.category,

    },

    {

      label: 'DCC Tool',

      value: asset.software,

    },

    {

      label: 'Polycount',

      value: polyCountText,

    },

    {

      label: 'LODs',

      value: `${asset.lod_levels} Cascades`,

    },

    {

      label: 'Department',

      value: asset.department_name,

    },

    {

      label: 'Lead Modeler',

      value: asset.assigned_artist_name || 'Unassigned',

    },

    {

      label: 'Version',

      value: asset.version || 'v001',

    },

  ];

  const headerAvatar = (

    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">

      {asset.thumbnail_url ? (

        <SmartImg src={asset.thumbnail_url} alt={asset.code} className="w-full h-full object-cover" />

      ) : (

        <Box className="w-8 h-8 text-emerald-400" />

      )}

    </div>

  );

  return (

    <WorkspaceShell

      activeTabKey={resolvedTab}

      header={

        <CanonicalWorkspaceHeader

          breadcrumbs={breadcrumbs}

          backTo={params.projectId ? `/projects/${params.projectId}/assets` : '/assets'}

          backLabel="Back to Assets"

          avatar={headerAvatar}

          title={asset.name || asset.code}

          code={asset.code}

          status={asset.status}

          priority={'Medium'}

          metadata={headerMetadata}

          actions={workspaceActions}

        />

      }

      tabs={

        <div className="px-1">

          <ScrollableTabs

            tabs={workspaceTabs}

            activeTab={resolvedTab}

            onTabChange={handleTabChange}

            variant="pills"

            size="sm"

          />

        </div>

      }

    >

      {/* Active Tab Panel */}

      <div className="mt-6">

        {resolvedTab === 'overview' && (

          <AssetOverviewTab

            asset={asset}

            onNavigateTab={handleTabChange}

          />

        )}

        {resolvedTab === 'tasks' && <EntityTasksPanel target={{ type: 'Asset', id: asset.id, code: asset.code, projectId: asset.project_id }} />}

        {resolvedTab === 'versions' && <AssetVersionsTab asset={asset} />}

        {resolvedTab === 'reviews' && <AssetReviewsTab asset={asset} />}

        {resolvedTab === 'assignments' && (

          <AssetAssignmentsTab

            asset={asset}

            onOpenAssign={() => setIsAssignOpen(true)}

          />

        )}

        {resolvedTab === 'dependencies' && (

          <AssetDependenciesTab

            asset={asset}

            allAssets={allAssetsList}

          />

        )}

        {resolvedTab === 'usage' && <AssetShotsPanel asset={asset} />}

        {resolvedTab === 'notes' && (

          <AssetNotesTab

            asset={asset}

            onOpenAddNote={() => setIsAddNoteOpen(true)}

          />

        )}

        {resolvedTab === 'media' && <AssetMediaTab asset={asset} />}

        {resolvedTab === 'attachments' && <AssetAttachmentsTab asset={asset} />}

        {resolvedTab === 'publishing' && <AssetPublishingTab asset={asset} />}

        {resolvedTab === 'activity' && <WorkHistoryPanel targetType="Asset" id={asset.id} />}

        {resolvedTab === 'history' && <WorkHistoryPanel targetType="Asset" id={asset.id} />}

      </div>

      {/* Modals */}

      <AssetAssignModal

        asset={asset}

        isOpen={isAssignOpen}

        onClose={() => setIsAssignOpen(false)}

      />

      <AssetSubmitVersionModal

        asset={asset}

        isOpen={isSubmitVersionOpen}

        onClose={() => setIsSubmitVersionOpen(false)}

      />

      <AssetAddNoteModal

        asset={asset}

        isOpen={isAddNoteOpen}

        onClose={() => setIsAddNoteOpen(false)}

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

              onClick={async () => {

                await deleteAsset(asset.id);

                navigate('/assets');

              }}

              className="bg-rose-600 hover:bg-rose-500 text-white"

            >

              Delete Asset

            </Button>

          </div>

        </div>

      </Modal>

    </WorkspaceShell>

  );

};
