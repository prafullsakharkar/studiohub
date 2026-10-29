import React, { useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useProject, useProjects } from '../hooks/useProjects';
import { ProjectWorkspace, ProjectTabId } from '../components/ProjectWorkspace';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Film, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useProductionStore } from '@/core/production/useProductionStore';

export const ProjectWorkspacePage: React.FC = () => {
  const { id, projectId, showId, tab } = useParams<{
    id?: string;
    projectId?: string;
    showId?: string;
    tab?: string;
  }>();

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setActiveProject, setActiveShow } = useProductionStore();

  const effectiveParam = projectId || id || showId;
  const effectiveProjectId = effectiveParam;
  const routeShowId = showId;

  // Fetch project details
  const { data: project, isLoading } = useProject(effectiveProjectId);
  const { data: allProjectsData } = useProjects();

  // Resolved project entity
  const resolvedProject =
    project ||
    allProjectsData?.results?.find(
      (p) =>
        p.id === effectiveProjectId ||
        p.code?.toLowerCase() === effectiveProjectId?.toLowerCase()
    );

  // Synchronize active project in toolbar production store (REST-only, no mock lookup).
  useEffect(() => {
    if (resolvedProject?.id) {
      setActiveProject(resolvedProject.id);
      setActiveShow(routeShowId ?? `show-${resolvedProject.id}-main`);
    } else if (effectiveProjectId) {
      setActiveProject(effectiveProjectId);
      if (routeShowId) setActiveShow(routeShowId);
    }
  }, [resolvedProject?.id, effectiveProjectId, routeShowId, setActiveProject, setActiveShow]);

  const activeTabFromParam = (tab || searchParams.get('tab') || 'overview') as ProjectTabId;

  if (isLoading && !resolvedProject) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <LoadingSpinner size="lg" label="Loading StudioHub Project Workspace & Scoped Entities..." />
        <span className="text-xs font-mono text-slate-500">
          Loading project workspace...
        </span>
      </div>
    );
  }

  if (!resolvedProject) {
    return (
      <div className="py-12 space-y-4 max-w-4xl mx-auto">
        <Link to="/projects">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to Projects Directory
          </Button>
        </Link>
        <EmptyState
          icon={<Film className="w-10 h-10 text-slate-500" />}
          title="Project Not Found"
          description={`The project container "${effectiveProjectId}" was not found.`}
          actionLabel="View All Projects"
          onAction={() => navigate('/projects')}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 flex-1 min-h-0 w-full">
      <ProjectWorkspace
        key={`${resolvedProject.id}`}
        project={resolvedProject}
        initialTab={activeTabFromParam}
      />
    </div>
  );
};
