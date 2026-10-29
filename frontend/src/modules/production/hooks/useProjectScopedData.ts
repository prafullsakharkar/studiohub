import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProjectScopedApiService } from '../api/projectScopedApi';
import { QueryParams } from '@/types/common';
import { useProductionContext } from '@/core/production/ProductionContext';

export const PROJECT_SCOPED_QUERY_KEYS = {
  root: (projectId: string, showId?: string) =>
    showId
      ? (['projects', projectId, 'shows', showId] as const)
      : (['projects', projectId] as const),
  summary: (projectId: string, showId?: string) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'summary'] as const,
  episodes: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'episodes', params] as const,
  sequences: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'sequences', params] as const,
  shots: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'shots', params] as const,
  tasks: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'tasks', params] as const,
  assets: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'assets', params] as const,
  versions: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'versions', params] as const,
  reviews: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'reviews', params] as const,
  editorial: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'editorial', params] as const,
  notes: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'notes', params] as const,
  deliveries: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'deliveries', params] as const,
  schedule: (projectId: string, showId?: string) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'schedule'] as const,
  resources: (projectId: string, showId?: string) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'resources'] as const,
  pipeline: (projectId: string, showId?: string) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'pipeline'] as const,
  files: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'files', params] as const,
  activity: (projectId: string, showId?: string, params?: QueryParams) =>
    [...PROJECT_SCOPED_QUERY_KEYS.root(projectId, showId), 'activity', params] as const,
};

function resolveContext(projectId?: string, showIdArg?: string) {
  const ctx = useProductionContext();
  return {
    projectId: projectId || ctx.projectId || '',
    showId: showIdArg || ctx.showId || '',
  };
}

export function useProjectSummary(projectId?: string, showIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.summary(effectiveProjectId, effectiveShowId),
    queryFn: () => ProjectScopedApiService.getSummary(effectiveProjectId),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectEpisodes(projectId?: string, params?: QueryParams, showIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.episodes(effectiveProjectId, effectiveShowId, params),
    queryFn: () => ProjectScopedApiService.getEpisodes(effectiveProjectId, params),
    enabled: Boolean(effectiveProjectId),
  });
}

export function useProjectSequences(projectId?: string, params?: QueryParams, showIdArg?: string, episodeIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  const effectiveEpisodeId = episodeIdArg ?? params?.episode_id;
  const queryParams = { ...params, ...(effectiveEpisodeId ? { episode_id: effectiveEpisodeId } : {}) };
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.sequences(effectiveProjectId, effectiveShowId, queryParams),
    queryFn: () => ProjectScopedApiService.getSequences(effectiveProjectId, queryParams),
    enabled: Boolean(effectiveProjectId && (effectiveShowId || effectiveEpisodeId)),
  });
}

export function useProjectShots(projectId?: string, params?: QueryParams, showIdArg?: string, episodeIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  const effectiveEpisodeId = episodeIdArg ?? params?.episode_id;
  const queryParams = { ...params, ...(effectiveEpisodeId ? { episode_id: effectiveEpisodeId } : {}) };
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.shots(effectiveProjectId, effectiveShowId, queryParams),
    queryFn: () => ProjectScopedApiService.getShots(effectiveProjectId, queryParams),
    enabled: Boolean(effectiveProjectId && (effectiveShowId || effectiveEpisodeId)),
  });
}

