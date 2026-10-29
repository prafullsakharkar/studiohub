import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { BulkAddButton } from '@/modules/production/work/BulkAddButton';
import { useTasksListConfig } from '@/modules/production/work/tasks';
import { TaskBulkManager } from '@/modules/tasks';
import type { Project } from '@/types/production';

interface ProjectTasksTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's tasks: the tasks list scoped to this project (assigning is offered because the project is known). */
export const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ project }) => {
  const config = useTasksListConfig({ projectId: project.id });
  return <DirectoryListPage config={{ ...config, headerExtra: () => <BulkAddButton projectId={project.id} noun="tasks" Manager={TaskBulkManager} /> }} />;
};
