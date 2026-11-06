import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useShotsListConfig } from '@/modules/production/work/shots';
import { ShotBulkAdd } from '@/modules/shots/components/ShotBulkAdd';
import type { Project } from '@/api/production/structure';

interface ProjectShotsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's shots: the shots list scoped to this project, with bulk add (episodes and sequences on episodic ones). */
export const ProjectShotsTab: React.FC<ProjectShotsTabProps> = ({ project }) => {
  const config = useShotsListConfig({ projectId: project.id });
  return <DirectoryListPage config={{ ...config, headerExtra: () => <ShotBulkAdd projectId={project.id} /> }} />;
};
