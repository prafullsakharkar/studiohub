import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Asset } from '@/types/production';
import { assetService } from '../services/AssetService';
import { ASSET_QUERY_KEYS } from './useAssets';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';

export function useAssetMutations() {
  const queryClient = useQueryClient();
  const recordActivity = useActivityStore((state) => state.recordActivity);
  const addNotification = useNotificationStore((state) => state.addNotification);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => assetService.createAsset(data),
    onSuccess: (newAsset) => {
      queryClient.invalidateQueries({ queryKey: ASSET_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Asset Registered',
        message: `Asset ${newAsset.name} (${newAsset.code}) registered in OpenUSD pipeline.`,
      });

      recordActivity({
        action: 'created',
        actionLabel: 'Asset Registered',
        resourceType: 'asset',
        resourceId: newAsset.id,
        resourceName: newAsset.name,
        resourceCode: newAsset.code,
        projectId: newAsset.project_id,
        description: `Registered asset ${newAsset.name} (${newAsset.code}) in OpenUSD pipeline.`,
        tags: ['Asset', 'Creation'],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Asset> }) =>
      assetService.updateAsset(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ASSET_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Asset Updated',
        message: `Asset ${updated.name} updated.`,
      });

      recordActivity({
        action: 'updated',
        actionLabel: 'Asset Updated',
        resourceType: 'asset',
        resourceId: updated.id,
        resourceName: updated.name,
        resourceCode: updated.code,
        projectId: updated.project_id,
        description: `Updated asset ${updated.name} (${updated.code}).`,
        tags: ['Asset', 'Update'],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetService.deleteAsset(id),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ASSET_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Asset Deleted',
        message: 'The asset was permanently deleted from the pipeline.',
      });

      recordActivity({
        action: 'deleted',
        actionLabel: 'Asset Deleted',
        resourceType: 'asset',
        resourceId: deletedId,
        description: `Permanently deleted asset ${deletedId} from pipeline.`,
        tags: ['Asset', 'Deletion'],
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      assetService.updateAsset(id, {
        is_archived: isArchived,
        status: isArchived ? 'Archived' : 'In Progress',
      }),
    onSuccess: (updatedAsset, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: variables.isArchived ? 'Asset Archived' : 'Asset Restored',
        message: variables.isArchived
          ? 'Asset moved to archive and locked from production turnover.'
          : 'Asset restored to active production workspace.',
      });

      recordActivity({
        action: variables.isArchived ? 'archived' : 'restored',
        actionLabel: variables.isArchived ? 'Asset Archived' : 'Asset Restored',
        resourceType: 'asset',
        resourceId: updatedAsset.id,
        resourceName: updatedAsset.name,
        resourceCode: updatedAsset.code,
        projectId: updatedAsset.project_id,
        description: variables.isArchived
          ? `Archived asset ${updatedAsset.name} (${updatedAsset.code}).`
          : `Restored asset ${updatedAsset.name} (${updatedAsset.code}) to active workspace.`,
        tags: ['Asset', variables.isArchived ? 'Archive' : 'Restore'],
      });
    },
  });

  return {
    createAsset: createMutation.mutateAsync,
    updateAsset: updateMutation.mutateAsync,
    deleteAsset: deleteMutation.mutateAsync,
    archiveAsset: (id: string) => archiveMutation.mutateAsync({ id, isArchived: true }),
    restoreAsset: (id: string) => archiveMutation.mutateAsync({ id, isArchived: false }),
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isArchiving: archiveMutation.isPending,
  };
}
