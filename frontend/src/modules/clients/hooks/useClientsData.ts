import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { trackEntityMutation } from '@/shared/hooks/trackEntityMutation';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  Client,
} from '@/types/masterData';

export const CLIENTS_QUERY_KEYS = {
  all: ['clients'] as const,
  list: (params?: Record<string, any>) => [...CLIENTS_QUERY_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...CLIENTS_QUERY_KEYS.all, 'detail', id] as const,
};

export const useClients = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEYS.list(params),
    queryFn: () => masterDataApi.getClients(params),
    staleTime: 1000 * 30,
  });
};

export const useClient = (id: string) => {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEYS.detail(id),
    queryFn: () => masterDataApi.getClientDetail(id),
    enabled: !!id,
  });
};

export const useClientMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createClient = useMutation({
    mutationFn: (data: Partial<Client>) => masterDataApi.createClient(data),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Client Studio Added',
        message: `${newClient.name} [${newClient.code}] has been registered in the production roster.`,
      });
      trackEntityMutation(queryClient, {
        action: 'created',
        actionLabel: 'Client Created',
        resourceType: 'client',
        resourceId: newClient.id,
        resourceName: newClient.name,
        resourceCode: newClient.code,
        description: `Created client studio ${newClient.name} [${newClient.code}].`,
        tags: ['Client', 'Creation'],
        auditAction: 'CREATE',
        auditEntityType: 'Client',
      });
    },
    onError: () => {
      addNotification({
        type: 'error',
        title: 'Failed to Create Client',
        message: 'Could not complete client studio registration.',
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Client> }) =>
      masterDataApi.updateClient(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.detail(updated.id) });
      addNotification({
        type: 'success',
        title: 'Client Account Updated',
        message: `${updated.name} records have been updated successfully.`,
      });
      trackEntityMutation(queryClient, {
        action: 'updated',
        actionLabel: 'Client Updated',
        resourceType: 'client',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        description: `Updated client studio ${updated.name} [${updated.code}].`,
        tags: ['Client', 'Update'],
        auditAction: 'UPDATE',
        auditEntityType: 'Client',
      });
    },
  });

  const archiveClient = useMutation({
    mutationFn: (id: string) => masterDataApi.archiveClient(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.all });
      queryClient.setQueryData(CLIENTS_QUERY_KEYS.detail(updated.id), updated);
      addNotification({
        type: 'info',
        title: 'Client Studio Archived',
        message: `${updated.name} has been archived.`,
      });
      trackEntityMutation(queryClient, {
        action: 'archived',
        actionLabel: 'Client Archived',
        resourceType: 'client',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        description: `Archived client studio ${updated.name} [${updated.code}].`,
        tags: ['Client', 'Archive'],
        auditAction: 'ARCHIVE',
        auditEntityType: 'Client',
      });
    },
  });

  const restoreClient = useMutation({
    mutationFn: (id: string) => masterDataApi.restoreClient(id),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.all });
      queryClient.setQueryData(CLIENTS_QUERY_KEYS.detail(updated.id), updated);
      addNotification({
        type: 'success',
        title: 'Client Studio Restored',
        message: `${updated.name} status restored to Active.`,
      });
      trackEntityMutation(queryClient, {
        action: 'restored',
        actionLabel: 'Client Restored',
        resourceType: 'client',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        description: `Restored client studio ${updated.name} [${updated.code}].`,
        tags: ['Client', 'Restore'],
        auditAction: 'RESTORE',
        auditEntityType: 'Client',
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: (id: string) => masterDataApi.softDeleteClient(id),
    onSuccess: (updated: any, id: string) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEYS.all });
      if (updated && updated.id) {
        queryClient.setQueryData(CLIENTS_QUERY_KEYS.detail(updated.id), updated);
      } else {
        queryClient.setQueryData(CLIENTS_QUERY_KEYS.detail(id), (prev: any) =>
          prev ? { ...prev, is_deleted: true, status: 'Deleted', deleted_at: new Date().toISOString() } : prev
        );
      }
      addNotification({
        type: 'info',
        title: 'Client Moved to Trash',
        message: 'The client studio account was soft-deleted and can be retrieved at any time.',
      });
      trackEntityMutation(queryClient, {
        action: 'deleted',
        actionLabel: 'Client Deleted',
        resourceType: 'client',
        resourceId: updated?.id ?? id,
        resourceName: updated?.name,
        resourceCode: updated?.code,
        description: `Deleted client studio ${updated?.name ?? id}.`,
        tags: ['Client', 'Deletion'],
        auditAction: 'DELETE',
        auditEntityType: 'Client',
      });
    },
  });

  return { createClient, updateClient, archiveClient, restoreClient, deleteClient };
};
