import type React from 'react';
import { Link } from 'react-router-dom';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { tasksFormConfig, useTasksListConfig } from '@/modules/production/work/tasks';

/** Tasks across the caller's projects: filter, change status in place, act on several at once, log time. */
export const TasksPage: React.FC = () => {
  const config = useTasksListConfig();
  const canSeeTemplates = useCan('tasktemplate.view');
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () =>
          canSeeTemplates ? (
            <Link to="/task-templates">
              <Button size="sm" variant="outline">
                Templates
              </Button>
            </Link>
          ) : null,
      }}
    />
  );
};

export const TaskFormPage: React.FC = () => <DirectoryFormPage config={tasksFormConfig} />;
