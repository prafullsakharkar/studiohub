import { useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { useState } from 'react';
import { episodesApi, projectsApi, sequencesApi } from '@/api/production/structure';
import { Button } from '@/shared/components/Button';
import { fetchAllRows } from '@/shared/data/listing';
import { ShotBulkManager } from './bulk/ShotBulkManager';

/**
 * "Bulk add shots" for one project. On an episodic project the grid needs the project's real episodes and
 * sequences, and a way to create a missing one on the spot (a sequence on an episodic project needs an
 * episode); on a standard project it gets none of that. The sequence list is withheld until it has loaded,
 * so the manager never prompts about a sequence it merely has not heard of yet.
 */
export const ShotBulkAdd: React.FC<{ projectId: string | undefined; onDone?: () => void }> = ({ projectId, onDone }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const project = useQuery({ queryKey: projectsApi.keys.detail(projectId ?? ''), queryFn: ({ signal }) => projectsApi.get(projectId as string, signal), enabled: Boolean(projectId) });
  const isEpisodic = project.data?.workflow_type === 'episodic';
  const episodes = useQuery({ queryKey: [...episodesApi.keys.lists(), 'all', projectId], queryFn: ({ signal }) => fetchAllRows(episodesApi.list, { project: projectId as string }, { signal }), enabled: Boolean(projectId) && isEpisodic });
  const sequences = useQuery({ queryKey: [...sequencesApi.keys.lists(), 'all', projectId], queryFn: ({ signal }) => fetchAllRows(sequencesApi.list, { project: projectId as string }, { signal }), enabled: Boolean(projectId) && isEpisodic });
  if (!projectId) return null;

  const onCreateEpisode = async (input: { project_id: string; code: string; name: string }) => {
    const created = await episodesApi.create({ project: input.project_id, code: input.code, name: input.name, season_number: 1, episode_number: (episodes.data?.length ?? 0) + 1 } as never);
    await queryClient.invalidateQueries({ queryKey: episodesApi.keys.all });
    return { id: created.id, code: created.code, name: created.name };
  };
  const onCreateSequence = async (input: { project_id: string; episode_id: string; code: string }) => {
    const created = await sequencesApi.create({ project: input.project_id, episode_id: input.episode_id, code: input.code.toUpperCase() });
    await queryClient.invalidateQueries({ queryKey: sequencesApi.keys.all });
    return { id: created.id, code: created.code, episode_id: created.episode_id ?? input.episode_id };
  };

  return (
    <>
      <Button size="sm" variant="outline" disabled={!project.data} onClick={() => setOpen(true)}>
        Bulk add shots
      </Button>
      {open && project.data && (
        <ShotBulkManager
          projectId={projectId}
          projectCode={project.data.code}
          defaultSequenceCode={`${project.data.code}_010`}
          isOpen
          {...(isEpisodic
            ? {
                isEpisodic: true,
                episodes: (episodes.data ?? []).map((ep) => ({ id: ep.id, code: ep.code, name: ep.name })),
                sequences: sequences.data ? sequences.data.map((seq) => ({ id: seq.id, code: seq.code, episode_id: seq.episode_id ?? undefined })) : undefined,
                onCreateEpisode,
                onCreateSequence,
              }
            : {})}
          onClose={() => {
            setOpen(false);
            onDone?.();
          }}
          onSuccess={onDone}
        />
      )}
    </>
  );
};
