import { useMutation, useQueryClient } from '@tanstack/react-query';
import { playlistService } from '../services/PlaylistService';
import { Playlist, PlaylistEntry, PlaylistShareSettings } from '@/types/playlists';
import { PLAYLIST_QUERY_KEYS } from './usePlaylists';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';

export function usePlaylistMutations() {
  const queryClient = useQueryClient();
  const addNotification = useNotificationStore((state) => state.addNotification);

  const invalidateAll = (playlistId?: string) => {
    queryClient.invalidateQueries({ queryKey: PLAYLIST_QUERY_KEYS.all });
    if (playlistId) {
      queryClient.invalidateQueries({ queryKey: PLAYLIST_QUERY_KEYS.detail(playlistId) });
    }
  };

  const createPlaylistMutation = useMutation({
    mutationFn: (data: Partial<Playlist>) => playlistService.createPlaylist(data),
    onSuccess: (newPlaylist) => {
      invalidateAll(newPlaylist.id);
      addNotification({
        type: 'success',
        title: 'Playlist Created',
        message: `Created reel "${newPlaylist.name}" (${newPlaylist.code}).`,
      });
    },
  });

  const updatePlaylistMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Playlist> }) => playlistService.updatePlaylist(id, data),
    onSuccess: (updated) => {
      invalidateAll(updated.id);
      addNotification({
        type: 'info',
        title: 'Playlist Updated',
        message: `Saved changes to "${updated.name}".`,
      });
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: (id: string) => playlistService.deletePlaylist(id),
    onSuccess: () => {
      invalidateAll();
      addNotification({
        type: 'info',
        title: 'Playlist Deleted',
        message: 'Reel was removed from the project library.',
      });
    },
  });

  const addEntryMutation = useMutation({
    mutationFn: ({ playlistId, entry }: { playlistId: string; entry: Partial<PlaylistEntry> }) =>
      playlistService.addEntry(playlistId, entry),
    onSuccess: (updated) => {
      invalidateAll(updated.id);
      addNotification({
        type: 'success',
        title: 'Version Added',
        message: `Added version to playlist "${updated.name}".`,
      });
    },
  });

  const removeEntryMutation = useMutation({
    mutationFn: ({ playlistId, entryId }: { playlistId: string; entryId: string }) =>
      playlistService.removeEntry(playlistId, entryId),
    onSuccess: (updated) => {
      invalidateAll(updated.id);
      addNotification({
        type: 'info',
        title: 'Version Removed',
        message: `Updated playlist "${updated.name}".`,
      });
    },
  });

  const reorderEntriesMutation = useMutation({
    mutationFn: ({ playlistId, entries }: { playlistId: string; entries: PlaylistEntry[] }) =>
      playlistService.reorderEntries(playlistId, entries),
    onSuccess: (updated) => {
      invalidateAll(updated.id);
      addNotification({
        type: 'info',
        title: 'Playlist Reordered',
        message: `Sequence updated for "${updated.name}".`,
      });
    },
  });

  const sharePlaylistMutation = useMutation({
    mutationFn: ({ playlistId, settings }: { playlistId: string; settings: PlaylistShareSettings }) =>
      playlistService.sharePlaylist(playlistId, settings),
    onSuccess: (updated) => {
      invalidateAll(updated.id);
      addNotification({
        type: 'success',
        title: 'Playlist Shared',
        message: `Secure link generated for "${updated.name}".`,
      });
    },
  });

  const archivePlaylistMutation = useMutation({
    mutationFn: (playlistId: string) => playlistService.archivePlaylist(playlistId),
    onSuccess: (updated) => {
      invalidateAll(updated.id);
      addNotification({
        type: 'warning',
        title: 'Playlist Archived',
        message: `"${updated.name}" has been moved to archive.`,
      });
    },
  });

  const restorePlaylistMutation = useMutation({
    mutationFn: (playlistId: string) => playlistService.restorePlaylist(playlistId),
    onSuccess: (updated) => {
      invalidateAll(updated.id);
      addNotification({
        type: 'success',
        title: 'Playlist Restored',
        message: `"${updated.name}" is now active in screening queue.`,
      });
    },
  });

  return {
    createPlaylist: createPlaylistMutation.mutateAsync,
    updatePlaylist: updatePlaylistMutation.mutateAsync,
    deletePlaylist: deletePlaylistMutation.mutateAsync,
    addEntry: addEntryMutation.mutateAsync,
    removeEntry: removeEntryMutation.mutateAsync,
    reorderEntries: reorderEntriesMutation.mutateAsync,
    sharePlaylist: sharePlaylistMutation.mutateAsync,
    archivePlaylist: archivePlaylistMutation.mutateAsync,
    restorePlaylist: restorePlaylistMutation.mutateAsync,
    isCreating: createPlaylistMutation.isPending,
    isUpdating: updatePlaylistMutation.isPending,
    isDeleting: deletePlaylistMutation.isPending,
    isAddingEntry: addEntryMutation.isPending,
    isRemovingEntry: removeEntryMutation.isPending,
    isReordering: reorderEntriesMutation.isPending,
    isSharing: sharePlaylistMutation.isPending,
    isArchiving: archivePlaylistMutation.isPending,
    isRestoring: restorePlaylistMutation.isPending,
  };
}
