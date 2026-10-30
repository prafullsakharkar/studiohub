import type React from 'react';
import { Link } from 'react-router-dom';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useFilesListConfig } from '@/modules/publishing/files';
import { Button } from '@/shared/components/Button';
import type { Project } from '@/types/production';

interface ProjectPublishingTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/**
 * The project’s published files, from the registry (the files list filters by project on the server). Export jobs
 * cannot be listed per project until the job list can filter (CR-22), so they are one click away on their own page.
 */
export const ProjectPublishingTab: React.FC<ProjectPublishingTabProps> = ({ project }) => {
  const config = useFilesListConfig({ projectId: project.id });
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <Link to="/publishing">
            <Button size="sm" variant="outline">
              Export jobs
            </Button>
          </Link>
        ),
      }}
    />
  );
};
