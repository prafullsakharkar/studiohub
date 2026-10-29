import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { makeBulkDeleteMutation } from '@/shared/hooks/useBulkDelete';
import {
  Team,
} from '@/types/masterData';

export const TEAMS_QUERY_KEYS = {
  all: ['teams'] as const,
  list: (params?: Record<string, any>) => [...TEAMS_QUERY_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...TEAMS_QUERY_KEYS.all, 'detail', id] as const,
};

export const useTeams = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: TEAMS_QUERY_KEYS.list(params),
    queryFn: () => masterDataApi.getTeams(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useTeam = (id: string) => {
  return useQuery({
    queryKey: TEAMS_QUERY_KEYS.detail(id),
    queryFn: () => masterDataApi.getTeamDetail(id),
    enabled: !!id,
  });
};

export const useTeamMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createTeam = useMutation({
    mutationFn: (data: Partial<Team>) => masterDataApi.createTeam(data),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Team Squad Assembled',
        message: `${team.name} has been created.`,
      });
    },
  });

  const updateTeam = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Team> }) =>
      masterDataApi.updateTeam(id, data),
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEYS.detail(team.id) });
      addNotification({
        type: 'success',
        title: 'Team Updated',
        message: `${team.name} updated successfully.`,
      });
    },
  });

  const deleteTeam = useMutation({
    mutationFn: (target: string | { id: string; name?: string; code?: string }) =>
      masterDataApi.deleteTeam(typeof target === 'string' ? target : target.id),
    onSuccess: (_data, target) => {
      const id = typeof target === 'string' ? target : target.id;
      const name = typeof target === 'string' ? undefined : target.name;
      const code = typeof target === 'string' ? undefined : target.code;
      queryClient.invalidateQueries({ queryKey: TEAMS_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Team Deleted',
        message: 'Team squad removed.',
      });
    },
  });

  const bulkDeleteTeam = makeBulkDeleteMutation({
    queryClient,
    addNotification,
    resource: 'teams',
    listKey: 'teams',
    entityLabel: 'teams',
  });
  return { createTeam, updateTeam, deleteTeam, bulkDeleteTeam };
};
