import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useTimelogsListConfig } from '@/modules/production/work/timelogs';
import type { Project } from '@/api/production/structure';

interface ProjectTimelogsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** Time logged in this project: yours, or everyone's for holders of `timelog.view_all`, with approval. */
export const ProjectTimelogsTab: React.FC<ProjectTimelogsTabProps> = ({ project }) => <DirectoryListPage config={useTimelogsListConfig({ projectId: project.id })} />;
