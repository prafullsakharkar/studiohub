import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../services/TaskService';
import { QueryParams } from '@/types/drf';
import { Task } from '@/types/tasks';

export const TASK_QUERY_KEYS = {
  all: ['tasks'] as const,
  lists: () => [...TASK_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...TASK_QUERY_KEYS.lists(), params] as const,
  details: () => [...TASK_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...TASK_QUERY_KEYS.details(), id] as const,
};

export function useTasks(params?: QueryParams) {
  return useQuery({
    queryKey: TASK_QUERY_KEYS.list(params),
    queryFn: () => taskService.getTasks(params),
  });
}

export function useTask(id?: string) {
  return useQuery({
    queryKey: id ? TASK_QUERY_KEYS.detail(id) : ['tasks', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Task ID required');
      return taskService.getTaskById(id);
    },
    enabled: !!id,
  });
}

export function useTaskMutations() {
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: (data: Partial<Task>) => taskService.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      taskService.updateTask(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.detail(id) });
    },
  });

  const deleteTask = useMutation({
    mutationFn: (id: string) => taskService.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const bulkAssign = useMutation({
    mutationFn: (payload: {
      task_ids: string[];
      assignee_id?: string;
      assignee_name?: string;
      assignee_avatar?: string;
      assignee_role?: string;
      team_id?: string;
      team_name?: string;
    }) => taskService.bulkAssign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const bulkStatusUpdate = useMutation({
    mutationFn: (payload: { task_ids: string[]; status: string }) =>
      taskService.bulkStatusUpdate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const bulkArchive = useMutation({
    mutationFn: (payload: { task_ids: string[]; is_archived: boolean }) =>
      taskService.bulkArchive(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (payload: { task_ids: string[] }) =>
      taskService.bulkDelete(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  return {
    createTask,
    updateTask,
    deleteTask,
    bulkAssign,
    bulkStatusUpdate,
    bulkArchive,
    bulkDelete,
    isCreating: createTask.isPending,
    isUpdating: updateTask.isPending,
    isDeleting: deleteTask.isPending,
  };
}
