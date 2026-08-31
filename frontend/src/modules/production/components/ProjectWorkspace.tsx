import React, { useState } from 'react';
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
  ChevronRight,
  Sparkles,
  ArrowLeft,
  Share2,
  GitFork,
  Clock,
  HardDrive,
  FileText,
  Upload,
} from 'lucide-react';
import { Project } from '@/mocks/db/production/projects';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Modal } from '@/shared/components/Modal';
import { useProjectMutations } from '../hooks/useProjectMutations';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { Link, useNavigate } from 'react-router-dom';

// Sub-tabs
import { ProjectOverviewTab } from './project-tabs/ProjectOverviewTab';
import { ProjectProductionTab } from './project-tabs/ProjectProductionTab';
import { ProjectShotsTab } from './project-tabs/ProjectShotsTab';
import { ProjectAssetsTab } from './project-tabs/ProjectAssetsTab';
import { ProjectTasksTab } from './project-tabs/ProjectTasksTab';
import { ProjectVersionsTab } from './project-tabs/ProjectVersionsTab';
import { ProjectReviewsTab } from './project-tabs/ProjectReviewsTab';
import { ProjectPublishingTab } from './project-tabs/ProjectPublishingTab';
import { ProjectDeliveriesTab } from './project-tabs/ProjectDeliveriesTab';
import { ProjectPlaylistsTab } from './project-tabs/ProjectPlaylistsTab';
import { ProjectWorkflowTab } from './project-tabs/ProjectWorkflowTab';
import { ProjectResourcesTab } from './project-tabs/ProjectResourcesTab';
import { ProjectTimelogsTab } from './project-tabs/ProjectTimelogsTab';
import { ProjectCalendarTab } from './project-tabs/ProjectCalendarTab';
import { ProjectMediaTab } from './project-tabs/ProjectMediaTab';
import { ProjectAttachmentsTab } from './project-tabs/ProjectAttachmentsTab';
import { ProjectScheduleTab } from './project-tabs/ProjectScheduleTab';
import { ProjectPipelineTab } from './project-tabs/ProjectPipelineTab';
import { ProjectActivityTab } from './project-tabs/ProjectActivityTab';

export type ProjectTabId =
  | 'overview'
  | 'production'
  | 'shots'
  | 'assets'
  | 'tasks'
  | 'versions'
  | 'reviews'
  | 'publishing'
  | 'deliveries'
  | 'playlists'
  | 'workflow'
  | 'resources'
  | 'timelogs'
  | 'calendar'
  | 'media'
  | 'attachments'
  | 'schedule'
  | 'pipeline'
  | 'activity';

interface ProjectWorkspaceProps {
  project: Project;
  initialTab?: ProjectTabId;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  project,
  initialTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<ProjectTabId>(initialTab);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [cloneData, setCloneData] = useState({
    name: `${project.name} (Copy)`,
    code: `${project.code}_CLONE`,
  });

  const navigate = useNavigate();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const { updateProject, deleteProject, createProject } = useProjectMutations();

