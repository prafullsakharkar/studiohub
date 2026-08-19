import { useQuery } from '@tanstack/react-query';
import { taskService } from '../services/TaskService';
import { QueryParams } from '@/types/drf';

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
