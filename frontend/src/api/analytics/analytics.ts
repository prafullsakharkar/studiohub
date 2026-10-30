import { apiClient } from '@/api/client/ApiClient';

/**
 * Studio-wide aggregates, narrowed by the server to the caller's own projects (a platform administrator sees every
 * project). Both routes need a signed-in user and nothing more; a user in no project gets zeros and an empty list.
 * Pinned to docs/sync/samples/dashboards/_flow.json (see backend-change-requests.md, "Phase 12 findings").
 *
 * Fields with no data source are `null`, not zero: render-farm telemetry and render times. Storage is `0` / `0` until
 * a telemetry source exists, which is "unknown", not "empty": the screens do not draw a storage meter from it.
 */
export interface ProductionKpis {
  total_active_projects: number;
  total_shots: number;
  approved_shots: number;
  pending_review_shots: number;
  in_progress_shots: number;
  approval_rate_percentage: number;
  active_artists: number;
  storage_usage_tb: number;
  storage_quota_tb: number;
  render_nodes_busy: number | null;
  render_nodes_total: number | null;
  average_render_time_mins: number | null;
}

/** One row per department that has tasks (tasks with no department are left out). */
export interface DepartmentAnalytics {
  department: string;
  total_tasks: number;
  completed_tasks: number;
  /** Whole percent of the department's tasks that are Approved. */
  percentage: number;
}

export const analyticsApi = {
  keys: { all: ['analytics'] as const, kpis: ['analytics', 'kpis'] as const, departments: ['analytics', 'departments'] as const },
  kpis: (signal?: AbortSignal) => apiClient.get<ProductionKpis>('/api/v1/analytics/kpis/', { signal }),
  /** A bare array. */
  departments: (signal?: AbortSignal) => apiClient.get<DepartmentAnalytics[]>('/api/v1/analytics/departments/', { signal }),
};
