import { sequencesApi } from '@/api/production/structure';
import { shotBulk } from '@/api/production/bulkRoutes';
import { shotsApi } from '@/api/production/work';
import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';

/** Thin wrapper over the canonical generic bulk hook: no behavior lives here. */
export function useBulkShots() {
  return useBulkEntity({
    service: shotBulk,
    queryKeyAll: shotsApi.keys.all,
    projectQueryKeyAll: PROJECT_QUERY_KEYS.all,
    extraQueryKeys: {
      create: [sequencesApi.keys.all],
      archive: [sequencesApi.keys.all],
      restore: [sequencesApi.keys.all],
    },
    labels: {
      singular: 'Shot',
      plural: 'shots',
      restoreDestination: 'active production',
      titledOps: false,
      creationNoun: 'Creation',
    },
  });
}
