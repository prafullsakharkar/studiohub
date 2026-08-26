import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetService } from '../services/AssetService';
import { Asset } from '@/mocks/db/assets/assets';
import { ASSET_QUERY_KEYS } from './useAssets';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function useAssetMutations() {
  const queryClient = useQueryClient();
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
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => assetService.deleteAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ASSET_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Asset Deleted',
        message: 'The asset was permanently deleted from the pipeline.',
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, isArchived }: { id: string; isArchived: boolean }) =>
      assetService.updateAsset(id, {
        is_archived: isArchived,
        status: isArchived ? 'Archived' : 'In Progress',
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ASSET_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: variables.isArchived ? 'Asset Archived' : 'Asset Restored',
        message: variables.isArchived
          ? 'Asset moved to archive and locked from production turnover.'
          : 'Asset restored to active production workspace.',
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
