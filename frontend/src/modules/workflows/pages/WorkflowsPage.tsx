import type React from 'react';
import { Link } from 'react-router-dom';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { automationsFormConfig, useAutomationsListConfig } from '@/modules/production/review/automations';
import { useWorkflowsListConfig, workflowsFormConfig } from '@/modules/production/review/workflows';
import { Button } from '@/shared/components/Button';

/** Workflows across the caller's projects, with a way to their automation rules. */
export const WorkflowsPage: React.FC = () => {
  const config = useWorkflowsListConfig();
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

export const WorkflowFormPage: React.FC = () => <DirectoryFormPage config={workflowsFormConfig} />;

export const AutomationsPage: React.FC = () => {
  const config = useAutomationsListConfig();
  return (
    <DirectoryListPage
      config={{
        ...config,
        headerExtra: () => (
          <Link to="/workflows">
            <Button size="sm" variant="outline">
              Workflows
            </Button>
          </Link>
        ),
      }}
    />
  );
};

export const AutomationFormPage: React.FC = () => <DirectoryFormPage config={automationsFormConfig} />;
