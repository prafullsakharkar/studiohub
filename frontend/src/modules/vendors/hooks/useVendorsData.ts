import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { trackEntityMutation } from '@/shared/hooks/trackEntityMutation';
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
      trackEntityMutation(queryClient, {
        action: 'created',
        actionLabel: 'Vendor Created',
        resourceType: 'vendor',
        resourceId: newVendor.id,
        resourceName: newVendor.name,
        resourceCode: newVendor.code,
        description: `Created vendor partner ${newVendor.name} [${newVendor.code}].`,
        tags: ['Vendor', 'Creation'],
        auditAction: 'CREATE',
        auditEntityType: 'Vendor',
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
      trackEntityMutation(queryClient, {
        action: 'updated',
        actionLabel: 'Vendor Updated',
        resourceType: 'vendor',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        description: `Updated vendor partner ${updated.name} [${updated.code}].`,
        tags: ['Vendor', 'Update'],
        auditAction: 'UPDATE',
        auditEntityType: 'Vendor',
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
      trackEntityMutation(queryClient, {
        action: 'archived',
        actionLabel: 'Vendor Archived',
        resourceType: 'vendor',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        description: `Archived vendor partner ${updated.name} [${updated.code}].`,
        tags: ['Vendor', 'Archive'],
        auditAction: 'ARCHIVE',
        auditEntityType: 'Vendor',
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
      trackEntityMutation(queryClient, {
        action: 'restored',
        actionLabel: 'Vendor Restored',
        resourceType: 'vendor',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        description: `Restored vendor partner ${updated.name} [${updated.code}].`,
        tags: ['Vendor', 'Restore'],
        auditAction: 'RESTORE',
        auditEntityType: 'Vendor',
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
      trackEntityMutation(queryClient, {
        action: 'deleted',
        actionLabel: 'Vendor Deleted',
        resourceType: 'vendor',
        resourceId: id,
        description: `Deleted vendor partner ${id}.`,
        tags: ['Vendor', 'Deletion'],
        auditAction: 'DELETE',
        auditEntityType: 'Vendor',
      });
    },
  });

  return { createVendor, updateVendor, archiveVendor, restoreVendor, deleteVendor };
};
