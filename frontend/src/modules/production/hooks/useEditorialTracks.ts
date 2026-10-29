import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { editorialTrackService } from '../services/EditorialTrackService';
import { QueryParams } from '@/types/common';
import { EditorialTrack } from '@/types/production';

export const EDITORIAL_TRACKS_QUERY_KEYS = {
  all: ['editorial-tracks'] as const,
  lists: () => [...EDITORIAL_TRACKS_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...EDITORIAL_TRACKS_QUERY_KEYS.lists(), params] as const,
  detail: (id: string) => [...EDITORIAL_TRACKS_QUERY_KEYS.all, 'detail', id] as const,
};

export function useEditorialTracks(params?: QueryParams) {
  return useQuery({
    queryKey: EDITORIAL_TRACKS_QUERY_KEYS.list(params),
    queryFn: () => editorialTrackService.getTracks(params),
  });
}

export function useEditorialTrackDetail(id: string) {
  return useQuery({
    queryKey: EDITORIAL_TRACKS_QUERY_KEYS.detail(id),
    queryFn: () => editorialTrackService.getTrackById(id),
    enabled: !!id,
  });
}

export function useCreateEditorialTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<EditorialTrack>) => editorialTrackService.createTrack(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EDITORIAL_TRACKS_QUERY_KEYS.all });
    },
  });
}

export function useUpdateEditorialTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EditorialTrack> }) =>
      editorialTrackService.updateTrack(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EDITORIAL_TRACKS_QUERY_KEYS.all });
    },
  });
}

export function useDeleteEditorialTrack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => editorialTrackService.deleteTrack(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EDITORIAL_TRACKS_QUERY_KEYS.all });
    },
  });
}
