import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';
import { taskService } from '../services/TaskService';
import { TASK_QUERY_KEYS } from './useTasks';

/** Thin wrapper over the canonical generic bulk hook — no behavior lives here. */
export function useBulkTasks() {
  return useBulkEntity({
    service: taskService,
    queryKeyAll: TASK_QUERY_KEYS.all,
    projectQueryKeyAll: PROJECT_QUERY_KEYS.all,
    labels: {
      singular: 'Task',
      plural: 'tasks',
      restoreDestination: 'active schedule',
    },
  });
}
