import type React from 'react';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { usePlaylistsListConfig } from '@/modules/production/review/playlists';
import type { Project } from '@/types/production';

interface ProjectPlaylistsTabProps {
  project: Project;
  onNavigateTab?: (tabId: string) => void;
}

/** The project's playlists. */
export const ProjectPlaylistsTab: React.FC<ProjectPlaylistsTabProps> = ({ project }) => <DirectoryListPage config={usePlaylistsListConfig({ projectId: project.id })} />;
