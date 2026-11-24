import type React from 'react';
import { useActiveProjectScope } from '@/core/production/useActiveProjectScope';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { playlistsFormConfig, usePlaylistsListConfig } from '@/modules/production/review/playlists';

/** Playlists of the project chosen in the project switcher; with none chosen, of every project. */
export const PlaylistsPage: React.FC = () => <DirectoryListPage config={usePlaylistsListConfig(useActiveProjectScope())} />;

export const PlaylistFormPage: React.FC = () => <DirectoryFormPage config={playlistsFormConfig} />;
