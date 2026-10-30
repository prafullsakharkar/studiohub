import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useReviewsListConfig } from '@/modules/production/review/reviews';
import type { Project } from '@/types/production';

interface ProjectReviewsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's review sessions. */
export const ProjectReviewsTab: React.FC<ProjectReviewsTabProps> = ({ project }) => <DirectoryListPage config={useReviewsListConfig({ projectId: project.id })} />;
