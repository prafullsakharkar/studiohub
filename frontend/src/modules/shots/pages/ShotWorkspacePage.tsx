import { useVersions } from '@/modules/versions';
import { EntityMediaTab, EntityReviewsTab, EntityVersionsTab } from '@/modules/production/review/EntityRecords';

import { useTasks } from '@/modules/tasks';

import React, { useState, useMemo, useEffect } from 'react';

import { SmartImg } from '@/components/ui/SmartImg';

import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';

import { useShot } from '../hooks/useShots';

import { useShotMutations } from '../hooks/useShotMutations';

import { useNotificationStore } from '@/shared/stores/useNotificationStore';

import {

  Clapperboard,
  Layers,

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

// Tab components

import { ShotOverviewTab } from '../components/workspace/ShotOverviewTab';

import { EntityTasksPanel, ShotAssetsPanel, WorkHistoryPanel } from '@/modules/production/work/panels';



import { ShotNotesTab } from '../components/workspace/ShotNotesTab';


import { ShotAssignmentsTab } from '../components/workspace/ShotAssignmentsTab';

// Modals

import { ShotAssignModal } from '../components/workspace/modals/ShotAssignModal';


import { ShotAddNoteModal } from '../components/workspace/modals/ShotAddNoteModal';

export const ShotWorkspacePage: React.FC = () => {

  const params = useParams<{

    projectId?: string;

    shotId?: string;

    id?: string;

    tab?: string;

  }>();

  const [searchParams, setSearchParams] = useSearchParams();

  const navigate = useNavigate();

  const { addNotification } = useNotificationStore();

  const resolvedShotId = params.shotId || params.id || '';

  const resolvedTab = params.tab || searchParams.get('tab') || 'overview';

  // Query shot data

  const { data: shot, isLoading, error } = useShot(resolvedShotId);

  const {

    updateShot,

    approveShot,

    archiveShot,

    restoreShot,

    deleteShot,

    isArchiving,

    isRestoring,

    isDeleting,

  } = useShotMutations();

  // Queries for related child entities

  const { data: tasksData } = useTasks({ page_size: 100 });

  const { data: versionsData } = useVersions({ page_size: 100 });

  // Filter tasks & versions for this shot

  const shotTasks = useMemo(() => {

    if (!tasksData?.results || !shot) return [];

    return tasksData.results.filter(

      (t) =>

        t.entity_id === shot.id ||

        (t as any).shot_id === shot.id ||

        t.code?.startsWith(shot.code) ||

        t.title?.includes(shot.code) ||

        (t as any).name?.includes(shot.code)

    );

  }, [tasksData, shot]);

  const shotVersions = useMemo(() => {

    if (!versionsData?.results || !shot) return [];

    return versionsData.results.filter(

      (v) =>

        v.entity_id === shot.id ||

        v.entity_name === shot.code ||

        v.code?.startsWith(shot.code)

    );

  }, [versionsData, shot]);

  // Modals state

  const [isAssignOpen, setIsAssignOpen] = useState(false);


  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);

  const handleTabChange = (tabId: string) => {

    if (params.tab) {

      // If the URL has a tab segment, replace it

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

    if (!shot) return [];

    const projId = params.projectId || shot.project_id;

    return [

      {

        label: 'StudioHub',

        href: '/',

      },

      {

        label: shot.project_code || 'Project',

        href: projId ? `/projects/${projId}` : '/projects',

      },

      {

        label: shot.sequence_code || 'Sequence',

        href: projId ? `/projects/${projId}/shots` : '/shots',

      },

      {

        label: shot.code,

        isCurrent: true,

      },

    ];

  }, [shot, params]);

  // Standardized Declarative Workspace Actions

  const workspaceActions: WorkspaceAction[] = useMemo(() => {

    if (!shot) return [];

    const isArchived = Boolean(shot.is_deleted || shot.status === 'Archived');

    return [

      // Primary Action

      {

        id: 'edit-shot',

        label: 'Edit Shot',

        icon: <Edit className="w-3.5 h-3.5" />,

        variant: 'primary',

        permission: 'shot.update',

        shortcut: '⌘E',

        onClick: () => navigate(`/shots/${shot.id}/edit`),

      },

      // Secondary Action: Assign

      {

        id: 'assign-artist',

        label: shot.assigned_artist_name ? 'Reassign' : 'Assign Artist',

        icon: <UserCheck className="w-3.5 h-3.5" />,

        variant: 'secondary',

        permission: 'shot.assign',

        onClick: () => setIsAssignOpen(true),

      },

      // Secondary Action: Add Task

      {

        id: 'add-task',

        label: 'Add Task',

        icon: <Plus className="w-3.5 h-3.5" />,

        variant: 'outline',

        permission: 'task.create',

        onClick: () => navigate(`/tasks/new?project=${shot.project_id}&entity_type=Shot&entity_id=${shot.id}`),

      },

      // Overflow Actions

      {

        id: 'submit-version',

        label: 'Submit New Version',

        icon: <GitBranch className="w-3.5 h-3.5" />,

        permission: 'version.create',

        onClick: () => navigate(`/versions/new?project=${shot.project_id}&shot=${shot.id}`),

      },

      {

        id: 'add-note',

        label: 'Add Production Note',

        icon: <FileText className="w-3.5 h-3.5" />,

        onClick: () => setIsAddNoteOpen(true),

      },

      {

        id: 'approve-shot',

        label: 'Approve & Lock Shot',

        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,

        permission: 'shot.approve',

        visible: !shot.supervisor_approved && shot.status !== 'Approved',

        onClick: async () => {

          await approveShot(shot.id);

        },

      },

      {

        id: 'copy-shot-code',

        label: 'Copy Shot Code',

        icon: <Copy className="w-3.5 h-3.5" />,

        onClick: () => {

          navigator.clipboard.writeText(shot.code);

          addNotification({

            type: 'info',

            title: 'Copied to Clipboard',

            message: `Shot code ${shot.code} copied.`,

          });

        },

      },

      {

        id: 'copy-frame-range',

        label: 'Copy Frame Range',

        icon: <Clock className="w-3.5 h-3.5" />,

        onClick: () => {

          const rangeText = `${shot.frame_in}-${shot.frame_out} (${shot.frame_count} frames)`;

          navigator.clipboard.writeText(rangeText);

          addNotification({

            type: 'info',

            title: 'Frame Range Copied',

            message: rangeText,

          });

        },

      },

      // Archive / Restore

      {

        id: isArchived ? 'restore-shot' : 'archive-shot',

        label: isArchived ? 'Restore Shot' : 'Archive Shot',

        icon: isArchived ? (

          <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />

        ) : (

          <Archive className="w-3.5 h-3.5 text-amber-400" />

        ),

        dividerBefore: true,

        permission: 'shot.archive',

        loading: isArchiving || isRestoring,

        confirm: isArchived

          ? {

              title: `Restore Shot ${shot.code}?`,

              message: `This will restore ${shot.code} back to active production sequences.`,

              confirmText: 'Restore Shot',

              variant: 'primary',

            }

          : {

              title: `Archive Shot ${shot.code}?`,

              message: `Are you sure you want to archive ${shot.code}? It will be hidden from default production views.`,

              confirmText: 'Archive Shot',

              variant: 'warning',

            },

        onClick: async () => {

          if (isArchived) {

            await restoreShot(shot.id);

          } else {

            await archiveShot(shot.id);

          }

        },

      },

      // Delete Action

      {

        id: 'delete-shot',

        label: 'Delete Shot Permanently',

        icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,

        danger: true,

        permission: 'shot.delete',

        loading: isDeleting,

        confirm: {

          title: `Delete Shot ${shot.code}?`,

          message: `This action cannot be undone. All tasks, versions, annotations, and metadata associated with ${shot.code} will be permanently removed.`,

          confirmText: 'Delete Permanently',

          variant: 'danger',

        },

        onClick: async () => {

          await deleteShot(shot.id);

          navigate(

            params.projectId ? `/projects/${params.projectId}/shots` : '/shots'

          );

        },

      },

    ];

  }, [

    shot,

    approveShot,

    archiveShot,

    restoreShot,

    deleteShot,

    isArchiving,

    isRestoring,

    isDeleting,

    addNotification,

    navigate,

    params.projectId,

  ]);

  // Tabs configuration

  const tabs: TabItem[] = useMemo(() => {

    return [

      { id: 'overview', label: 'Overview', icon: LayoutGrid },

      { id: 'tasks', label: 'Tasks', icon: CheckSquare, badge: shotTasks.length || undefined },

      { id: 'assets', label: 'Assets', icon: Layers },

      { id: 'versions', label: 'Versions', icon: GitBranch, badge: shotVersions.length || undefined },

      { id: 'reviews', label: 'Reviews', icon: Film },

      { id: 'notes', label: 'Notes', icon: FileText },

      { id: 'activity', label: 'Activity', icon: Activity },

      { id: 'media', label: 'Media & Files', icon: HardDrive },

      { id: 'assignments', label: 'Assignments', icon: Users },

      { id: 'history', label: 'History', icon: Clock },

    ];

  }, [shotTasks.length, shotVersions.length]);

  if (isLoading) {

    return (

      <div className="flex flex-col items-center justify-center min-h-[60vh]">

        <LoadingSpinner size="lg" />

        <span className="text-xs text-slate-400 mt-3 font-mono">

          Loading Shot Workspace manifest...

        </span>

      </div>

    );

  }

  if (error || !shot) {

    return (

      <div className="p-12 text-center space-y-4 max-w-md mx-auto">

        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">

          <AlertCircle className="w-6 h-6" />

        </div>

        <h2 className="text-lg font-bold text-white">Shot Entity Not Found</h2>

        <p className="text-xs text-slate-400 leading-relaxed">

          The requested shot identifier (<span className="font-mono text-slate-300">{resolvedShotId}</span>) could not be resolved in the production database.

        </p>

        <Link to="/shots">

          <Button variant="outline" size="sm" leftIcon={<ChevronLeft className="w-4 h-4" />}>

            Back to Shots Catalog

          </Button>

        </Link>

      </div>

    );

  }

  // Header metadata

  const headerMetadata = [

    {

      icon: Clock,

      label: 'Frames',

      value: `${shot.frame_in} - ${shot.frame_out} (${shot.frame_count}f)`,

    },

    {

      label: 'Handles',

      value: `${shot.handle_frames || 8}f`,

    },

    {

      label: 'Department',

      value: shot.department || 'Compositing',

    },

    {

      icon: Users,

      label: 'Artist',

      value: shot.assigned_artist_name || 'Unassigned',

    },

    {

      label: 'Version',

      value: shot.current_version || 'v001',

    },

  ];

  const headerAvatar = (

    <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-950 flex items-center justify-center border border-slate-800">

      {shot.thumbnail_url ? (

        <SmartImg src={shot.thumbnail_url} alt={shot.code} className="w-full h-full object-cover" />

      ) : (

        <Clapperboard className="w-8 h-8 text-indigo-400" />

      )}

    </div>

  );

  return (

    <WorkspaceShell

      activeTabKey={resolvedTab}

      header={

        <CanonicalWorkspaceHeader

          breadcrumbs={breadcrumbs}

          backTo={params.projectId ? `/projects/${params.projectId}/shots` : '/shots'}

          backLabel="Back to Shots"

          avatar={headerAvatar}

          title={shot.name || shot.code}

          code={shot.code}

          status={shot.status}

          priority={shot.priority || 'Medium'}

          metadata={headerMetadata}

          actions={workspaceActions}

        />

      }

      tabs={

        <div className="px-1">

          <ScrollableTabs

            tabs={tabs}

            activeTab={resolvedTab}

            onTabChange={handleTabChange}

            variant="pills"

            size="sm"

          />

        </div>

      }

    >

      {/* Tab content rendering */}

      {resolvedTab === 'overview' && (

        <ShotOverviewTab

          shot={shot}

          tasks={shotTasks}

          versions={shotVersions}

          onNavigateTab={handleTabChange}

          onOpenEdit={() => navigate(`/shots/${shot.id}/edit`)}

          onOpenAssign={() => setIsAssignOpen(true)}

          onOpenCreateTask={() => navigate(`/tasks/new?project=${shot.project_id}&entity_type=Shot&entity_id=${shot.id}`)}

          onOpenSubmitVersion={() => navigate(`/versions/new?project=${shot.project_id}&shot=${shot.id}`)}

        />

      )}

      {resolvedTab === 'tasks' && <EntityTasksPanel target={{ type: 'Shot', id: shot.id, code: shot.code, projectId: shot.project_id }} />}

      {resolvedTab === 'assets' && <ShotAssetsPanel shot={shot} />}

      {resolvedTab === 'versions' && <EntityVersionsTab entity={{ type: 'Shot', id: shot.id, projectId: shot.project_id }} />}

      {resolvedTab === 'reviews' && <EntityReviewsTab entity={{ type: 'Shot', id: shot.id, projectId: shot.project_id }} />}

      {resolvedTab === 'notes' && (

        <ShotNotesTab shot={shot} onOpenAddNote={() => setIsAddNoteOpen(true)} />

      )}

      {resolvedTab === 'activity' && <WorkHistoryPanel targetType="Shot" id={shot.id} />}

      {resolvedTab === 'media' && <EntityMediaTab entity={{ type: 'Shot', id: shot.id, projectId: shot.project_id }} />}

      {resolvedTab === 'assignments' && (

        <ShotAssignmentsTab shot={shot} onOpenAssign={() => setIsAssignOpen(true)} />

      )}

      {resolvedTab === 'history' && <WorkHistoryPanel targetType="Shot" id={shot.id} />}

      {/* Workspace Modals */}

      {isAssignOpen && (

        <ShotAssignModal

          isOpen={isAssignOpen}

          onClose={() => setIsAssignOpen(false)}

          shot={shot}

        />

      )}

      

      {isAddNoteOpen && (

        <ShotAddNoteModal

          isOpen={isAddNoteOpen}

          onClose={() => setIsAddNoteOpen(false)}

          shot={shot}

        />

      )}

    </WorkspaceShell>

  );

};
