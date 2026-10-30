import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useMilestonesListConfig } from '@/modules/scheduling';
import { SchedulePanel } from '../../structure/panels';

interface Props {
  project: { id: string; workflow_type?: string };
  onNavigateTab?: (tab: string) => void;
}

/** The project's dates, then its milestones: made, completed and reopened here (the server filters them by project). */
const Milestones: React.FC<{ projectId: string }> = ({ projectId }) => <DirectoryListPage config={useMilestonesListConfig({ projectId })} />;

export const ProjectScheduleTab: React.FC<Props> = ({ project }) => (
  <div className="space-y-6">
    <SchedulePanel projectId={project.id} milestones={false} />
    <Milestones projectId={project.id} />
  </div>
);
