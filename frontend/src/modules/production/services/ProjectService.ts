import { apiClient } from '@/api/client/ApiClient';
import { Project } from '@/types/production';
import { PaginatedResponse, QueryParams } from '@/types/common';

const BASE = '/api/v1/projects/';
const idPath = (id: string) => `${BASE}${encodeURIComponent(id.trim())}/`;

/** A query without the empty values (DRF treats `?search=` and a missing parameter differently from the screens' intent). */
const clean = (params?: QueryParams) => Object.fromEntries(Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''));

/**
 * The project routes for the project workspace page, which still uses the older `Project` shape (docs/sync Phase 20 §
 * "Not done"): rebuilding that page on the typed `projectsApi` is a phase of its own.
 */
export class ProjectService {
  async getProjects(params?: QueryParams): Promise<PaginatedResponse<Project>> {
    return apiClient.get<PaginatedResponse<Project>>(BASE, { params: clean(params) as never });
  }

  async getProjectById(id: string): Promise<Project> {
    return apiClient.get<Project>(idPath(id));
  }

  async createProject(data: Partial<Project>): Promise<Project> {
    return apiClient.post<Project>(BASE, data);
  }

  async updateProject(id: string, data: Partial<Project>): Promise<Project> {
    return apiClient.patch<Project>(idPath(id), data);
  }

  async deleteProject(id: string): Promise<void> {
    await apiClient.delete<void>(idPath(id));
  }
}

export const projectService = new ProjectService();
