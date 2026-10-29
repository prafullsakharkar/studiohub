import { apiClient } from '@/api/client/ApiClient';
import { listFetcher } from '@/shared/data/listing';
import { createQueryKeys } from '@/shared/data/queryKeys';

/**
 * The directory routes are plain DRF viewsets: `GET/POST base/`, `GET/PATCH/DELETE base/{id}/`, and some
 * of them `POST base/{id}/restore/`. Deleting a row that is still referenced answers
 * `409 {"error": {"code": "has_dependants"}}` (docs/sync/00-backend-inventory.md §3).
 */
export function resourceApi<Row, Input>(name: string, base: string) {
  return {
    keys: createQueryKeys(name),
    list: listFetcher<Row>(base),
    get: (id: string, signal?: AbortSignal) => apiClient.get<Row>(`${base}${id}/`, { signal }),
    create: (input: Input) => apiClient.post<Row>(base, input),
    update: (id: string, patch: Partial<Input>) => apiClient.patch<Row>(`${base}${id}/`, patch),
    remove: (id: string) => apiClient.delete<void>(`${base}${id}/`),
    /** `POST {id}/{action}/` for the routes that have one (restore, activate, terminate, …). */
    act: <Result = Row>(id: string, action: string, body: Record<string, unknown> = {}) => apiClient.post<Result>(`${base}${id}/${action}/`, body),
  };
}
