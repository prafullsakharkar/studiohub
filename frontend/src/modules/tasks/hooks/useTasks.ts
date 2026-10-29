import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskService } from '../services/TaskService';
import { QueryParams } from '@/types/common';
import { Task } from '@/types/production';
import { useProductionContext } from '@/core/production/ProductionContext';

export const TASK_QUERY_KEYS = {
  all: ['tasks'] as const,
  lists: () => [...TASK_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...TASK_QUERY_KEYS.lists(), params] as const,
  details: () => [...TASK_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...TASK_QUERY_KEYS.details(), id] as const,
};

export function useTasks(params?: QueryParams) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'tasks',
      params,
    ],
    queryFn: () =>
      taskService.getTasks({
        ...params,
        project_id: projectId || undefined,
        show_id: showId || undefined,
      }),
    enabled: Boolean(projectId && showId),
  });
}

export function useTask(id?: string) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'tasks',
      id,
    ],
    queryFn: () => {
      if (!id) throw new Error('Task ID required');
      return taskService.getTaskById(id);
    },
    enabled: Boolean(projectId && showId && id),
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
      payload.is_archived
        ? taskService.bulkArchive({ ids: payload.task_ids })
        : taskService.bulkRestore({ ids: payload.task_ids }),
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
