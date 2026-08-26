import { useQuery } from '@tanstack/react-query';
import { playlistService } from '../services/PlaylistService';
import { QueryParams } from '@/types/drf';
import { Playlist } from '@/types/playlists';

export const PLAYLIST_QUERY_KEYS = {
  all: ['playlists'] as const,
  lists: () => [...PLAYLIST_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...PLAYLIST_QUERY_KEYS.lists(), params] as const,
  details: () => [...PLAYLIST_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...PLAYLIST_QUERY_KEYS.details(), id] as const,
};

export function usePlaylists(params?: QueryParams) {
  return useQuery({
    queryKey: PLAYLIST_QUERY_KEYS.list(params),
    queryFn: async () => {
      const response = await playlistService.getPlaylists(params);
      if (Array.isArray(response)) {
        return { count: response.length, next: null, previous: null, results: response };
      }
      return response;
    },
  });
}

export function usePlaylist(id?: string) {
  return useQuery<Playlist>({
    queryKey: id ? PLAYLIST_QUERY_KEYS.detail(id) : ['playlists', 'null'],
    queryFn: () => {
      if (!id) throw new Error('Playlist ID required');
      return playlistService.getPlaylistById(id);
    },
    enabled: !!id,
  });
}
