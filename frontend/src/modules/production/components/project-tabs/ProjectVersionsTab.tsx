import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { ReviewCopiesNotice } from '@/modules/production/review/ReviewCopiesNotice';
import { useVersionsListConfig } from '@/modules/production/review/versions';
import type { Project } from '@/api/production/structure';

interface ProjectVersionsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's versions: publish, make hero, change status; review copies made with the other burn-in setting (RP-14). */
export const ProjectVersionsTab: React.FC<ProjectVersionsTabProps> = ({ project }) => (
  <>
    <ReviewCopiesNotice project={project} />
    <DirectoryListPage config={useVersionsListConfig({ projectId: project.id })} />
  </>
);
