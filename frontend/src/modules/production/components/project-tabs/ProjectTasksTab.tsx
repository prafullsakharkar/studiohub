import type React from 'react';
import { useState } from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { BulkAddButton } from '@/modules/production/work/BulkAddButton';
import { TaskBoard } from '@/modules/production/work/TaskBoard';
import { useTasksListConfig } from '@/modules/production/work/tasks';
import { TaskBulkManager } from '@/modules/tasks';
import { Button } from '@/shared/components/Button';
import type { Project } from '@/types/production';

interface ProjectTasksTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's tasks, as the scoped list or as a board by status (assigning is offered because the project is known). */
export const ProjectTasksTab: React.FC<ProjectTasksTabProps> = ({ project }) => {
  const [view, setView] = useState<'list' | 'board'>('list');
  const config = useTasksListConfig({ projectId: project.id });
  const switcher = (
    <Button size="sm" variant="outline" onClick={() => setView(view === 'list' ? 'board' : 'list')}>
      {view === 'list' ? 'Board' : 'List'}
    </Button>
  );
  if (view === 'board') return <TaskBoard projectId={project.id} toolbarExtra={switcher} />;
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <>
            {switcher}
            <BulkAddButton projectId={project.id} noun="tasks" Manager={TaskBulkManager} />
          </>
        ),
      }}
    />
  );
};
