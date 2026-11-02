import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useFilesListConfig } from '@/modules/publishing/files';
import { usePublishListConfig } from '@/modules/publishing/jobs';
import type { Project } from '@/api/production/structure';

interface ProjectPublishingTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project’s export jobs, then the files they and the pipeline registered; both lists filter by project on the server (CR-22). */
export const ProjectPublishingTab: React.FC<ProjectPublishingTabProps> = ({ project }) => {
  const jobs = usePublishListConfig({ projectId: project.id });
  const files = useFilesListConfig({ projectId: project.id });
  return (
    <div className="space-y-8">
      <DirectoryListPage config={jobs} />
      <DirectoryListPage config={files} />
    </div>
  );
};
