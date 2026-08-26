import { useMutation, useQueryClient } from '@tanstack/react-query';
import { versionService } from '../services/VersionService';
import { VERSION_KEYS } from './useVersions';
import { ProductionVersion } from '@/types/versions';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export const useVersionMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createMutation = useMutation({
    mutationFn: (data: Partial<ProductionVersion>) => versionService.createVersion(data),
    onSuccess: (newVersion) => {
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.lists() });
      addNotification({
        type: 'success',
        title: 'Version Created',
        message: `Version ${newVersion.version_number} (${newVersion.code}) created successfully.`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Failed to Create Version',
        message: err.message || 'An unexpected error occurred while creating version.',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductionVersion> }) =>
      versionService.updateVersion(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.detail(updated.id) });
      addNotification({
        type: 'success',
        title: 'Version Updated',
        message: `Version ${updated.version_number} updated successfully.`,
      });
    },
    onError: (err: any) => {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'Failed to update version.',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: { dcc_software?: string; publisher_name?: string; comment?: string } }) =>
      versionService.publishVersion(id, payload),
    onSuccess: (published) => {
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.detail(published.id) });
      addNotification({
        type: 'success',
        title: 'Version Published',
        message: `Version ${published.version_number} published to production OpenUSD pipeline.`,
      });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload?: { user_name?: string } }) =>
      versionService.unpublishVersion(id, payload),
    onSuccess: (unpublished) => {
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.detail(unpublished.id) });
      addNotification({
        type: 'info',
        title: 'Version Unpublished',
        message: `Version ${unpublished.version_number} removed from active publishing payload.`,
      });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => versionService.archiveVersion(id),
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.detail(version.id) });
      addNotification({
        type: 'info',
        title: version.is_archived ? 'Version Archived' : 'Version Restored',
        message: `Version ${version.version_number} has been ${version.is_archived ? 'archived' : 'restored'}.`,
      });
    },
  });

  const addToPlaylistMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { playlist_id: string; playlist_name?: string; playlist_type?: string } }) =>
      versionService.addToPlaylist(id, payload),
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.detail(version.id) });
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      addNotification({
        type: 'success',
        title: 'Added to Playlist',
        message: `Version ${version.version_number} added to review reel successfully.`,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => versionService.deleteVersion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VERSION_KEYS.lists() });
      addNotification({
        type: 'success',
        title: 'Version Deleted',
        message: 'The version record and references were removed from the catalog.',
      });
    },
  });

  return {
    createVersion: createMutation.mutateAsync,
    updateVersion: updateMutation.mutateAsync,
    publishVersion: publishMutation.mutateAsync,
    unpublishVersion: unpublishMutation.mutateAsync,
    archiveVersion: archiveMutation.mutateAsync,
    addToPlaylist: addToPlaylistMutation.mutateAsync,
    deleteVersion: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isPublishing: publishMutation.isPending,
    isUnpublishing: unpublishMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isAddingToPlaylist: addToPlaylistMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
};
