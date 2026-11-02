import { assetBulk } from '@/api/production/bulkRoutes';
import { assetsApi } from '@/api/production/work';
import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';

/** Thin wrapper over the canonical generic bulk hook: no behavior lives here. */
export function useBulkAssets() {
  return useBulkEntity({
    service: assetBulk,
    queryKeyAll: assetsApi.keys.all,
    projectQueryKeyAll: PROJECT_QUERY_KEYS.all,
    labels: {
      singular: 'Asset',
      plural: 'assets',
    },
  });
}
