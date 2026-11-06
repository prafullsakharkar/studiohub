import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { episodesApi, projectsApi } from '@/api/production/structure';
import type { Episode } from '@/api/production/structure';
import type { ListColumn, ListFilter } from '@/modules/directory/types';
import { fetchAllRows } from '@/shared/data/listing';
import { useProjectIsEpisodic } from '../hooks/useProjectIsEpisodic';
import { isEpisodicProject } from '../projectWorkflow';

/**
 * Episode UI for lists and forms (CR-47). Episodes exist only on episodic projects, so each piece here shows itself only for one:
 * a standard project shows no episode column, filter or picker anywhere.
 */

/** Renders `children` only while `projectId` is an episodic project (a form's episode picker). */
export const EpisodicOnly: React.FC<{ projectId?: string | null; children: React.ReactNode }> = ({ projectId, children }) => {
  const { isEpisodic } = useProjectIsEpisodic(projectId);
  return isEpisodic ? <>{children}</> : null;
};

/** The same query the list page's Project filter runs, so the two share one request. */
export const projectOptionsQuery = () => ({
  queryKey: [...projectsApi.keys.all, 'filter-options'] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAllRows(projectsApi.list, {}, { signal }),
  staleTime: 60_000,
});

/** Ids of the caller's episodic projects, for column and filter visibility. */
export function useEpisodicProjectIds(): ReadonlySet<string> {
  const projects = useQuery(projectOptionsQuery());
  return new Set((projects.data ?? []).filter((p) => isEpisodicProject(p)).map((p) => p.id));
}

/** The episodes of one project (shared with the shot bulk manager's query). */
export const projectEpisodesQuery = (projectId: string) => ({
  queryKey: [...episodesApi.keys.lists(), 'all', projectId] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) => fetchAllRows(episodesApi.list, { project: projectId }, { signal }),
  enabled: Boolean(projectId),
  staleTime: 60_000,
});

/** An episode id shown as its code, read from the project's episode list. */
export const EpisodeCode: React.FC<{ projectId: string; episodeId: string | null }> = ({ projectId, episodeId }) => {
  const episodes = useQuery(projectEpisodesQuery(projectId));
  if (!episodeId) return <>—</>;
  const episode = (episodes.data ?? []).find((e: Episode) => e.id === episodeId);
  return <span className="font-mono">{episode?.code ?? '…'}</span>;
};

/** Whether the list is narrowed (by its filter or its scope) to one episodic project. */
const forEpisodicProject = (episodic: ReadonlySet<string>) => (filters: Record<string, unknown>) => episodic.has(String(filters.project_id ?? ''));

export function episodeColumn<T extends { project_id: string; episode_id: string | null }>(episodic: ReadonlySet<string>): ListColumn<T> {
  return { header: 'Episode', cell: (row) => <EpisodeCode projectId={row.project_id} episodeId={row.episode_id} />, visible: forEpisodicProject(episodic) };
}

/** `episode_id` filter (shots and sequences take an id or code), offered once the list is on an episodic project. */
export function episodeFilter(episodic: ReadonlySet<string>): ListFilter {
  return {
    key: 'episode_id',
    label: 'Episode',
    visible: forEpisodicProject(episodic),
    optionsFrom: {
      queryKey: [...episodesApi.keys.lists(), 'by-project'],
      fetchPage: episodesApi.list as never,
      getLabel: ((e: Episode) => `${e.code}${e.name ? ` · ${e.name}` : ''}`) as never,
      params: (filters) => ({ project: String(filters.project_id ?? '') }),
    },
  };
}
