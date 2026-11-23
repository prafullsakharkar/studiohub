import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { Link } from 'react-router-dom';
import { useCan } from '@/core/permissions/useCan';
import { Button } from '@/shared/components/Button';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { tasksFormConfig, useTasksListConfig } from '@/modules/production/work/tasks';

/** Tasks of the project chosen in the project switcher (every project with none chosen): a table, cards or a board by status; filter, change status in place, act on several at once, log time. */
export const TasksPage: React.FC = () => {
  const config = useTasksListConfig(useActiveProjectScope());
  const canSeeTemplates = useCan('tasktemplate.view');
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: (filters) => (
          <>
            {canSeeTemplates && (
              <Link to="/task-templates">
                <Button size="sm" variant="outline">
                  Templates
                </Button>
              </Link>
            )}
            {config.headerExtra?.(filters)}
          </>
        ),
      }}
    />
  );
};

export const TaskFormPage: React.FC = () => <DirectoryFormPage config={tasksFormConfig} />;
