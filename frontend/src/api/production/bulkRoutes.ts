import { apiClient } from '@/api/client/ApiClient';
import type { BulkEntityService } from '@/shared/hooks/useBulkEntity';
import type { Asset, Shot, Task } from '@/types/production';

/**
 * The bulk routes of a production entity as the bulk managers use them: the manager's own request is posted as it is
 * and its richer answer (`summary`, `results[]`) is read back. `POST {base}check-existence|bulk-create|bulk-update|
 * bulk-archive|bulk-restore/` (docs/sync/00-backend-inventory.md). The typed `archivable()` helpers in `work.ts` take
 * simpler arguments and return the smaller `BulkResult`; the managers need these.
 */
export function bulkRoutes<T>(base: string): BulkEntityService<T> {
  const post = <R>(route: string, payload: unknown) => apiClient.post<R>(`${base}${route}/`, payload);
  return {
    checkExistence: (payload) => post('check-existence', payload),
    bulkCreate: (payload) => post('bulk-create', payload),
    bulkUpdate: (payload) => post('bulk-update', payload),
    bulkArchive: (payload) => post('bulk-archive', payload),
    bulkRestore: (payload) => post('bulk-restore', payload),
  };
}

export const shotBulk = bulkRoutes<Shot>('/api/v1/shots/');
export const assetBulk = bulkRoutes<Asset>('/api/v1/assets/');
export const taskBulk = bulkRoutes<Task>('/api/v1/tasks/');
