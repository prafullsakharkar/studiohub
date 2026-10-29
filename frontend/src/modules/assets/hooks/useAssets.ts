import { useQuery } from '@tanstack/react-query';
import { assetService } from '../services/AssetService';
import { QueryParams } from '@/types/common';
import { useProductionContext } from '@/core/production/ProductionContext';

export const ASSET_QUERY_KEYS = {
  all: ['assets'] as const,
  lists: () => [...ASSET_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...ASSET_QUERY_KEYS.lists(), params] as const,
  details: () => [...ASSET_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...ASSET_QUERY_KEYS.details(), id] as const,
};

export function useAssets(params?: QueryParams) {
  const { projectId, showId } = useProductionContext();
  const effectiveProjectId = (params?.project_id as string) || projectId;

  return useQuery({
    queryKey: [
      'projects',
      effectiveProjectId,
      'shows',
      showId,
      'assets',
      params,
    ],
    queryFn: () =>
      assetService.getAssets({
        ...params,
        project_id: effectiveProjectId || undefined,
        show_id: showId || undefined,
      }),
    enabled: Boolean(effectiveProjectId),
  });
}

export function useAsset(id?: string) {
  const { projectId, showId } = useProductionContext();

  return useQuery({
    queryKey: [
      'projects',
      projectId,
      'shows',
      showId,
      'assets',
      id,
    ],
    queryFn: () => {
      if (!id) throw new Error('Asset ID required');
      return assetService.getAssetById(id);
    },
    enabled: Boolean(projectId && showId && id),
  });
}
