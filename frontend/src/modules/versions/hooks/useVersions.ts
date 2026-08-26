import { useQuery } from '@tanstack/react-query';
import { versionService } from '../services/VersionService';
import { QueryParams } from '@/types/drf';

export const VERSION_KEYS = {
  all: ['versions'] as const,
  lists: () => [...VERSION_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...VERSION_KEYS.lists(), params] as const,
  details: () => [...VERSION_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...VERSION_KEYS.details(), id] as const,
};

export const useVersions = (params?: QueryParams) => {
  return useQuery({
    queryKey: VERSION_KEYS.list(params),
    queryFn: () => versionService.getVersions(params),
    staleTime: 1000 * 60 * 5,
  });
};

export const useVersion = (id: string) => {
  return useQuery({
    queryKey: VERSION_KEYS.detail(id),
    queryFn: () => versionService.getVersionById(id),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });
};
