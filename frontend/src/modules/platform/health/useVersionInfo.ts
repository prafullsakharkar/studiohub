import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client/ApiClient';

export interface VersionInfo {
  version: string;
  environment: string;
  commit?: string;
}

/** Live backend version + environment for any header/status surface. */
export const useVersionInfo = () =>
  useQuery({
    queryKey: ['platform', 'version'],
    queryFn: () => apiClient.get<VersionInfo>('/api/v1/info/version/'),
    staleTime: 5 * 60 * 1000,
  });
