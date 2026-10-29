import { useQuery } from '@tanstack/react-query';
import { productionApi } from '@/modules/production/api/productionApi';

/**
 * Published-version feed for the project workspace tab. Flat endpoint
 * (`/api/v1/versions/`) — no org dimension.
 */
export const usePublishedVersions = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['versions', 'published', params],
    queryFn: () => productionApi.getVersions(params),
    staleTime: 1000 * 20,
  });
};
