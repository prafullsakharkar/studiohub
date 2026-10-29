import { WorkflowStudio } from '@/modules/workflows';

import React from 'react';


// REST-only shim: mock engine removed; backend is the source of truth.
import type { Project } from '@/types/production';

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
