import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { showsApi } from '@/api/production/structure';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { EmptyState } from '@/shared/components/EmptyState';
import { Film } from 'lucide-react';

/**
 * `/shows/:showId`. A show belongs to a project and has no workspace of its own, so the address leads to its project.
 * (It used to hand the show's id to the project workspace as if it were a project id, which could never be found.)
 */
export const ShowRedirectPage: React.FC = () => {
  const { showId = '' } = useParams<{ showId: string }>();
  const show = useQuery({ queryKey: showsApi.keys.detail(showId), queryFn: ({ signal }) => showsApi.get(showId, signal), enabled: Boolean(showId), retry: false });

  if (show.data) return <Navigate to={`/projects/${show.data.project_id}`} replace />;
  if (show.isError || !showId) {
    return (
      <div className="py-12 space-y-4 max-w-4xl mx-auto">
        <EmptyState icon={<Film className="w-10 h-10 text-slate-500" />} title="Show not found" description="This show does not exist, was archived, or you may not open it." />
        <Link to="/projects" className="text-sm text-indigo-400 hover:underline">
          Back to projects
        </Link>
      </div>
    );
  }
  return (
    <div className="py-24 flex justify-center">
      <LoadingSpinner size="lg" label="Opening the show's project..." />
    </div>
  );
};
