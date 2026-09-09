import { useQuery } from '@tanstack/react-query';
import { OrganizationRepository } from '../repositories/OrganizationRepository';
import { OrganizationService } from '../services/OrganizationService';

const repo = new OrganizationRepository();
const service = new OrganizationService(repo);

export const useOrganizations = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['organizations', params],
    queryFn: () => service.listOrganizations(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useOrganizationsPaginated = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ['organizations', 'paginated', params],
    queryFn: () => service.listOrganizationsPaginated(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useOrganizationDetail = (id?: string) => {
  return useQuery({
    queryKey: ['organization', id],
    queryFn: () => (id ? service.getOrganization(id) : Promise.reject('No ID')),
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 2,
  });
};
