import { useQuery } from '@tanstack/react-query';
import { auditService } from '../services/AuditService';
import { QueryParams } from '@/types/drf';

export const AUDIT_QUERY_KEYS = {
  all: ['audit'] as const,
  lists: () => [...AUDIT_QUERY_KEYS.all, 'list'] as const,
  list: (params?: QueryParams) => [...AUDIT_QUERY_KEYS.lists(), params] as const,
};

export function useAuditLogs(params?: QueryParams) {
  return useQuery({
    queryKey: AUDIT_QUERY_KEYS.list(params),
    queryFn: () => auditService.getAuditLogs(params),
  });
}
