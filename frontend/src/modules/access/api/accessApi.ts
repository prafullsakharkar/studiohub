import { apiClient } from '@/api/client/ApiClient';
import { AccessRole, AccessGroup, PermissionDefinition } from '@/types/identity';

/**
 * Platform-global RBAC (flat `/api/v1/{roles,groups,permissions}/` endpoints).
 *
 * Formerly part of the deleted org module's API client; roles, groups and
 * permissions are now platform-level resources served by the identity app,
 * so these calls target the flat routes without an org id.
 */
export const accessApi = {
  // Roles
  getRoles: async (params?: Record<string, any>): Promise<AccessRole[]> => {
    return apiClient.get<AccessRole[]>('/api/v1/roles/', { params });
  },
  createRole: async (role: Partial<AccessRole>): Promise<AccessRole> => {
    return apiClient.post<AccessRole>('/api/v1/roles/', role);
  },
  updateRole: async (id: string, role: Partial<AccessRole>): Promise<AccessRole> => {
    return apiClient.patch<AccessRole>(`/api/v1/roles/${id}/`, role);
  },
  deleteRole: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/roles/${id}/`);
  },

  // Groups
  getGroups: async (params?: Record<string, any>): Promise<AccessGroup[]> => {
    return apiClient.get<AccessGroup[]>('/api/v1/groups/', { params });
  },
  createGroup: async (group: Partial<AccessGroup>): Promise<AccessGroup> => {
    return apiClient.post<AccessGroup>('/api/v1/groups/', group);
  },
  updateGroup: async (id: string, group: Partial<AccessGroup>): Promise<AccessGroup> => {
    return apiClient.patch<AccessGroup>(`/api/v1/groups/${id}/`, group);
  },
  deleteGroup: async (id: string): Promise<void> => {
    return apiClient.delete<void>(`/api/v1/groups/${id}/`);
  },

  // Permissions catalog (read-only)
  getPermissions: async (params?: Record<string, any>): Promise<PermissionDefinition[]> => {
    return apiClient.get<PermissionDefinition[]>('/api/v1/permissions/', { params });
  },
};