export function useProjectTasks(projectId?: string, params?: QueryParams, showIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.tasks(effectiveProjectId, effectiveShowId, params),
    queryFn: () => ProjectScopedApiService.getTasks(effectiveProjectId, { ...params, show_id: effectiveShowId }),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectAssets(projectId?: string, params?: QueryParams, showIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.assets(effectiveProjectId, effectiveShowId, params),
    queryFn: () => ProjectScopedApiService.getAssets(effectiveProjectId, { ...params, show_id: effectiveShowId }),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectVersions(projectId?: string, params?: QueryParams, showIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.versions(effectiveProjectId, effectiveShowId, params),
    queryFn: () => ProjectScopedApiService.getVersions(effectiveProjectId, { ...params, show_id: effectiveShowId }),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectReviews(projectId?: string, params?: QueryParams, showIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.reviews(effectiveProjectId, effectiveShowId, params),
    queryFn: () => ProjectScopedApiService.getReviews(effectiveProjectId, { ...params, show_id: effectiveShowId }),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectEditorial(projectId?: string, params?: QueryParams, showIdArg?: string) {
  const { projectId: effectiveProjectId, showId: effectiveShowId } = resolveContext(projectId, showIdArg);
  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.editorial(effectiveProjectId, effectiveShowId, params),
    queryFn: () => ProjectScopedApiService.getEditorial(effectiveProjectId, { ...params, show_id: effectiveShowId }),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectNotes(
  projectId?: string,
  showIdOrParams?: string | QueryParams,
  params?: QueryParams
) {
  const { projectId: contextProjectId, showId: contextShowId } = useProductionContext();
  const effectiveProjectId = projectId || contextProjectId || '';

  let effectiveShowId = contextShowId || undefined;
  let effectiveParams = params;

  if (typeof showIdOrParams === 'object' && showIdOrParams !== null) {
    effectiveParams = showIdOrParams;
  } else if (typeof showIdOrParams === 'string') {
    effectiveShowId = showIdOrParams;
  }

  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.notes(effectiveProjectId, effectiveShowId, effectiveParams),
    queryFn: () => ProjectScopedApiService.getNotes(effectiveProjectId, { ...effectiveParams, show_id: effectiveShowId }),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useCreateProjectNote(projectId: string, showId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Record<string, unknown>>) =>
      ProjectScopedApiService.createNote(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: PROJECT_SCOPED_QUERY_KEYS.notes(projectId, showId),
      });
      queryClient.invalidateQueries({
        queryKey: PROJECT_SCOPED_QUERY_KEYS.summary(projectId, showId),
      });
    },
  });
}

export function useProjectDeliveries(
  projectId?: string,
  showIdOrParams?: string | QueryParams,
  params?: QueryParams
) {
  const { projectId: contextProjectId, showId: contextShowId } = useProductionContext();
  const effectiveProjectId = projectId || contextProjectId || '';

  let effectiveShowId = contextShowId || undefined;
  let effectiveParams = params;

  if (typeof showIdOrParams === 'object' && showIdOrParams !== null) {
    effectiveParams = showIdOrParams;
  } else if (typeof showIdOrParams === 'string') {
    effectiveShowId = showIdOrParams;
  }

  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.deliveries(effectiveProjectId, effectiveShowId, effectiveParams),
    queryFn: () => ProjectScopedApiService.getDeliveries(effectiveProjectId, { ...effectiveParams, show_id: effectiveShowId }),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectSchedule(projectId?: string, showId?: string) {
  const { projectId: contextProjectId, showId: contextShowId } = useProductionContext();
  const effectiveProjectId = projectId || contextProjectId || '';
  const effectiveShowId = showId || contextShowId || undefined;

  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.schedule(effectiveProjectId, effectiveShowId),
    queryFn: () => ProjectScopedApiService.getSchedule(effectiveProjectId),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectResources(projectId?: string, showId?: string) {
  const { projectId: contextProjectId, showId: contextShowId } = useProductionContext();
  const effectiveProjectId = projectId || contextProjectId || '';
  const effectiveShowId = showId || contextShowId || undefined;

  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.resources(effectiveProjectId, effectiveShowId),
    queryFn: () => ProjectScopedApiService.getResources(effectiveProjectId),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectPipeline(projectId?: string, showId?: string) {
  const { projectId: contextProjectId, showId: contextShowId } = useProductionContext();
  const effectiveProjectId = projectId || contextProjectId || '';
  const effectiveShowId = showId || contextShowId || undefined;

  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.pipeline(effectiveProjectId, effectiveShowId),
    queryFn: () => ProjectScopedApiService.getPipeline(effectiveProjectId),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectFiles(
  projectId?: string,
  showIdOrParams?: string | QueryParams,
  params?: QueryParams
) {
  const { projectId: contextProjectId, showId: contextShowId } = useProductionContext();
  const effectiveProjectId = projectId || contextProjectId || '';

  let effectiveShowId = contextShowId || undefined;
  let effectiveParams = params;

  if (typeof showIdOrParams === 'object' && showIdOrParams !== null) {
    effectiveParams = showIdOrParams;
  } else if (typeof showIdOrParams === 'string') {
    effectiveShowId = showIdOrParams;
  }

  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.files(effectiveProjectId, effectiveShowId, effectiveParams),
    queryFn: () => ProjectScopedApiService.getFiles(effectiveProjectId, effectiveParams),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}

export function useProjectActivity(
  projectId?: string,
  showIdOrParams?: string | QueryParams,
  params?: QueryParams
) {
  const { projectId: contextProjectId, showId: contextShowId } = useProductionContext();
  const effectiveProjectId = projectId || contextProjectId || '';

  let effectiveShowId = contextShowId || undefined;
  let effectiveParams = params;

  if (typeof showIdOrParams === 'object' && showIdOrParams !== null) {
    effectiveParams = showIdOrParams;
  } else if (typeof showIdOrParams === 'string') {
    effectiveShowId = showIdOrParams;
  }

  return useQuery({
    queryKey: PROJECT_SCOPED_QUERY_KEYS.activity(effectiveProjectId, effectiveShowId, effectiveParams),
    queryFn: () => ProjectScopedApiService.getActivity(effectiveProjectId),
    enabled: Boolean(effectiveProjectId && effectiveShowId),
  });
}
