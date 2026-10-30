import type React from 'react';
import { DirectoryFormPage } from '@/modules/directory/DirectoryFormPage';
import { DirectoryListPage } from '@/modules/directory/DirectoryListPage';
import { playlistsFormConfig, usePlaylistsListConfig } from '@/modules/production/review/playlists';

/** Playlists across the caller's projects. */
export const PlaylistsPage: React.FC = () => <DirectoryListPage config={usePlaylistsListConfig()} />;

export const PlaylistFormPage: React.FC = () => <DirectoryFormPage config={playlistsFormConfig} />;
