import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useMediaListConfig } from '@/modules/production/review/media';
import type { Project } from '@/api/production/structure';

interface ProjectMediaTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's media records. */
export const ProjectMediaTab: React.FC<ProjectMediaTabProps> = ({ project }) => <DirectoryListPage config={useMediaListConfig({ projectId: project.id })} />;
