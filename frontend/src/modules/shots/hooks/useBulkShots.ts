import { PROJECT_QUERY_KEYS } from '@/modules/production';
import { sequencesApi } from '@/api/production/structure';
import { useBulkEntity } from '@/shared/hooks/useBulkEntity';
import { shotService } from '../services/ShotService';
import { SHOT_QUERY_KEYS } from './useShots';

/** Thin wrapper over the canonical generic bulk hook — no behavior lives here. */
export function useBulkShots() {
  return useBulkEntity({
    service: shotService,
    queryKeyAll: SHOT_QUERY_KEYS.all,
    projectQueryKeyAll: PROJECT_QUERY_KEYS.all,
    extraQueryKeys: {
      create: [sequencesApi.keys.all],
      archive: [sequencesApi.keys.all],
      restore: [sequencesApi.keys.all],
    },
    labels: {
      singular: 'Shot',
      plural: 'shots',
      entityType: 'shot',
      bulkId: 'bulk-shots',
      bulkName: 'Bulk Shots',
      bulkCode: 'BULK_SHOT',
      stagingVerb: 'Created',
      restoreDestination: 'active production',
      titledOps: false,
      creationNoun: 'Creation',
      describeCreateResults: (createdCount, recoveredCount, failedCount) =>
        `Bulk operation: ${createdCount} created, ${recoveredCount} recovered, ${failedCount} failed`,
    },
  });
}