  const tabs: { id: ProjectTabId; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Building className="w-3.5 h-3.5" /> },
    { id: 'production', label: 'Production', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'assets', label: 'Assets', icon: <Box className="w-3.5 h-3.5" /> },
    { id: 'shots', label: 'Shots', icon: <Film className="w-3.5 h-3.5" /> },
    { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: 'versions', label: 'Versions', icon: <History className="w-3.5 h-3.5" /> },
    { id: 'reviews', label: 'Reviews', icon: <PlaySquare className="w-3.5 h-3.5" /> },
    { id: 'publishing', label: 'Publishing', icon: <Upload className="w-3.5 h-3.5" /> },
    { id: 'deliveries', label: 'Deliveries', icon: <PackageCheck className="w-3.5 h-3.5" /> },
    { id: 'playlists', label: 'Playlists', icon: <PlaySquare className="w-3.5 h-3.5" /> },
    { id: 'workflow', label: 'Workflow', icon: <GitFork className="w-3.5 h-3.5" /> },
    { id: 'resources', label: 'Resources', icon: <Users className="w-3.5 h-3.5" /> },
    { id: 'timelogs', label: 'Timelogs', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'calendar', label: 'Calendar', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'media', label: 'Media', icon: <HardDrive className="w-3.5 h-3.5" /> },
    { id: 'attachments', label: 'Attachments', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'pipeline', label: 'Pipeline', icon: <Terminal className="w-3.5 h-3.5" /> },
    { id: 'activity', label: 'Activity', icon: <Activity className="w-3.5 h-3.5" /> },
  ];

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

  const handleNavigateTab = (tabId: string) => {
    setActiveTab(tabId as ProjectTabId);
  };

  return (
    <div className="space-y-6">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/projects"
          className="inline-flex items-center text-xs font-mono text-slate-400 hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Projects Directory
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">ID: {project.id}</span>
          <span className="text-slate-700">•</span>
          <span className="text-xs font-mono text-indigo-400 font-bold">{project.type}</span>
        </div>
      </div>

      {/* Main Workspace Header Hero Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Subtle Background Art / Glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-indigo-400 font-mono text-xl font-bold shrink-0 shadow-md">
              <Film className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {project.code}
                </span>
                <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans">
                  {project.name}
                </h1>
                <StatusBadge status={project.status} />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                {project.client_name && (
                  <span className="flex items-center gap-1">
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    Client:{' '}
                    {project.client_id ? (
                      <Link
                        to={`/clients/${project.client_id}`}
                        className="text-slate-200 font-medium hover:text-indigo-400 underline decoration-slate-700 hover:decoration-indigo-400"
                      >
                        {project.client_name}
                      </Link>
                    ) : (
                      <strong className="text-slate-200">{project.client_name}</strong>
                    )}
                  </span>
                )}

                <span className="text-slate-700">•</span>
                <span>Delivery: <strong className="text-slate-200 font-mono">{project.delivery_date}</strong></span>
                <span className="text-slate-700">•</span>
                <span>Master: <strong className="text-slate-200 font-mono">{project.fps} FPS @ {project.resolution}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex items-center gap-2 flex-wrap self-start lg:self-center shrink-0">
            <Link to={`/projects/${project.id}/edit`} className="inline-flex">
              <Button size="sm" variant="outline" leftIcon={<Edit className="w-3.5 h-3.5" />}>
                Edit Project
              </Button>
            </Link>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCloneOpen(true)}
              leftIcon={<Copy className="w-3.5 h-3.5" />}
            >
              Clone
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleClose}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              {project.status === 'Completed' ? 'Reopen' : 'Close'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleToggleArchive}
              leftIcon={project.status === 'Archived' ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
            >
              {project.status === 'Archived' ? 'Restore' : 'Archive'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleExportJSON}
              leftIcon={<Download className="w-3.5 h-3.5" />}
            >
              Export
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDeleteOpen(true)}
              className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              title="Delete Project"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* 12-Tab Horizontal Navigation Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold font-mono tracking-tight transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Viewport */}
      <div className="min-h-[450px]">
        {activeTab === 'overview' && (
          <ProjectOverviewTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'production' && (
          <ProjectProductionTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'assets' && (
          <ProjectAssetsTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'shots' && (
          <ProjectShotsTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'tasks' && (
          <ProjectTasksTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'versions' && (
          <ProjectVersionsTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'reviews' && (
          <ProjectReviewsTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'publishing' && (
          <ProjectPublishingTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'deliveries' && (
          <ProjectDeliveriesTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'playlists' && (
          <ProjectPlaylistsTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'workflow' && (
          <ProjectWorkflowTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'resources' && (
          <ProjectResourcesTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'timelogs' && (
          <ProjectTimelogsTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'calendar' && (
          <ProjectCalendarTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'media' && (
          <ProjectMediaTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'attachments' && (
          <ProjectAttachmentsTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'schedule' && (
          <ProjectScheduleTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'pipeline' && (
          <ProjectPipelineTab project={project} onNavigateTab={handleNavigateTab} />
        )}
        {activeTab === 'activity' && (
          <ProjectActivityTab project={project} onNavigateTab={handleNavigateTab} />
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
