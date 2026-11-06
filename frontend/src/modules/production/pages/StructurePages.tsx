import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { useActiveProjectIsEpisodic } from '../hooks/useProjectIsEpisodic';
import { episodesFormConfig, sequencesFormConfig, useEpisodesListConfig, useSequencesListConfig } from '../structure/lists';

/**
 * The Episodes pages exist for an episodic project only (CR-47): with a standard project chosen in the project switcher a
 * direct link answers not-found, as the navigation offers no Episodes item. Switching projects re-renders this from the
 * project query, so nothing stale is kept.
 */
export const EpisodicGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isEpisodic, isLoading } = useActiveProjectIsEpisodic();
  if (isLoading) return <LoadingSpinner />;
  return isEpisodic ? <>{children}</> : <NotFoundPage />;
};

const EpisodesList: React.FC = () => {
  const { projectId } = useActiveProjectIsEpisodic();
  return <DirectoryListPage config={useEpisodesListConfig(projectId ? { projectId } : undefined)} />;
};

export const EpisodesPage: React.FC = () => (
  <EpisodicGate>
    <EpisodesList />
  </EpisodicGate>
);

export const EpisodeFormPage: React.FC = () => (
  <EpisodicGate>
    <DirectoryFormPage config={episodesFormConfig} />
  </EpisodicGate>
);

/** Sequences across the caller's projects (every project has them). */
export const SequencesPage: React.FC = () => <DirectoryListPage config={useSequencesListConfig()} />;

export const SequenceFormPage: React.FC = () => <DirectoryFormPage config={sequencesFormConfig} />;
