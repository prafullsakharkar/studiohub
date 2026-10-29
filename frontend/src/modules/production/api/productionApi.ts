import { apiClient } from '@/api/client/ApiClient';
import { Project, PublishedVersion } from '@/types/production';
import { ListResult, PaginatedResponse } from '@/types/common';

/**
 * Flat production endpoints (`/api/v1/projects/`, `/api/v1/versions/`).
 *
 * Formerly part of the deleted org module's API client; projects and
 * published versions are project-scoped platform resources, so these calls
 * target the flat routes without an org id.
 */
export const productionApi = {
  getProjects: async (params?: Record<string, any>): Promise<ListResult<Project>> => {
    const res = await apiClient.get<Project[] | PaginatedResponse<Project>>('/api/v1/projects/', { params });
    const items = (Array.isArray(res) ? res : res?.results ?? []).map((t: any) => ({
      ...t,
      id: t.id ?? t.uuid,
    }));
    return { items, totalCount: Array.isArray(res) ? null : (res?.count ?? null) };
  },
  getVersions: async (params?: Record<string, any>): Promise<PaginatedResponse<PublishedVersion>> => {
    return apiClient.get<PaginatedResponse<PublishedVersion>>('/api/v1/versions/', { params });
  },
};
