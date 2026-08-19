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

  return {
    createAsset: createMutation.mutateAsync,
    updateAsset: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
  };
}
