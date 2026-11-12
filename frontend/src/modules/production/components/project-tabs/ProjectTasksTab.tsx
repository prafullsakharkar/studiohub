import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { useTasksListConfig } from '@/modules/production/work/tasks';
import type { Project } from '@/api/production/structure';

interface ProjectTasksTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's tasks as a table, cards or a board by status (assigning is offered because the project is known). */
export const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ project }) => <DirectoryListPage config={useTasksListConfig({ projectId: project.id })} />;
