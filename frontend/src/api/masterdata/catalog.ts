import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';
import { createQueryKeys } from '@/shared/data/queryKeys';

type Schemas = components['schemas'];

/**
 * The platform catalog (`/api/v1/platform/master-data/*`): small, UNPAGINATED lists, mounted WITHOUT a
 * trailing slash (a slash is a 404; ApiClient leaves these paths alone). Rows carry `status`
 * 'active' | 'archived' (there is no `is_archived`), `is_system` rows cannot be deleted, and writes need
 * `masterdata.catalog.manage` (`?hard=true` on delete also needs `masterdata.hard_delete`).
 */
export type CatalogKind = 'task-types' | 'asset-types' | 'shot-types' | 'review-types' | 'file-types' | 'statuses' | 'software';

export interface CatalogRowBase {
  id: string;
  name: string;
  code: string;
  description?: string;
  status: string;
  scope: string;
  is_system: boolean;
  sort_order?: number;
  created_at: string;
  updated_at: string;
}

export type TaskType = Schemas['MasterTaskType'];
export type AssetType = Schemas['MasterAssetType'];
export type ShotType = Schemas['MasterShotType'];
export type ReviewType = Schemas['MasterReviewType'];
export type FileType = Schemas['MasterFileType'];
export type MasterStatus = Schemas['MasterStatus'];
export type Software = Schemas['Software'];
export type SoftwareVersion = Schemas['SoftwareVersion'];

export const catalogKeys = createQueryKeys('catalog');

export interface CatalogListParams {
  search?: string;
  /** 'active' | 'archived'. */
  status?: string;
  [filter: string]: string | undefined;
}

const root = (kind: CatalogKind) => `/api/v1/platform/master-data/${kind}`;

function api<Row, Input>(base: string) {
  return {
    list: (params: CatalogListParams = {}, signal?: AbortSignal) => apiClient.get<Row[]>(base, { params, signal }),
    get: (id: string, signal?: AbortSignal) => apiClient.get<Row>(`${base}/${id}`, { signal }),
    create: (input: Input) => apiClient.post<Row>(base, input),
    update: (id: string, patch: Partial<Input>) => apiClient.patch<Row>(`${base}/${id}`, patch),
    // archive / restore answer `{success, data: row}`; create, update and reorder answer the bare row(s).
    archive: async (id: string) => (await apiClient.post<{ success: boolean; data: Row }>(`${base}/${id}/archive`, {})).data,
    restore: async (id: string) => (await apiClient.post<{ success: boolean; data: Row }>(`${base}/${id}/restore`, {})).data,
    /** A SOFT delete (`{success, message}`, 200): the row disappears from every list. System rows answer 409. */
    remove: (id: string, hard = false) => apiClient.delete<{ success: boolean; message: string }>(`${base}/${id}${hard ? '?hard=true' : ''}`),
    /** Gives the listed ids positions 10, 20, 30 … in that order; ids not listed keep their old numbers. */
    reorder: (ids: string[]) => apiClient.post<Row[]>(`${base}/reorder`, { ids }),
  };
}

export const catalogApi = <Row extends CatalogRowBase = CatalogRowBase>(kind: CatalogKind) => api<Row, Record<string, unknown>>(root(kind));

/** Versions of one software package: `/software/{id}/versions`. */
export const softwareVersionsApi = (softwareId: string) => api<SoftwareVersion, Record<string, unknown>>(`${root('software')}/${softwareId}/versions`);
