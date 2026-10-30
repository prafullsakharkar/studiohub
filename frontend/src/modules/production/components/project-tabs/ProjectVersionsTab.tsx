import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useVersionsListConfig } from '@/modules/production/review/versions';
import type { Project } from '@/types/production';

interface ProjectVersionsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's versions: publish, make hero, change status. */
export const ProjectVersionsTab: React.FC<ProjectVersionsTabProps> = ({ project }) => <DirectoryListPage config={useVersionsListConfig({ projectId: project.id })} />;
