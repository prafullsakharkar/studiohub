import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/DashboardService';

export const DASHBOARD_QUERY_KEYS = {
  kpis: ['dashboard', 'kpis'] as const,
  departments: ['dashboard', 'departments'] as const,
  organization: ['dashboard', 'organization'] as const,
};

export function useProductionKpis() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.kpis,
    queryFn: () => dashboardService.getKpis(),
    refetchInterval: 30000, // Background refetch every 30s
  });
}

export function useDepartmentProgress() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.departments,
    queryFn: () => dashboardService.getDepartmentProgress(),
  });
}

export function useOrganizationInfo() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEYS.organization,
    queryFn: () => dashboardService.getOrganization(),
  });
}
