import type React from 'react';
import { AssetBulkManager } from '@/modules/assets';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useAssetsListConfig } from '@/modules/production/work/assets';
import { BulkAddButton } from '@/modules/production/work/BulkAddButton';
import type { Project } from '@/types/production';

interface ProjectAssetsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's assets: the assets list scoped to this project. */
export const ProjectAssetsTab: React.FC<ProjectAssetsTabProps> = ({ project }) => {
  const config = useAssetsListConfig({ projectId: project.id });
  return <DirectoryListPage config={{ ...config, headerExtra: () => <BulkAddButton projectId={project.id} noun="assets" Manager={AssetBulkManager} /> }} />;
};
