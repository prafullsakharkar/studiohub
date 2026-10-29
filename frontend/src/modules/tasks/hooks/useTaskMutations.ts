import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../services/TaskService';
import { Task } from '@/types/production';
import { TASK_QUERY_KEYS } from './useTasks';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const recordActivity = useActivityStore((state) => state.recordActivity);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Task>) => taskService.createTask(data),
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Task Created',
        message: `Task ${newTask.code} assigned to ${newTask.assignee_name || 'department'}.`,
      });

      recordActivity({
        action: 'created',
        actionLabel: 'Task Created',
        resourceType: 'task',
        resourceId: newTask.id,
        resourceName: newTask.title || newTask.code,
        resourceCode: newTask.code,
        projectId: newTask.project_id,
        context: newTask.entity_code || newTask.project_code,
        description: `Created task ${newTask.code} (${newTask.title}) assigned to ${newTask.assignee_name || 'unassigned'}.`,
        tags: ['Task', 'Creation'],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      taskService.updateTask(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Task Updated',
        message: `Task ${updated.code} status shifted to ${updated.status}.`,
      });

      recordActivity({
        action: updated.status ? 'status_changed' : 'updated',
        actionLabel: updated.status ? 'Task Status Shifted' : 'Task Updated',
        resourceType: 'task',
        resourceId: updated.id,
        resourceName: updated.title || updated.code,
        resourceCode: updated.code,
        projectId: updated.project_id,
        context: updated.entity_code || updated.project_code,
        description: `Updated task ${updated.code} (Status: ${updated.status || 'Active'}).`,
        diffs: updated.status ? [{ field: 'status', label: 'Status', before: undefined, after: updated.status }] : undefined,
        tags: ['Task', 'Update'],
      });
    },
  });

  return {
    createTask: createMutation.mutateAsync,
    updateTask: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
