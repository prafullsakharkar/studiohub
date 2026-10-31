import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';
import { assetService } from '../services/AssetService';
import { ASSET_QUERY_KEYS } from './useAssets';

/** Thin wrapper over the canonical generic bulk hook — no behavior lives here. */
export function useBulkAssets() {
  return useBulkEntity({
    service: assetService,
    queryKeyAll: ASSET_QUERY_KEYS.all,
    projectQueryKeyAll: PROJECT_QUERY_KEYS.all,
    labels: {
      singular: 'Asset',
      plural: 'assets',
    },
  });
}
