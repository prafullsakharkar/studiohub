import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Building,
  Layers,
  Box,
  CheckSquare,
  History,
  PlaySquare,
  Calendar,
  Users,
  PackageCheck,
  Terminal,
  Activity,
  Edit,
  Copy,
  Archive,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Download,
  ExternalLink,
  ChevronDown,
  Sparkles,
  ArrowLeft,
  Share2,
  GitFork,
  Clock,
  HardDrive,
  FileText,
  Upload,
  Scissors,
  MessageSquare,
  Search,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Tv,
} from 'lucide-react';
import { Project, isEpisodicProject } from '@/types/production';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { SmartImg } from '@/components/ui/SmartImg';
import { WorkspaceActionBar } from '@/shared/workspace/canonical/WorkspaceActionBar';
import { WorkspaceAction } from '@/shared/workspace/canonical/types';
import { useProjectMutations } from '../hooks/useProjectMutations';
import { useProjects } from '../hooks/useProjects';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { isProjectTabAllowed, PROJECT_TAB_PERMISSIONS } from '@/core/permissions/routePermissionsRegistry';
import { evaluateUserPermission } from '@/core/permissions/rbac';
import { PermissionButton } from '@/core/permissions/PermissionComponents';
import { ShieldAlert, ChevronLeft } from 'lucide-react';
import { ScrollableTabs } from '@/shared/components/tabs/ScrollableTabs';

// Project Workspace Tabs
import { ProjectOverviewTab } from './project-tabs/ProjectOverviewTab';
import { ProjectEditorialTab } from './project-tabs/ProjectEditorialTab';
import { ProjectEpisodesTab } from './project-tabs/ProjectEpisodesTab';
import { ProjectMembersTab } from './project-tabs/ProjectMembersTab';
import { ProjectShowsTab } from './project-tabs/ProjectShowsTab';
import { ProjectSequencesTab } from './project-tabs/ProjectSequencesTab';
import { ProjectShotsTab } from './project-tabs/ProjectShotsTab';
import { ProjectAssetsTab } from './project-tabs/ProjectAssetsTab';
import { ProjectTasksTab } from './project-tabs/ProjectTasksTab';
import { ProjectVersionsTab } from './project-tabs/ProjectVersionsTab';
import { ProjectReviewsTab } from './project-tabs/ProjectReviewsTab';
import { ProjectNotesTab } from './project-tabs/ProjectNotesTab';
import { ProjectDeliveriesTab } from './project-tabs/ProjectDeliveriesTab';
import { ProjectScheduleTab } from './project-tabs/ProjectScheduleTab';
import { ProjectResourcesTab } from './project-tabs/ProjectResourcesTab';
import { ProjectPipelineTab } from './project-tabs/ProjectPipelineTab';
import { ProjectMediaTab } from './project-tabs/ProjectMediaTab';
import { ProjectActivityTab } from './project-tabs/ProjectActivityTab';

// Companion production tabs
import { ProjectPublishingTab } from './project-tabs/ProjectPublishingTab';
import { ProjectPlaylistsTab } from './project-tabs/ProjectPlaylistsTab';
import { ProjectWorkflowTab } from './project-tabs/ProjectWorkflowTab';
import { ProjectTimelogsTab } from './project-tabs/ProjectTimelogsTab';
import { ProjectCalendarTab } from './project-tabs/ProjectCalendarTab';
import { ProjectAttachmentsTab } from './project-tabs/ProjectAttachmentsTab';

export type ProjectTabId =
  | 'overview'
  | 'members'
  | 'shows'
  | 'episodes'
  | 'editorial'
  | 'sequences'
  | 'shots'
  | 'assets'
  | 'tasks'
  | 'versions'
  | 'reviews'
  | 'notes'
  | 'deliveries'
  | 'schedule'
  | 'resources'
  | 'pipeline'
  | 'files'
  | 'activity'
  | 'publishing'
  | 'playlists'
  | 'workflow'
  | 'timelogs'
  | 'calendar'
  | 'attachments';

