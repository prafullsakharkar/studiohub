import { taskBulk } from '@/api/production/bulkRoutes';
import { tasksApi } from '@/api/production/work';
import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';

/** Thin wrapper over the canonical generic bulk hook: no behavior lives here. */
export function useBulkTasks() {
  return useBulkEntity({
    service: taskBulk,
    queryKeyAll: tasksApi.keys.all,
    projectQueryKeyAll: PROJECT_QUERY_KEYS.all,
    labels: {
      singular: 'Task',
      plural: 'tasks',
      restoreDestination: 'active schedule',
    },
  });
}
