import React from 'react';
import { Project } from '@/types/projects';
import { WorkflowStudio } from '@/modules/workflows/components/WorkflowStudio';

interface ProjectWorkflowTabProps {
  project: Project;
  onNavigateTab: (tabId: string) => void;
}

export const ProjectWorkflowTab: React.FC<ProjectWorkflowTabProps> = ({ project }) => {
  return (
    <div className="space-y-4">
      <WorkflowStudio projectId={project.id} projectCode={project.code} />
    </div>
  );
};