export interface ProjectWorkspaceSectionDef {
  id: string;
  title: string;
  tabs: {
    id: ProjectTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

export const PROJECT_WORKSPACE_SECTIONS: ProjectWorkspaceSectionDef[] = [
  {
    id: 'overview',
    title: 'Overview',
    tabs: [
      { id: 'overview', label: 'Overview', icon: Building },
      { id: 'members', label: 'Members', icon: Users },
    ],
  },
  {
    id: 'production',
    title: 'Production',
    tabs: [
      { id: 'shows', label: 'Shows', icon: Tv },
      { id: 'episodes', label: 'Episodes', icon: Tv },
      { id: 'editorial', label: 'Editorial', icon: Scissors },
      { id: 'sequences', label: 'Sequences', icon: Layers },
      { id: 'shots', label: 'Shots', icon: Film },
      { id: 'assets', label: 'Assets', icon: Box },
      { id: 'tasks', label: 'Tasks', icon: CheckSquare },
      { id: 'versions', label: 'Versions', icon: History },
      { id: 'publishing', label: 'Publishing', icon: Upload },
      { id: 'workflow', label: 'Workflows', icon: GitFork },
    ],
  },
  {
    id: 'reviews',
    title: 'Reviews & Notes',
    tabs: [
      { id: 'reviews', label: 'Reviews', icon: PlaySquare },
      { id: 'playlists', label: 'Playlists', icon: PlaySquare },
      { id: 'notes', label: 'Notes', icon: MessageSquare },
    ],
  },
  {
    id: 'logistics',
    title: 'Schedule & Logistics',
    tabs: [
      { id: 'schedule', label: 'Schedule', icon: Calendar },
      { id: 'timelogs', label: 'Timelogs', icon: Clock },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
      { id: 'resources', label: 'Resources', icon: Users },
      { id: 'deliveries', label: 'Deliveries', icon: PackageCheck },
    ],
  },
  {
    id: 'technical',
    title: 'Pipeline & Media',
    tabs: [
      { id: 'pipeline', label: 'Pipeline', icon: Terminal },
      { id: 'files', label: 'Files / Media', icon: HardDrive },
      { id: 'attachments', label: 'Attachments', icon: FileText },
      { id: 'activity', label: 'Activity', icon: Activity },
    ],
  },
];

interface ProjectWorkspaceProps {
  project: Project;
  initialTab?: ProjectTabId;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  project,
  initialTab = 'overview',
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProjectTabId>(
    (searchParams.get('tab') as ProjectTabId) || initialTab
  );

  // Context Stack for Non-Linear Navigation
  const [contextEpisode, setContextEpisode] = useState<string | null>(
    searchParams.get('episode_code') || searchParams.get('episode_id') || searchParams.get('ep') || null
  );
  const [contextSequence, setContextSequence] = useState<string | null>(
    searchParams.get('sequence_code') || searchParams.get('seq') || null
  );
  const [contextShot, setContextShot] = useState<string | null>(
    searchParams.get('shot_code') || searchParams.get('shot') || null
  );

  // Project Switcher dropdown state
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [switcherSearch, setSwitcherSearch] = useState('');
  const switcherRef = useRef<HTMLDivElement>(null);

  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [cloneData, setCloneData] = useState({
    name: `${project.name} (Copy)`,
    code: `${project.code}_CLONE`,
  });

  const navigate = useNavigate();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { updateProject, deleteProject, createProject } = useProjectMutations();

  const { user } = useCurrentUser();
  const { data: orgProjectsData } = useProjects();

  const evalContext = {
    projectId: project.id,
  };

  // Sync tab changes with URL parameters
  useEffect(() => {
    const urlTab = searchParams.get('tab') as ProjectTabId;
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [searchParams, activeTab]);

  // Close switcher on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setIsSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTabChange = (newTab: ProjectTabId) => {
    setActiveTab(newTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', newTab);
      return next;
    });
  };

  const handleNavigateTabWithContext = (tabId: string, filterContext?: any) => {
    const targetTab = tabId as ProjectTabId;
    setActiveTab(targetTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', targetTab);
      if (filterContext?.episode_code || filterContext?.episode_id) {
        const ep = filterContext.episode_code || filterContext.episode_id;
        setContextEpisode(ep);
        next.set('episode_code', ep);
      }
      if (filterContext?.sequence_code) {
        setContextSequence(filterContext.sequence_code);
        next.set('sequence_code', filterContext.sequence_code);
      }
      if (filterContext?.shot_code) {
        setContextShot(filterContext.shot_code);
        next.set('shot_code', filterContext.shot_code);
      }
      return next;
    });
  };

