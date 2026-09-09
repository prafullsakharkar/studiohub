import { useQuery } from '@tanstack/react-query';
import { mediaService, MediaQueryParams } from '../services/MediaService';

export const MEDIA_KEYS = {
  all: ['media'] as const,
  lists: () => [...MEDIA_KEYS.all, 'list'] as const,
  list: (params?: MediaQueryParams) => [...MEDIA_KEYS.lists(), params] as const,
  details: () => [...MEDIA_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...MEDIA_KEYS.details(), id] as const,
};

export const useMedia = (params?: MediaQueryParams) => {
  return useQuery({
    queryKey: MEDIA_KEYS.list(params),
    queryFn: () => mediaService.getMediaList(params),
    staleTime: 1000 * 60 * 5,
  });
};

export const useMediaItem = (id: string) => {
  return useQuery({
    queryKey: MEDIA_KEYS.detail(id),
    queryFn: () => mediaService.getMediaById(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
};
