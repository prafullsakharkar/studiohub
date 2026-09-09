import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { OrganizationService } from '../services/OrganizationService';
import { Organization } from '@/types/organization';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

const repo = new OrganizationRepository();
const service = new OrganizationService(repo);

export const useOrganizationMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createMutation = useMutation({
    mutationFn: (data: Partial<Organization>) => service.createOrganization(data),
    onSuccess: (newOrg) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      addNotification({
        type: 'success',
        title: 'Studio Organization Created',
        message: `${newOrg.name} [${newOrg.code}] is initialized with tenant isolation and OCIO pipeline schema.`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Organization Creation Failed',
        message: err.message || 'Could not register studio organization.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Organization> }) =>
      service.updateOrganization(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', updated.id] });
      addNotification({
        type: 'success',
        title: 'Organization Profile Updated',
        message: `Changes for ${updated.name} have been committed.`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Could not update organization profile.',
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => service.archiveOrganization(id),
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', archived.id] });
      addNotification({
        type: 'warning',
        title: 'Organization Archived',
        message: `${archived.name} has been archived. Production pipelines are placed in read-only mode.`,
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => service.restoreOrganization(id),
    onSuccess: (restored) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', restored.id] });
      addNotification({
        type: 'success',
        title: 'Organization Restored',
        message: `${restored.name} is restored to active operational status.`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => service.deleteOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      addNotification({
        type: 'info',
        title: 'Organization Deleted',
        message: 'The studio organization tenancy was removed.',
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Deletion Failed',
        message: err.message || 'Cannot delete active studio with attached production data.',
      });
    },
  });

  return {
    createOrganization: createMutation.mutateAsync,
    updateOrganization: updateMutation.mutateAsync,
    archiveOrganization: archiveMutation.mutateAsync,
    restoreOrganization: restoreMutation.mutateAsync,
    deleteOrganization: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