  const handleSwitchProject = (targetProject: Project) => {
    setIsSwitcherOpen(false);
    navigate(`/projects/${targetProject.id}?tab=${activeTab}`);
    addNotification({
      type: 'info',
      title: 'Switched Project Context',
      message: `Active show container: ${targetProject.name} (${targetProject.code})`,
    });
  };

  // Dynamically filter sections and tabs using permissions & episodic workflow
  const visibleSections = React.useMemo(() => {
    const isEpisodic = isEpisodicProject(project);
    return PROJECT_WORKSPACE_SECTIONS.map((section) => ({
      ...section,
      tabs: section.tabs
        .filter((t) => (t.id === 'episodes' ? isEpisodic : true))
        .filter((t) =>
          isProjectTabAllowed(user, t.id, {
            projectId: project.id,
          })
        ),
    })).filter((section) => section.tabs.length > 0);
  }, [user, project]);

  const [activeCategory, setActiveCategory] = useState<string>(() => {
    const tabParam = (searchParams.get('tab') as ProjectTabId) || initialTab;
    if (tabParam) {
      const foundSection = PROJECT_WORKSPACE_SECTIONS.find((s) => s.tabs.some((t) => t.id === tabParam));
      if (foundSection) return foundSection.id;
    }
    return PROJECT_WORKSPACE_SECTIONS[0].id;
  });

  useEffect(() => {
    const foundSection = visibleSections.find((s) => s.tabs.some((t) => t.id === activeTab));
    if (foundSection && foundSection.id !== activeCategory) {
      setActiveCategory(foundSection.id);
    }
  }, [activeTab, visibleSections, activeCategory]);

  const handleCategoryClick = (sectionId: string) => {
    setActiveCategory(sectionId);
    const targetSection = visibleSections.find((s) => s.id === sectionId);
    if (targetSection && targetSection.tabs.length > 0) {
      handleTabChange(targetSection.tabs[0].id);
    }
  };

  const selectedSectionDef =
    visibleSections.find((s) => s.id === activeCategory) ||
    visibleSections.find((s) => s.tabs.some((t) => t.id === activeTab)) ||
    visibleSections[0] ||
    PROJECT_WORKSPACE_SECTIONS[0];

  const isCurrentTabAllowed = isProjectTabAllowed(user, activeTab, {
    projectId: project.id,
  });

  // Actions
  const handleToggleArchive = async () => {
    const nextStatus = project.status === 'Archived' ? 'In Progress' : 'Archived';
    await updateProject({
      id: project.id,
      data: { status: nextStatus as any },
    });
    addNotification({
      type: nextStatus === 'Archived' ? 'warning' : 'success',
      title: nextStatus === 'Archived' ? 'Project Archived' : 'Project Restored',
      message: `${project.name} is now ${nextStatus.toLowerCase()}.`,
    });
  };

