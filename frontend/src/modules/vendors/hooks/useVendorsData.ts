import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  Vendor,
} from '@/types/masterData';

export const VENDORS_QUERY_KEYS = {
  all: ['vendors'] as const,
  list: (params?: Record<string, any>) => [...VENDORS_QUERY_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...VENDORS_QUERY_KEYS.all, 'detail', id] as const,
};

export const useVendors = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: VENDORS_QUERY_KEYS.list(params),
    queryFn: () => masterDataApi.getVendors(params),
    staleTime: 1000 * 30,
  });
};

export const useVendor = (id: string) => {
  return useQuery({
    queryKey: VENDORS_QUERY_KEYS.detail(id),
    queryFn: () => masterDataApi.getVendorDetail(id),
    enabled: !!id,
  });
};

export const useVendorMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createVendor = useMutation({
    mutationFn: (data: Partial<Vendor>) => masterDataApi.createVendor(data),
    onSuccess: (newVendor) => {
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Vendor Partner Enrolled',
        message: `${newVendor.name} [${newVendor.code}] added as approved outsourcing partner.`,
      });
    },
  });

  const updateVendor = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Vendor> }) =>
      masterDataApi.updateVendor(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.detail(updated.id) });
      addNotification({
        type: 'success',
        title: 'Vendor Updated',
        message: `${updated.name} records saved.`,
      });
    },
  });

  const archiveVendor = useMutation({
    mutationFn: (id: string) => masterDataApi.archiveVendor(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.detail(updated.id) });
      addNotification({
        type: 'info',
        title: 'Vendor Partner Archived',
        message: `${updated.name} has been archived.`,
      });
    },
  });

  const restoreVendor = useMutation({
    mutationFn: (id: string) => masterDataApi.restoreVendor(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.detail(updated.id) });
      addNotification({
        type: 'success',
        title: 'Vendor Restored',
        message: `${updated.name} restored to Approved Partner.`,
      });
    },
  });

  const deleteVendor = useMutation({
    mutationFn: (id: string) => masterDataApi.deleteVendor(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: VENDORS_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Vendor Partner Removed',
        message: 'Outsourcing partner facility removed from registry.',
      });
    },
  });

  return { createVendor, updateVendor, archiveVendor, restoreVendor, deleteVendor };
};
