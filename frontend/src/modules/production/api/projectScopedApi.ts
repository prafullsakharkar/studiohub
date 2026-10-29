import { apiClient } from '@/api/client/ApiClient';
import { Project, ProjectMember } from '@/types/production';
import { Episode } from '@/types/production';
import { Sequence } from '@/types/production';
import { Shot } from '@/types/production';
import { Task } from '@/types/production';
import { Asset } from '@/types/production';
import { Version } from '@/types/production';
import { ReviewSession } from '@/types/production';
import { DeliveryPackage } from '@/types/production';
import { PaginatedResponse, QueryParams } from '@/types/common';

export interface ProjectSummaryResponse {
  project: Project;
  counts: {
    episodes?: number;
    sequences: number;
    shots: number;
    tasks: number;
    assets: number;
    versions: number;
    reviews: number;
    deliveries: number;
    notes: number;
    editorial: number;
    approved_shots: number;
    in_progress_shots: number;
    completed_tasks: number;
  };
  project_id: string;
}

export interface ProjectScheduleResponse {
  project_id: string;
  start_date: string;
  delivery_date: string;
  milestones: any[];
}

export interface ProjectResourcesResponse {
  project_id: string;
  total_artists: number;
  artists: Array<{
    id: string;
    name: string;
    avatar?: string;
    role: string;
    task_count: number;
    hours_logged: number;
  }>;
  departments: string[];
}

export interface ProjectPipelineResponse {
  project_id: string;
  color_space: string;
  resolution: string;
  fps: number;
  aspect_ratio: string;
  pipeline_steps: any[];
  dcc_integrations: any[];
  usd_schema_version: string;
  ocio_config: string;
}

/**
 * Project-scoped production reads. The backend serves these under
 * `/api/organizations/projects/<project>/...` — the `organizations/` prefix
 * is vestigial (the org app is gone) and there is no org URL segment or
 * org scoping.
 */
export class ProjectScopedApiService {
  private static base(projectId: string) {
    return `/api/organizations/projects/${projectId}`;
  }

  public static getSummary(projectId: string) {
    return apiClient.get<ProjectSummaryResponse>(`${ProjectScopedApiService.base(projectId)}/summary`);
  }

  public static getEpisodes(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Episode>>('/api/v1/episodes/', {
      params: {
        ...params,
        project_id: projectId,
      },
    });
  }

  public static getSequences(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Sequence>>(
      `${ProjectScopedApiService.base(projectId)}/sequences`,
      { params }
    );
  }

  public static getShots(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Shot>>(
      `${ProjectScopedApiService.base(projectId)}/shots`,
      { params }
    );
  }

  public static getTasks(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Task>>(
      `${ProjectScopedApiService.base(projectId)}/tasks`,
      { params }
    );
  }

  public static getAssets(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Asset>>(
      `${ProjectScopedApiService.base(projectId)}/assets`,
      { params }
    );
  }

  public static getVersions(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<Version>>(
      `${ProjectScopedApiService.base(projectId)}/versions`,
      { params }
    );
  }

  public static getReviews(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<ReviewSession>>(
      `${ProjectScopedApiService.base(projectId)}/reviews`,
      { params }
    );
  }

  public static getEditorial(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<any>>(
      `${ProjectScopedApiService.base(projectId)}/editorial`,
      { params }
    );
  }

  public static getNotes(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<any>>(
      `${ProjectScopedApiService.base(projectId)}/notes`,
      { params }
    );
  }

  public static createNote(projectId: string, data: Partial<any>) {
    return apiClient.post<any>(
      `${ProjectScopedApiService.base(projectId)}/notes`,
      data
    );
  }

  public static getDeliveries(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<DeliveryPackage>>(
      `${ProjectScopedApiService.base(projectId)}/deliveries`,
      { params }
    );
  }

  public static getSchedule(projectId: string) {
    return apiClient.get<ProjectScheduleResponse>(
      `${ProjectScopedApiService.base(projectId)}/schedule`
    );
  }

  public static getResources(projectId: string) {
    return apiClient.get<ProjectResourcesResponse>(
      `${ProjectScopedApiService.base(projectId)}/resources`
    );
  }

  public static getPipeline(projectId: string) {
    return apiClient.get<ProjectPipelineResponse>(
      `${ProjectScopedApiService.base(projectId)}/pipeline`
    );
  }

  public static getFiles(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<any>>(
      `${ProjectScopedApiService.base(projectId)}/files`,
      { params }
    );
  }

  public static getActivity(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<any>>(
      `${ProjectScopedApiService.base(projectId)}/activity`,
      { params }
    );
  }

  public static getMembers(projectId: string, params?: QueryParams) {
    return apiClient.get<PaginatedResponse<ProjectMember>>(
      `${ProjectScopedApiService.base(projectId)}/members/`,
      { params }
    );
  }

  public static addMember(projectId: string, data: Partial<ProjectMember>) {
    return apiClient.post<ProjectMember>(
      `${ProjectScopedApiService.base(projectId)}/members/`,
      data
    );
  }
}
