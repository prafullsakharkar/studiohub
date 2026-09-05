import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../services/TaskService';
import { Task } from '@/types/tasks';
import { TASK_QUERY_KEYS } from './useTasks';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function useTaskMutations() {
  const queryClient = useQueryClient();
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
    },
  });

  return {
    createTask: createMutation.mutateAsync,
    updateTask: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
