import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { makeBulkDeleteMutation } from '@/shared/hooks/useBulkDelete';
import {
  Office,
} from '@/types/masterData';

export const OFFICES_QUERY_KEYS = {
  all: ['offices'] as const,
  list: (params?: Record<string, any>) => [...OFFICES_QUERY_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...OFFICES_QUERY_KEYS.all, 'detail', id] as const,
};

export const useOffices = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: OFFICES_QUERY_KEYS.list(params),
    queryFn: () => masterDataApi.getOffices(params),
    staleTime: 1000 * 60 * 5,
  });
};

export const useOffice = (id: string) => {
  return useQuery({
    queryKey: OFFICES_QUERY_KEYS.detail(id),
    queryFn: () => masterDataApi.getOfficeDetail(id),
    enabled: !!id,
  });
};

export const useOfficeMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createOffice = useMutation({
    mutationFn: (data: Partial<Office>) => {
      // Backend OfficeCreateSerializer requires `code` and `office_type`; the
      // workspace forms only collect city/country details, so fill the contract
      // here (same pattern as createDepartment injecting `department_type`).
      const city = (data.city as string | undefined)?.trim() ?? '';
      const suffix = Math.random().toString(36).slice(2, 4).toUpperCase().padEnd(2, 'X');
      const code =
        (data.code as string | undefined)?.trim() ||
        (city ? `OFF-${city.substring(0, 3).toUpperCase()}${suffix}` : 'OFF-HQ');
      return masterDataApi.createOffice({
        office_type: 'branch',
        ...data,
        code,
      });
    },
    onSuccess: (office) => {
      queryClient.invalidateQueries({ queryKey: OFFICES_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Facility Hub Registered',
        message: `${office.name} [${office.city}] online.`,
      });
    },
  });

  const updateOffice = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Office> }) =>
      masterDataApi.updateOffice(id, data),
    onSuccess: (office) => {
      queryClient.invalidateQueries({ queryKey: OFFICES_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: OFFICES_QUERY_KEYS.detail(office.id) });
      addNotification({
        type: 'success',
        title: 'Facility Hub Updated',
        message: `${office.name} configuration saved.`,
      });
    },
  });

  const deleteOffice = useMutation({
    mutationFn: (target: string | { id: string; name?: string; code?: string }) =>
      masterDataApi.deleteOffice(typeof target === 'string' ? target : target.id),
    onSuccess: (_data, target) => {
      const id = typeof target === 'string' ? target : target.id;
      const name = typeof target === 'string' ? undefined : target.name;
      const code = typeof target === 'string' ? undefined : target.code;
      queryClient.invalidateQueries({ queryKey: OFFICES_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Facility Hub Removed',
        message: 'Facility hub has been decommissioned.',
      });
    },
  });

  const bulkDeleteOffice = makeBulkDeleteMutation({
    queryClient,
    addNotification,
    resource: 'offices',
    listKey: 'offices',
    entityLabel: 'offices',
  });
  return { createOffice, updateOffice, deleteOffice, bulkDeleteOffice };
};
