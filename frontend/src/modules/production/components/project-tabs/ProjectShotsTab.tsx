import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useShotsListConfig } from '@/modules/production/work/shots';
import type { Project } from '@/api/production/structure';

interface ProjectShotsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's shots: the shots list scoped to this project, with its Bulk menu (CR-48). */
export const ProjectShotsTab: React.FC<ProjectShotsTabProps> = ({ project }) => (
  <DirectoryListPage config={useShotsListConfig({ projectId: project.id })} />
);
