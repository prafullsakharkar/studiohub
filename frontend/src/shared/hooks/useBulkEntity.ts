import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { useActivityStore } from '@/shared/stores/useActivityStore';

export interface BulkEntityLabels {
  singular: string;
  plural: string;
  entityType: string;
  bulkId: string;
  bulkName: string;
  bulkCode: string;
  /** Extra activity tag after Label + 'Bulk Operations' (e.g. 'USD'). */
  extraTag?: string;
  /** Verb for the staging action label (default 'Staged'). */
  stagingVerb?: string;
  /** Destination phrase for restore messages (default 'active library'). */
  restoreDestination?: string;
  /** When false, titles omit the entity label (legacy shots style). */
  titledOps?: boolean;
  /** Noun for creation titles: `Bulk {Label} {creationNoun} Complete` (default 'Staging'). */
  creationNoun?: string;
  /** Custom one-line summary for the creation activity entry. */
  describeCreateResults?: (created: number, recovered: number, failed: number) => string;
}

export interface BulkEntityService<T> {
  checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<T>>;
  bulkCreate(payload: BulkCreateRequest<T>): Promise<BulkOperationResponse<T>>;
  bulkUpdate(payload: BulkUpdateRequest<T>): Promise<BulkOperationResponse<T>>;
  bulkArchive(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<T>>;
  bulkRestore(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<T>>;
}

export interface UseBulkEntityOptions<T> {
  service: BulkEntityService<T>;
  queryKeyAll: unknown[] | readonly unknown[];
  projectQueryKeyAll: unknown[] | readonly unknown[];
  extraQueryKeys?: Partial<
    Record<'create' | 'update' | 'archive' | 'restore', (unknown[] | readonly unknown[])[]>
  >;
  labels: BulkEntityLabels;
}

const ACTOR = { id: 'usr-current', name: 'Alex Chen', email: 'alex.chen@nexusvfx.com', role: 'VFX Supervisor' };

/**
 * Canonical generic bulk-operations hook. Per-entity hooks are thin wrappers
 * supplying their service, query keys, and labels — no behavior lives there.
 */
export function useBulkEntity<T>(options: UseBulkEntityOptions<T>) {
  const { service, queryKeyAll, projectQueryKeyAll, extraQueryKeys, labels } = options;
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);
  const addActivity = useActivityStore((state) => state.addActivity);

  const {
    singular: Label,
    plural,
    entityType,
    bulkId,
    bulkName,
    bulkCode,
    extraTag,
    stagingVerb = 'Staged',
    restoreDestination = 'active library',
    titledOps = true,
    creationNoun = 'Staging',
    describeCreateResults,
  } = labels;

  const tags = extraTag ? [Label, 'Bulk Operations', extraTag] : [Label, 'Bulk Operations'];
  const pluralLabel = plural[0].toUpperCase() + plural.slice(1);
  const title = (op: string) => (titledOps ? `Bulk ${Label} ${op} Complete` : `Bulk ${op} Complete`);
  const entity = { type: entityType, id: bulkId, name: bulkName, code: bulkCode };

  const invalidate = (op: 'create' | 'update' | 'archive' | 'restore') => {
    queryClient.invalidateQueries({ queryKey: [...queryKeyAll] });
    queryClient.invalidateQueries({ queryKey: [...projectQueryKeyAll] });
    for (const key of extraQueryKeys?.[op] ?? []) {
      queryClient.invalidateQueries({ queryKey: [...key] });
    }
  };

  const checkExistenceMutation = useMutation({
    mutationFn: (payload: CheckExistencePayload): Promise<CheckExistenceResponse<T>> =>
      service.checkExistence(payload),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (payload: BulkCreateRequest<T>): Promise<BulkOperationResponse<T>> =>
      service.bulkCreate(payload),
    onSuccess: (resp) => {
      invalidate('create');
      const { createdCount, recoveredCount, failedCount } = resp.summary;
      if (failedCount === 0) {
        addNotification({
          type: 'success',
          title: `Bulk ${Label} ${creationNoun} Complete`,
          message: `Successfully processed ${createdCount + recoveredCount} ${plural} (${createdCount} created, ${recoveredCount} recovered).`,
        });
      } else {
        addNotification({
          type: 'warning',
          title: `Bulk ${Label} ${creationNoun} Finished with Warnings`,
          message: `${createdCount} created, ${recoveredCount} recovered, ${failedCount} failed.`,
        });
      }
      addActivity({
        action: 'bulk_create' as never,
        actionLabel: `Bulk ${stagingVerb} ${pluralLabel}`,
        actor: ACTOR,
        entity,
        description:
          describeCreateResults?.(createdCount, recoveredCount, failedCount) ??
          `Bulk ${plural} operation: ${createdCount} created, ${recoveredCount} recovered, ${failedCount} failed`,
        tags,
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (payload: BulkUpdateRequest<T>): Promise<BulkOperationResponse<T>> =>
      service.bulkUpdate(payload),
    onSuccess: (resp) => {
      invalidate('update');
      addNotification({
        type: 'info',
        title: title('Update'),
        message: `Updated ${resp.summary.updatedCount} ${plural} successfully.`,
      });
      addActivity({
        action: 'bulk_update' as never,
        actionLabel: `Bulk Updated ${pluralLabel}`,
        actor: ACTOR,
        entity,
        description: `Bulk updated ${resp.summary.updatedCount} ${plural}`,
        tags: [Label, 'Bulk Operations'],
      });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (payload: BulkArchiveRestoreRequest) => service.bulkArchive(payload),
    onSuccess: (resp) => {
      invalidate('archive');
      addNotification({
        type: 'warning',
        title: title('Archive'),
        message: `Archived ${resp.summary?.archivedCount || 0} ${plural}.`,
      });
      addActivity({
        action: 'bulk_archive' as never,
        actionLabel: `Bulk Archived ${pluralLabel}`,
        actor: ACTOR,
        entity,
        description: `Archived ${resp.summary?.archivedCount || 0} ${plural}`,
        tags: [Label, 'Bulk Operations'],
      });
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: (payload: BulkArchiveRestoreRequest) => service.bulkRestore(payload),
    onSuccess: (resp) => {
      invalidate('restore');
      addNotification({
        type: 'success',
        title: title('Restore'),
        message: `Restored ${resp.summary?.restoredCount || 0} ${plural} to ${restoreDestination}.`,
      });
      addActivity({
        action: 'bulk_restore' as never,
        actionLabel: `Bulk Restored ${pluralLabel}`,
        actor: ACTOR,
        entity,
        description: `Restored ${resp.summary?.restoredCount || 0} ${plural}`,
        tags: [Label, 'Bulk Operations'],
      });
    },
  });

  return {
    checkExistence: checkExistenceMutation.mutateAsync,
    bulkCreate: bulkCreateMutation.mutateAsync,
    bulkUpdate: bulkUpdateMutation.mutateAsync,
    bulkArchive: bulkArchiveMutation.mutateAsync,
    bulkRestore: bulkRestoreMutation.mutateAsync,
    isCheckingExistence: checkExistenceMutation.isPending,
    isBulkCreating: bulkCreateMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
    isBulkArchiving: bulkArchiveMutation.isPending,
    isBulkRestoring: bulkRestoreMutation.isPending,
  };
}
