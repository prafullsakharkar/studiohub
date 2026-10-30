import type React from 'react';
import { Link } from 'react-router-dom';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useWorkflowsListConfig } from '@/modules/production/review/workflows';
import { Button } from '@/shared/components/Button';
import type { Project } from '@/types/production';

interface ProjectWorkflowTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's workflows, with a way to the automation rules. */
export const ProjectWorkflowTab: React.FC<ProjectWorkflowTabProps> = ({ project }) => {
  const config = useWorkflowsListConfig({ projectId: project.id });
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <Link to="/automations">
            <Button size="sm" variant="outline">
              Automation rules
            </Button>
          </Link>
        ),
      }}
    />
  );
};
