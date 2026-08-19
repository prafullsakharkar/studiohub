import { useQuery } from '@tanstack/react-query';
import { assetService } from '../services/AssetService';
import { QueryParams } from '@/types/drf';

export const ASSET_QUERY_KEYS = {
  all: ['assets'] as const,
  lists: () => [...ASSET_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...ASSET_QUERY_KEYS.lists(), params] as const,
  details: () => [...ASSET_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...ASSET_QUERY_KEYS.details(), id] as const,
};

export function useAssets(params?: QueryParams) {
  return useQuery({
    queryKey: ASSET_QUERY_KEYS.list(params),
    queryFn: () => assetService.getAssets(params),
  });
}

export function useAsset(id?: string) {
  return useQuery({
    queryKey: id ? ASSET_QUERY_KEYS.detail(id) : ['assets', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Asset ID required');
      return assetService.getAssetById(id);
    },
    enabled: !!id,
  });
}
