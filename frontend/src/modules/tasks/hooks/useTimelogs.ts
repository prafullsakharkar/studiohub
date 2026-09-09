import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timelogService } from '../services/TimelogService';
import { QueryParams } from '@/types/drf';
import { Timelog } from '@/types/tasks';
import { TASK_QUERY_KEYS } from './useTasks';

export const TIMELOG_QUERY_KEYS = {
  all: ['timelogs'] as const,
  lists: () => [...TIMELOG_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...TIMELOG_QUERY_KEYS.lists(), params] as const,
  details: () => [...TIMELOG_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...TIMELOG_QUERY_KEYS.details(), id] as const,
};

export function useTimelogs(params?: QueryParams) {
  return useQuery({
    queryKey: TIMELOG_QUERY_KEYS.list(params),
    queryFn: () => timelogService.getTimelogs(params),
  });
}

export function useTimelog(id?: string) {
  return useQuery({
    queryKey: id ? TIMELOG_QUERY_KEYS.detail(id) : ['timelogs', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Timelog ID required');
      return timelogService.getTimelogById(id);
    },
    enabled: !!id,
  });
}

export function useTimelogMutations() {
  const queryClient = useQueryClient();

  const createTimelog = useMutation({
    mutationFn: (data: Partial<Timelog>) => timelogService.createTimelog(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const updateTimelog = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Timelog> }) =>
      timelogService.updateTimelog(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const deleteTimelog = useMutation({
    mutationFn: (id: string) => timelogService.deleteTimelog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TASK_QUERY_KEYS.all });
    },
  });

  const approveTimelog = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: { approved_by_id?: string; approved_by_name?: string } }) =>
      timelogService.approveTimelog(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.detail(id) });
    },
  });

  const rejectTimelog = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: { rejection_reason?: string } }) =>
      timelogService.rejectTimelog(id, payload),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TIMELOG_QUERY_KEYS.detail(id) });
    },
  });

  return {
    createTimelog,
    updateTimelog,
    deleteTimelog,
    approveTimelog,
    rejectTimelog,
    isCreating: createTimelog.isPending,
    isUpdating: updateTimelog.isPending,
    isDeleting: deleteTimelog.isPending,
    isApproving: approveTimelog.isPending,
    isRejecting: rejectTimelog.isPending,
  };
}