  const handleToggleClose = async () => {
    const nextStatus = project.status === 'Completed' ? 'In Progress' : 'Completed';
    await updateProject({
      id: project.id,
      data: { status: nextStatus as any },
    });
    addNotification({
      type: nextStatus === 'Completed' ? 'info' : 'success',
      title: nextStatus === 'Completed' ? 'Project Closed' : 'Project Reopened',
      message: `${project.name} marked as ${nextStatus.toLowerCase()}.`,
    });
  };

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cloned = await createProject({
      ...project,
      name: cloneData.name,
      code: cloneData.code,
      approved_shots: 0,
      status: 'In Progress',
      created_at: new Date().toISOString(),
    });
    setIsCloneOpen(false);
    navigate(`/projects/${cloned.id}`);
  };

  const handleDelete = async () => {
    await deleteProject(project.id);
    setIsDeleteOpen(false);
    navigate('/projects');
  };

  const handleExportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${project.code}_project_manifest.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    addNotification({
      type: 'info',
      title: 'Project Specification Exported',
      message: `${project.code} JSON manifest downloaded.`,
    });
  };

  const projectActions: WorkspaceAction[] = React.useMemo(() => {
    return [
      {
        id: 'edit-project',
        label: 'Edit',
        icon: <Edit className="w-3.5 h-3.5" />,
        variant: 'secondary',
        permission: 'project.update',
        onClick: () => navigate(`/projects/${project.id}/edit`),
      },
      {
        id: 'clone-project',
        label: 'Clone',
        icon: <Copy className="w-3.5 h-3.5" />,
        variant: 'secondary',
        permission: 'project.create',
        onClick: () => setIsCloneOpen(true),
      },
      {
        id: 'toggle-close',
        label: project.status === 'Completed' ? 'Reopen' : 'Close',
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        variant: 'outline',
        permission: 'project.update',
        onClick: handleToggleClose,
      },
      {
        id: 'toggle-archive',
        label: project.status === 'Archived' ? 'Restore' : 'Archive',
        icon:
          project.status === 'Archived' ? (
            <RotateCcw className="w-3.5 h-3.5" />
          ) : (
            <Archive className="w-3.5 h-3.5" />
          ),
        variant: 'outline',
        permission: 'project.archive',
        onClick: handleToggleArchive,
      },
      {
        id: 'export-manifest',
        label: 'Export',
        icon: <Download className="w-3.5 h-3.5" />,
        onClick: handleExportJSON,
      },
      {
        id: 'delete-project',
        label: 'Delete',
        icon: <Trash2 className="w-3.5 h-3.5 text-rose-400" />,
        danger: true,
        permission: 'project.delete',
        onClick: () => setIsDeleteOpen(true),
      },
    ];
  }, [project.id, project.status, navigate, handleToggleClose, handleToggleArchive, handleExportJSON]);

  // REST-only: backend list is the sole source of truth (no mock fallback).
  const allOrgProjects: Project[] = React.useMemo(() => {
    return orgProjectsData?.results ?? [];
  }, [orgProjectsData]);

  const availableProjects = React.useMemo(() => {
    return allOrgProjects.filter((p) =>
      switcherSearch
        ? p.name.toLowerCase().includes(switcherSearch.toLowerCase()) ||
          p.code.toLowerCase().includes(switcherSearch.toLowerCase())
        : true
    );
  }, [allOrgProjects, switcherSearch]);

  return (
    <div className="space-y-4 flex-1 min-h-0">
      {/* Top Header / Breadcrumbs & Show Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-30">
        {/* Breadcrumb Hierarchy with Non-Linear Context */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono text-slate-400">
          <Link
            to="/projects"
            className="inline-flex items-center text-slate-400 hover:text-indigo-400 transition-colors font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Projects
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-200 font-semibold flex items-center gap-1.5">
            <span className="text-indigo-400 font-bold">{project.code}</span>
            <span>{project.name}</span>
          </span>

          {contextEpisode && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <button
                type="button"
                onClick={() => handleNavigateTabWithContext('sequences', { episode_code: contextEpisode })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950/80 border border-purple-700/60 text-xs font-mono text-purple-300 hover:text-purple-200 cursor-pointer"
                title="Filtered to episode"
              >
                Ep: {contextEpisode}
              </button>
            </>
          )}

          {contextSequence && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <button
                type="button"
                onClick={() => handleNavigateTabWithContext('shots', { sequence_code: contextSequence })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-700/60 text-xs font-mono text-indigo-300 hover:text-indigo-200 cursor-pointer"
                title="Filtered to sequence"
              >
                Seq: {contextSequence}
              </button>
            </>
          )}

          {contextShot && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <button
                type="button"
                onClick={() => handleNavigateTabWithContext('tasks', { shot_code: contextShot })}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/60 text-xs font-mono text-cyan-300 hover:text-cyan-200 cursor-pointer"
                title="Filtered to shot"
              >
                Shot: {contextShot}
              </button>
            </>
          )}

          {(contextEpisode || contextSequence || contextShot) && (
            <button
              type="button"
              onClick={() => {
                setContextEpisode(null);
                setContextSequence(null);
                setContextShot(null);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.delete('episode_code');
                  next.delete('episode_id');
                  next.delete('ep');
                  next.delete('sequence_code');
                  next.delete('shot_code');
                  return next;
                });
              }}
              className="text-[11px] text-slate-500 hover:text-rose-400 ml-1 underline cursor-pointer"
            >
              (clear context)
            </button>
          )}
        </div>

        {/* Show Switcher Dropdown */}
        <div className="relative self-start sm:self-auto" ref={switcherRef}>
          <button
            type="button"
            onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl text-xs font-mono text-slate-200 transition-all shadow-md cursor-pointer"
            aria-expanded={isSwitcherOpen}
            aria-haspopup="listbox"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">Show:</span>
            <span className="font-bold text-white tracking-wide">{project.code}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isSwitcherOpen ? 'rotate-180 text-indigo-400' : ''
              }`}
            />
          </button>

          {isSwitcherOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl z-50 p-2 space-y-2 animate-in fade-in zoom-in-95">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter shows by name or code..."
                  value={switcherSearch}
                  onChange={(e) => setSwitcherSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono"
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                {availableProjects.map((p) => {
                  const isCurrent = p.id === project.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSwitchProject(p)}
                      className={`w-full text-left p-2 rounded-lg text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs">{p.code}</span>
                          <StatusBadge status={p.status} size="sm" />
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{p.name}</p>
                      </div>

                      {isCurrent && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200">
                          Active
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Banner & Header Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-md">
        {/* Banner Image */}
        <div className="h-32 w-full relative bg-slate-950 overflow-hidden">
          {project.banner_url || project.thumbnail_url ? (
            <SmartImg
              src={project.banner_url || project.thumbnail_url}
              alt=""
              className="w-full h-full object-cover opacity-40"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/40" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
          <div className="absolute top-3 left-4 z-10">
            <Link to="/projects">
              <Button
                size="xs"
                variant="outline"
                leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
                className="bg-slate-950/80 backdrop-blur-xs border-slate-800 text-slate-300"
              >
                All Projects
              </Button>
            </Link>
          </div>
        </div>

        {/* Identity & Actions Bar */}
        <div className="p-5 relative -mt-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-end gap-4 min-w-0">
            {project.thumbnail_url || project.logo_url ? (
              <SmartImg
                src={project.thumbnail_url || project.logo_url}
                alt={project.name}
                className="w-20 h-20 rounded-2xl object-cover ring-4 ring-slate-900 bg-slate-950 shadow-2xl shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl ring-4 ring-slate-900 bg-gradient-to-br from-indigo-950 to-slate-900 border border-indigo-500/30 shadow-2xl shrink-0 flex items-center justify-center text-indigo-400 font-bold">
                <Film className="w-9 h-9" />
              </div>
            )}

            <div className="pb-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-white tracking-tight font-sans truncate">
                  {project.name}
                </h1>
                <button
                  type="button"
                  onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                  title="Click to switch show"
                  className="text-xs font-mono font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30 hover:border-indigo-400/50 transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>{project.code}</span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>
                <StatusBadge status={project.status} size="sm" />
                {project.type && (
                  <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                    {project.type}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 text-xs text-slate-400 mt-1 font-mono flex-wrap">
                {project.client_name && (
                  <>
                    <span className="flex items-center gap-1 text-slate-300 font-sans">
                      <Building className="w-3.5 h-3.5 text-indigo-400" />
                      {project.client_name}
                    </span>
                    <span>•</span>
                  </>
                )}
                {project.delivery_date && (
                  <>
                    <span>
                      Delivery: <strong className="text-slate-200">{project.delivery_date}</strong>
                    </span>
                    <span>•</span>
                  </>
                )}
                <span>
                  Master:{' '}
                  <strong className="text-slate-200">
                    {project.fps || 24} FPS @ {project.resolution || '4K UHD'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Color: <strong className="text-slate-200">{project.color_space || 'ACEScg'}</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <WorkspaceActionBar actions={projectActions} />
          </div>
        </div>

        {/* Tier 1: Project Workspace Top Sections Bar */}
        <div className="px-5 py-1.5 border-t border-slate-800/80 bg-slate-950/80">
          <ScrollableTabs
            variant="buttons"
            size="xs"
            tabs={visibleSections.map((section) => ({
              id: section.id,
              label: section.title,
              count: section.tabs.length > 1 ? section.tabs.length : undefined,
            }))}
            activeTab={
              visibleSections.find((s) => s.id === activeCategory || s.tabs.some((t) => t.id === activeTab))?.id ||
              visibleSections[0]?.id ||
              PROJECT_WORKSPACE_SECTIONS[0].id
            }
            onTabChange={(secId) => handleCategoryClick(secId)}
            ariaLabel="Project workspace sections"
          />
        </div>

        {/* Tier 2: Sub-tabs within the selected Workspace Section */}
        <div className="px-5 py-2 border-t border-slate-800/60 bg-slate-900/50 flex items-center">
          <span className="text-[11px] font-mono uppercase text-slate-500 mr-2 shrink-0 flex items-center gap-1">
            <span>{selectedSectionDef.title}</span>
            <span className="text-slate-700">/</span>
          </span>

          <ScrollableTabs
            className="flex-1 min-w-0"
            variant="pills"
            size="xs"
            tabs={selectedSectionDef.tabs.map((tab) => ({
              id: tab.id,
              label: tab.label,
              icon: tab.icon,
            }))}
            activeTab={activeTab}
            onTabChange={(tabId) => handleTabChange(tabId as ProjectTabId)}
            ariaLabel="Section tabs"
          />
        </div>
      </div>

      {/* Active Tab Viewport */}
      <div className="min-h-[480px]">
        {!isCurrentTabAllowed ? (
          <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4 max-w-lg mx-auto my-12">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Section Restricted</h3>
              <p className="text-xs text-slate-400">
                You do not have permission to access the{' '}
                <span className="font-mono text-indigo-300">{activeTab}</span> section in this project.
              </p>
            </div>
            {visibleSections.length > 0 && visibleSections[0].tabs.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleTabChange(visibleSections[0].tabs[0].id)}
              >
                Go to {visibleSections[0].tabs[0].label}
              </Button>
            )}
          </div>
        ) : (
          <div className="w-full flex-1 min-h-0">
            {activeTab === 'overview' && (
              <ProjectOverviewTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'members' && <ProjectMembersTab project={project} />}

            {activeTab === 'shows' && <ProjectShowsTab project={project} />}

            {activeTab === 'episodes' && (
              <ProjectEpisodesTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'editorial' && (
              <ProjectEditorialTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'sequences' && (
              <ProjectSequencesTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'shots' && (
              <ProjectShotsTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'assets' && (
              <ProjectAssetsTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'tasks' && (
              <ProjectTasksTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'versions' && (
              <ProjectVersionsTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'reviews' && (
              <ProjectReviewsTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'notes' && (
              <ProjectNotesTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'deliveries' && (
              <ProjectDeliveriesTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'schedule' && (
              <ProjectScheduleTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'resources' && (
              <ProjectResourcesTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'pipeline' && (
              <ProjectPipelineTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'files' && (
              <ProjectMediaTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'activity' && (
              <ProjectActivityTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}

            {/* Companion Tab Support */}
            {activeTab === 'publishing' && (
              <ProjectPublishingTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'playlists' && (
              <ProjectPlaylistsTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'workflow' && (
              <ProjectWorkflowTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'timelogs' && (
              <ProjectTimelogsTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'calendar' && (
              <ProjectCalendarTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
            {activeTab === 'attachments' && (
              <ProjectAttachmentsTab project={project} onNavigateTab={handleNavigateTabWithContext} />
            )}
          </div>
        )}
      </div>

      {/* Clone Project Modal */}
      <Modal
        isOpen={isCloneOpen}
        onClose={() => setIsCloneOpen(false)}
        title="Clone Show Specification"
        subtitle={`Duplicate environment, specifications, and pipeline settings from ${project.code}`}
      >
        <form onSubmit={handleClone} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">New Project Name</label>
            <input
              required
              type="text"
              value={cloneData.name}
              onChange={(e) => setCloneData({ ...cloneData, name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">New Project Code</label>
            <input
              required
              type="text"
              value={cloneData.code}
              onChange={(e) => setCloneData({ ...cloneData, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <p className="text-[11px] text-slate-400">
            This will duplicate color space, resolution, framerate, client relationship, and pipeline paths for the new show.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsCloneOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Duplicate Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title="Delete Project Container"
        subtitle={`Are you sure you want to remove ${project.name} (${project.code})?`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            This action will permanently delete this show container and disconnect all associated shot references. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
