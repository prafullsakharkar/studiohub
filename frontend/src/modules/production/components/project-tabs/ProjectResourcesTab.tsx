import type React from 'react';
import { Link } from 'react-router-dom';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { ResourcesPanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

/** Who works on the project. Bookable resources are studio-wide and are not tied to a project, so they are one click away. */
export const ProjectResourcesTab: React.FC<Props> = ({ project }) => {
  const canView = useCan('schedule.view');
  return (
    <div className="space-y-4">
      <ResourcesPanel projectId={project.id} />
      {canView && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-xs text-slate-400">Bookable resources, their bookings, leave and capacity are studio-wide.</p>
          <Link to="/scheduling/resources">
            <Button size="sm" variant="outline">
              Studio resources
            </Button>
          </Link>
          <Link to="/scheduling/capacity">
            <Button size="sm" variant="outline">
              Capacity
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
};
