import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProject, useProjects } from '../hooks/useProjects';
import { ProjectWorkspace } from '../components/ProjectWorkspace';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Film, ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/Button';

export const ProjectWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  // Fetch specific project
  const { data: project, isLoading, error } = useProject(id);
  const { data: allProjectsData } = useProjects();

  // Fallback lookup if direct detail didn't resolve immediately
  const resolvedProject =
    project || allProjectsData?.results.find((p) => p.id === id || p.code.toLowerCase() === id?.toLowerCase());

  if (isLoading && !resolvedProject) {
    return (
      <div className="py-20">
        <LoadingSpinner size="lg" label="Loading show workspace & production assets..." />
      </div>
    );
  }

  if (!resolvedProject) {
    return (
      <div className="py-12 space-y-4">
        <Link to="/projects">
          <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to Projects Directory
          </Button>
        </Link>
        <EmptyState
          icon={<Film className="w-10 h-10 text-slate-500" />}
          title="Project Not Found"
          description={`The project container with identifier "${id}" could not be located in the studio database.`}
          actionLabel="View All Projects"
          onAction={() => window.location.assign('/projects')}
        />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-in fade-in duration-200 w-full">
      <ProjectWorkspace project={resolvedProject} />
    </div>
  );
};
