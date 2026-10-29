import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { masterDataApi } from '@/api/masterDataApi';
import { trackEntityMutation } from '@/shared/hooks/trackEntityMutation';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import { makeBulkDeleteMutation } from '@/shared/hooks/useBulkDelete';
import {
  DepartmentEntity,
} from '@/types/masterData';

export const DEPARTMENTS_QUERY_KEYS = {
  all: ['departments'] as const,
  list: (params?: Record<string, any>) => [...DEPARTMENTS_QUERY_KEYS.all, 'list', params] as const,
  detail: (id: string) => [...DEPARTMENTS_QUERY_KEYS.all, 'detail', id] as const,
};

export const useDepartments = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: DEPARTMENTS_QUERY_KEYS.list(params),
    queryFn: () => masterDataApi.getDepartments(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useDepartment = (id: string) => {
  return useQuery({
    queryKey: DEPARTMENTS_QUERY_KEYS.detail(id),
    queryFn: () => masterDataApi.getDepartmentDetail(id),
    enabled: !!id,
  });
};

export const useDepartmentMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createDepartment = useMutation({
    mutationFn: (data: Partial<DepartmentEntity>) =>
      masterDataApi.createDepartment({ department_type: 'creative', ...data }),
    onSuccess: (dept) => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEYS.all });
      addNotification({
        type: 'success',
        title: 'Department Created',
        message: `${dept.name} [${dept.code}] initialized in pipeline.`,
      });
      trackEntityMutation(queryClient, {
        action: 'created',
        actionLabel: 'Department Created',
        resourceType: 'department',
        resourceId: dept.id,
        resourceName: dept.name,
        resourceCode: dept.code,
        description: `Created department ${dept.name} [${dept.code}].`,
        tags: ['Department', 'Creation'],
        auditAction: 'CREATE',
        auditEntityType: 'Department',
      });
    },
  });

  const updateDepartment = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DepartmentEntity> }) =>
      masterDataApi.updateDepartment(id, data),
    onSuccess: (dept) => {
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEYS.all });
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEYS.detail(dept.id) });
      addNotification({
        type: 'success',
        title: 'Department Updated',
        message: `${dept.name} settings saved.`,
      });
      trackEntityMutation(queryClient, {
        action: 'updated',
        actionLabel: 'Department Updated',
        resourceType: 'department',
        resourceId: dept.id,
        resourceName: dept.name,
        resourceCode: dept.code,
        description: `Updated department ${dept.name} [${dept.code}].`,
        tags: ['Department', 'Update'],
        auditAction: 'UPDATE',
        auditEntityType: 'Department',
      });
    },
  });

  const deleteDepartment = useMutation({
    mutationFn: (target: string | { id: string; name?: string; code?: string }) =>
      masterDataApi.deleteDepartment(typeof target === 'string' ? target : target.id),
    onSuccess: (_data, target) => {
      const id = typeof target === 'string' ? target : target.id;
      const name = typeof target === 'string' ? undefined : target.name;
      const code = typeof target === 'string' ? undefined : target.code;
      queryClient.invalidateQueries({ queryKey: DEPARTMENTS_QUERY_KEYS.all });
      addNotification({
        type: 'info',
        title: 'Department Deleted',
        message: 'Department removed from pipeline.',
      });
      trackEntityMutation(queryClient, {
        action: 'deleted',
        actionLabel: 'Department Deleted',
        resourceType: 'department',
        resourceId: id,
        resourceName: name,
        resourceCode: code,
        description: `Deleted department ${name ?? id}${code ? ` [${code}]` : ''}.`,
        tags: ['Department', 'Deletion'],
        auditAction: 'DELETE',
        auditEntityType: 'Department',
      });
    },
  });

  const bulkDeleteDepartment = makeBulkDeleteMutation({
    queryClient,
    addNotification,
    resource: 'departments',
    listKey: 'departments',
    entityLabel: 'departments',
  });
  return { createDepartment, updateDepartment, deleteDepartment, bulkDeleteDepartment };
};
