import type { QueryClient } from '@tanstack/react-query';

import { useActivityStore } from '@/shared/stores/useActivityStore';

export interface EntityMutationTrackInput {
  action: string;
  actionLabel: string;
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  resourceCode?: string;
  description: string;
  tags: string[];
  auditAction: string;
  auditEntityType: string;
  auditEntityCode?: string;
}

/**
 * Shared entity mutation tracking.
 *
 * Every entity mutation records a client-side activity event (rendered in the
 * workspace Activity tab / timeline) and invalidates the audit cache. In mock
 * (MSW) mode it also appends a compliance audit row via POST /api/v1/audit/
 * to simulate server-side auditing — production builds never take this path,
 * so there is no double-auditing against the live API. Tracking must never
 * break the underlying mutation, hence the isolation.
 */
export function trackEntityMutation(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
  input: EntityMutationTrackInput,
): void {
  try {
    useActivityStore.getState().recordActivity({
      action: input.action,
      actionLabel: input.actionLabel,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      resourceName: input.resourceName,
      resourceCode: input.resourceCode,
      description: input.description,
      tags: input.tags,
    });
  } catch {
    // Activity tracking must never break entity mutations.
  }

  try {
    void queryClient.invalidateQueries({ queryKey: ['audit'] }).catch(() => undefined);
  } catch {
    // Ignore cache-invalidation failures.
  }
}
