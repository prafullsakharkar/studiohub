import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { personApi } from '@/modules/people/api/personApi';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { makeBulkDeleteMutation } from '@/shared/hooks/useBulkDelete';
import {
  Person,
} from '@/types/masterData';

export const PEOPLE_QUERY_KEYS = {
  all: ['people'] as const,
  list: (params?: Record<string, any>) => [...PEOPLE_QUERY_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...PEOPLE_QUERY_KEYS.all, 'detail', id] as const,
};

export const usePeople = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: PEOPLE_QUERY_KEYS.list(params),
    queryFn: () => personApi.getPeople(params),
    staleTime: 1000 * 30,
  });
};

export const usePerson = (id: string) => {
  return useQuery({
    queryKey: PEOPLE_QUERY_KEYS.detail(id),
    queryFn: () => personApi.getPersonDetail(id),
    enabled: !!id,
  });
};

export const usePersonMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createPerson = useMutation({
    mutationFn: (data: Partial<Person>) => personApi.createPerson(data),
    onSuccess: (newPerson) => {
      queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Crew Member Added',
        message: `${newPerson.full_name} (${newPerson.role}) registered.`,
      });
    },
  });

  const updatePerson = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Person> }) =>
      personApi.updatePerson(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.detail(updated.id) });
      addNotification({
        type: 'success',
        title: 'Artist Profile Updated',
        message: `${updated.full_name}'s record has been updated.`,
      });
    },
  });

  const deletePerson = useMutation({
    mutationFn: (id: string) => personApi.deletePerson(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Artist Removed',
        message: 'The crew member has been removed from the roster.',
      });
    },
  });

  const bulkDeletePerson = makeBulkDeleteMutation({
    queryClient,
    addNotification,
    resource: 'people',
    listKey: 'people',
    entityLabel: 'people',
  });
  return { createPerson, updatePerson, deletePerson, bulkDeletePerson };
};
