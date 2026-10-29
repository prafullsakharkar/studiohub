import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accessApi } from '@/modules/access/api/accessApi';
import { apiClient } from '@/api/client/ApiClient';
import { trackEntityMutation } from '@/shared/hooks/trackEntityMutation';
import { useNotificationStore } from '@/shared/stores/useNotificationStore';
import {
  AccessRole,
  AccessGroup,
} from '@/types/identity';

export const ACCESS_QUERY_KEYS = {
  roles: ['roles'] as const,
  roleList: (params?: Record<string, any>) => [...ACCESS_QUERY_KEYS.roles, 'list', params] as const,
  groups: ['groups'] as const,
  groupList: (params?: Record<string, any>) => [...ACCESS_QUERY_KEYS.groups, 'list', params] as const,
  permissions: ['permissions'] as const,
  permissionList: (params?: Record<string, any>) => [...ACCESS_QUERY_KEYS.permissions, 'list', params] as const,
  activity: ['activity'] as const,
  activityList: (params?: Record<string, any>) => [...ACCESS_QUERY_KEYS.activity, 'list', params] as const,
};

// ==========================================
// ROLES
// ==========================================

export const useRoles = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ACCESS_QUERY_KEYS.roleList(params),
    queryFn: () => accessApi.getRoles(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useRoleMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createRole = useMutation({
    mutationFn: (data: Partial<AccessRole>) => accessApi.createRole(data),
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.roles });
      addNotification({
        type: 'success',
        title: 'Security Role Created',
        message: `${role.name} added to RBAC matrix.`,
      });
      trackEntityMutation(queryClient, {
        action: 'created',
        actionLabel: 'Role Created',
        resourceType: 'role',
        resourceId: role.id,
        resourceName: role.name,
        description: `Created security role ${role.name}.`,
        tags: ['Role', 'Creation'],
        auditAction: 'CREATE',
        auditEntityType: 'Role',
      });
    },
  });

  const updateRole = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccessRole> }) =>
      accessApi.updateRole(id, data),
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.roles });
      addNotification({
        type: 'success',
        title: 'Role Updated',
        message: `${role.name} permissions updated.`,
      });
      trackEntityMutation(queryClient, {
        action: 'updated',
        actionLabel: 'Role Updated',
        resourceType: 'role',
        resourceId: role.id,
        resourceName: role.name,
        description: `Updated security role ${role.name}.`,
        tags: ['Role', 'Update'],
        auditAction: 'UPDATE',
        auditEntityType: 'Role',
      });
    },
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => accessApi.deleteRole(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.roles });
      addNotification({
        type: 'info',
        title: 'Role Deleted',
        message: 'Access role removed from system.',
      });
      trackEntityMutation(queryClient, {
        action: 'deleted',
        actionLabel: 'Role Deleted',
        resourceType: 'role',
        resourceId: id,
        description: `Deleted security role ${id}.`,
        tags: ['Role', 'Deletion'],
        auditAction: 'DELETE',
        auditEntityType: 'Role',
      });
    },
  });

  return { createRole, updateRole, deleteRole };
};

// ==========================================
// GROUPS
// ==========================================

export const useGroups = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ACCESS_QUERY_KEYS.groupList(params),
    queryFn: () => accessApi.getGroups(params),
    staleTime: 1000 * 60 * 2,
  });
};

export const useGroupMutations = () => {
  const queryClient = useQueryClient();
  const { addNotification } = useNotificationStore();

  const createGroup = useMutation({
    mutationFn: (data: Partial<AccessGroup>) => accessApi.createGroup(data),
    onSuccess: (grp) => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.groups });
      addNotification({
        type: 'success',
        title: 'Access Group Created',
        message: `${grp.name} established.`,
      });
      trackEntityMutation(queryClient, {
        action: 'created',
        actionLabel: 'Group Created',
        resourceType: 'group',
        resourceId: grp.id,
        resourceName: grp.name,
        resourceCode: grp.code,
        description: `Created access group ${grp.name}.`,
        tags: ['Group', 'Creation'],
        auditAction: 'CREATE',
        auditEntityType: 'Group',
      });
    },
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AccessGroup> }) =>
      accessApi.updateGroup(id, data),
    onSuccess: (grp) => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.groups });
      addNotification({
        type: 'success',
        title: 'Access Group Saved',
        message: `${grp.name} membership updated.`,
      });
      trackEntityMutation(queryClient, {
        action: 'updated',
        actionLabel: 'Group Updated',
        resourceType: 'group',
        resourceId: grp.id,
        resourceName: grp.name,
        resourceCode: grp.code,
        description: `Updated access group ${grp.name}.`,
        tags: ['Group', 'Update'],
        auditAction: 'UPDATE',
        auditEntityType: 'Group',
      });
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => accessApi.deleteGroup(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ACCESS_QUERY_KEYS.groups });
      addNotification({
        type: 'info',
        title: 'Group Removed',
        message: 'Access group dissolved.',
      });
      trackEntityMutation(queryClient, {
        action: 'deleted',
        actionLabel: 'Group Deleted',
        resourceType: 'group',
        resourceId: id,
        description: `Dissolved access group ${id}.`,
        tags: ['Group', 'Deletion'],
        auditAction: 'DELETE',
        auditEntityType: 'Group',
      });
    },
  });

  return { createGroup, updateGroup, deleteGroup };
};

// ==========================================
// PERMISSIONS
// ==========================================

export const usePermissions = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ACCESS_QUERY_KEYS.permissionList(params),
    queryFn: () => accessApi.getPermissions(params),
    staleTime: 1000 * 60 * 10,
  });
};

// ==========================================
// ACTIVITY (access audit feed)
// ==========================================

export const useAccessActivity = (params?: Record<string, any>) => {
  return useQuery({
    queryKey: ACCESS_QUERY_KEYS.activityList(params),
    queryFn: () => apiClient.get<{ results?: any[] }>('/api/v1/activity/', { params }),
    staleTime: 1000 * 30,
  });
};
