import { apiClient } from '@/api/client/ApiClient';
import { ProjectDashboardData } from '../types';
import { ProjectDashboardDataSchema } from '../schemas/dashboardSchema';
import { logger } from '@/core/logging/logger';

/**
 * Fetches consolidated project-scoped dashboard telemetry.
 * Strictly scopes data to the specified projectId. No org dimension: the
 * `X-Organization-Id` header and the org-scoped fallback route are gone.
 */
export async function getDashboardData(
  projectId: string,
  // React Query's signal: an unmount or a project switch aborts the request.
  signal?: AbortSignal
): Promise<ProjectDashboardData> {
  if (!projectId) {
    throw new Error('Project ID is required to fetch dashboard telemetry');
  }

  // Primary endpoint format conforming to DRF conventions
  const primaryEndpoint = `/api/v1/projects/${projectId}/dashboard/`;

  const rawData = await apiClient.get<ProjectDashboardData>(primaryEndpoint, { signal });

  // Optional Zod validation; safe parse with fallback
  const parsed = ProjectDashboardDataSchema.safeParse(rawData);
  if (!parsed.success) {
    logger.warn(
      'ProjectDashboardAPI',
      'Payload schema validation warnings for project ' + projectId,
      parsed.error.format()
    );
    // Return rawData if parsed has issues to maintain resilience
    return rawData;
  }

  return parsed.data as ProjectDashboardData;
}
