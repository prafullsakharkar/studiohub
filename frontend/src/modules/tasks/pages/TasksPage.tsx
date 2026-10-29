import type React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { TaskBoard } from '@/modules/production/work/TaskBoard';
import { tasksFormConfig, useTasksListConfig } from '@/modules/production/work/tasks';

/** Tasks across the caller's projects: filter, change status in place, act on several at once, log time. */
export const TasksPage: React.FC = () => {
  const [params] = useSearchParams();
  return params.get('view') === 'board' ? <TaskBoardView /> : <TaskListView />;
};

const ViewLink: React.FC<{ to: string; children: string }> = ({ to, children }) => (
  <Link to={to}>
    <Button size="sm" variant="outline">
      {children}
    </Button>
  </Link>
);

const TaskListView: React.FC = () => {
  const config = useTasksListConfig();
  const canSeeTemplates = useCan('tasktemplate.view');
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <>
            <ViewLink to="/tasks?view=board">Board</ViewLink>
            {canSeeTemplates && <ViewLink to="/task-templates">Templates</ViewLink>}
          </>
        ),
      }}
    />
  );
};

const TaskBoardView: React.FC = () => <TaskBoard toolbarExtra={<ViewLink to="/tasks">List</ViewLink>} />;

export const TaskFormPage: React.FC = () => <DirectoryFormPage config={tasksFormConfig} />;
