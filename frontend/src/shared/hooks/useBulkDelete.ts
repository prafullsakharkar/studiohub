import { useMutation, type QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client/ApiClient';

/** Resources with a server bulk-delete endpoint (flat `/api/v1/.../bulk-delete/`). */
export type BulkDeletableResource =
  | 'departments'
  | 'teams'
  | 'offices'
  | 'people'
  | 'positions'
  | 'calendar-events'
  | 'holidays'
  | 'work-calendars';

interface BulkDeleteFactoryArgs {
  queryClient: QueryClient;
  addNotification: (n: { type: 'info' | 'success' | 'warning' | 'error'; title: string; message: string }) => void;
  resource: BulkDeletableResource;
  /** Entity list segment used in the react-query invalidation key. */
  listKey: string;
  entityLabel: string;
  onSuccess?: () => void;
}

/**
 * Shared bulk-delete mutation body for entity hooks. Called
 * unconditionally from inside each `useXMutations` hook so existing
 * per-entity mocks keep working. Targets the flat `/api/v1/<resource>/bulk-delete/`
 * endpoint — there is no org dimension.
 */
export function makeBulkDeleteMutation({
  queryClient,
  addNotification,
  resource,
  listKey,
  entityLabel,
  onSuccess,
}: BulkDeleteFactoryArgs) {
  return useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.post<{ processed: number; successful: number; failed: number }>(
        `/api/v1/${resource}/bulk-delete/`,
        { ids }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [listKey] });
      addNotification({
        type: result.failed > 0 ? 'warning' : 'success',
        title: 'Bulk Delete Complete',
        message: `${result.successful} ${entityLabel} deleted${result.failed > 0 ? `, ${result.failed} failed` : ''}.`,
      });
      onSuccess?.();
    },
  });
}
