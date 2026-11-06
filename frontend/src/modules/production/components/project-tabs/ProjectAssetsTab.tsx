import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useAssetsListConfig } from '@/modules/production/work/assets';
import type { Project } from '@/api/production/structure';

interface ProjectAssetsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's assets: the assets list scoped to this project, with its Bulk menu (CR-48). */
export const ProjectAssetsTab: React.FC<ProjectAssetsTabProps> = ({ project }) => (
  <DirectoryListPage config={useAssetsListConfig({ projectId: project.id })} />
);
