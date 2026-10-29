import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';
import { fetchAllRows, listFetcher } from '@/shared/data/listing';
import type { Page } from '@/shared/data/listing';
import { createQueryKeys } from '@/shared/data/queryKeys';

type Schemas = components['schemas'];

export type Role = Schemas['Role'];
export type Group = Schemas['Group'];
export type Permission = Schemas['Permission'];

/** Writable role fields (`code` is immutable after creation; system roles cannot be deleted). */
export interface RoleInput {
  name: string;
  code: string;
  description?: string;
  priority?: number;
  scope?: Role['scope'];
}
export interface GroupInput {
  name: string;
  code: string;
  description?: string;
}

/**
 * The sub-resource routes (`/roles/{id}/permissions|users|groups/`, `/groups/{id}/members|roles/`)
 * answer bare arrays whose rows embed SMALL NESTED REFS, not ids (verified against the running
 * backend, docs/sync/samples/identity/_identity_admin_flow.json). The refs carry what a table
 * needs (name/code/email), so no join with the catalogs is required.
 */
export interface RoleRef {
  id: string;
  name: string;
  code: string;
}
export interface GroupRef {
  id: string;
  name: string;
  code: string;
}
export interface UserRef {
  id: string;
  email: string;
  is_active: boolean;
}
export interface PermissionRef {
  id: string;
  name: string;
  code: string;
  module: string;
  action: string;
}

/** `GET /roles/{id}/permissions/` */
export interface RolePermissionGrant {
  id: string;
  uuid: string;
  role: RoleRef;
  permission: PermissionRef;
  granted: boolean;
  granted_at: string | null;
  granted_by: UserRef | null;
  expires_at: string | null;
}
/** `GET /roles/{id}/users/` */
export interface RoleUserAssignment {
  id: string;
  uuid: string;
  user: UserRef;
  role: RoleRef;
  created_at: string;
  updated_at: string;
}
/** `GET /groups/{id}/members/` */
export interface GroupMember {
  id: string;
  uuid: string;
  user: UserRef;
  group: GroupRef;
  is_owner: boolean;
  is_manager: boolean;
  joined_at: string | null;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}
/** `GET /groups/{id}/roles/` and `GET /roles/{id}/groups/` */
export interface GroupRoleLink {
  id: string;
  uuid: string;
  group: GroupRef;
  role: RoleRef;
  created_at: string;
  updated_at: string;
}

export const roleKeys = createQueryKeys('roles');
export const groupKeys = createQueryKeys('groups');
export const permissionKeys = createQueryKeys('permissions');

export const ROLE_ORDERING = ['priority', 'name', 'created_at'] as const;

// ---------------------------------------------------------------- permissions (read-only catalog)
export const permissionsApi = {
  list: listFetcher<Permission>('/api/v1/permissions/'),
  /** The whole catalog (145 rows today) for grant pickers and id -> code lookups. */
  all: (signal?: AbortSignal) => fetchAllRows(permissionsApi.list, { ordering: 'code' }, { signal }),
};

// ---------------------------------------------------------------- roles
const bare = <T>(url: string, signal?: AbortSignal) => apiClient.get<T[]>(url, { signal });

/**
 * `POST /roles/` and `POST /groups/` answer 201 with the submitted fields and NO id (docs/sync
 * Q-07), so the created row is read back by its unique `code`.
 */
async function findByCode<T extends { code?: string }>(base: string, code: string): Promise<T> {
  const found = await apiClient.get<Page<T> | T[]>(`${base}?search=${encodeURIComponent(code)}`);
  const rows = Array.isArray(found) ? found : found.results;
  const row = rows.find((r) => r.code === code);
  if (!row) throw new Error(`Created record "${code}" was not found.`);
  return row;
}

export const rolesApi = {
  list: listFetcher<Role>('/api/v1/roles/'),
  get: (id: string, signal?: AbortSignal) => apiClient.get<Role>(`/api/v1/roles/${id}/`, { signal }),
  create: async (input: RoleInput): Promise<Role> => {
    await apiClient.post('/api/v1/roles/', input);
    return findByCode<Role>('/api/v1/roles/', input.code);
  },
  update: (id: string, patch: Partial<Omit<RoleInput, 'code'>>) => apiClient.patch<Role>(`/api/v1/roles/${id}/`, patch),
  remove: (id: string) => apiClient.delete<void>(`/api/v1/roles/${id}/`),

  permissions: (id: string, signal?: AbortSignal) => bare<RolePermissionGrant>(`/api/v1/roles/${id}/permissions/`, signal),
  grantPermission: (id: string, permissionId: string, expiresAt?: string | null) =>
    apiClient.post<{ detail: string }>(`/api/v1/roles/${id}/permissions/`, { permission_id: permissionId, ...(expiresAt ? { expires_at: expiresAt } : {}) }),
  revokePermission: (id: string, permissionId: string) =>
    apiClient.delete<{ detail: string }>(`/api/v1/roles/${id}/permissions/`, { json: { permission_id: permissionId } }),

  users: (id: string, signal?: AbortSignal) => bare<RoleUserAssignment>(`/api/v1/roles/${id}/users/`, signal),
  assignUser: (id: string, userId: string) => apiClient.post<{ detail: string }>(`/api/v1/roles/${id}/users/`, { user_id: userId }),
  unassignUser: (id: string, userId: string) => apiClient.delete<{ detail: string }>(`/api/v1/roles/${id}/users/`, { json: { user_id: userId } }),

  groups: (id: string, signal?: AbortSignal) => bare<GroupRoleLink>(`/api/v1/roles/${id}/groups/`, signal),
};

// ---------------------------------------------------------------- groups
export const groupsApi = {
  list: listFetcher<Group>('/api/v1/groups/'),
  get: (id: string, signal?: AbortSignal) => apiClient.get<Group>(`/api/v1/groups/${id}/`, { signal }),
  create: async (input: GroupInput): Promise<Group> => {
    await apiClient.post('/api/v1/groups/', input);
    return findByCode<Group>('/api/v1/groups/', input.code);
  },
  update: (id: string, patch: Partial<Omit<GroupInput, 'code'>>) => apiClient.patch<Group>(`/api/v1/groups/${id}/`, patch),
  remove: (id: string) => apiClient.delete<void>(`/api/v1/groups/${id}/`),

  members: (id: string, signal?: AbortSignal) => bare<GroupMember>(`/api/v1/groups/${id}/members/`, signal),
  addMember: (id: string, userId: string, flags: { is_owner?: boolean; is_manager?: boolean } = {}) =>
    apiClient.post<{ detail: string }>(`/api/v1/groups/${id}/members/`, { user_id: userId, ...flags }),
  removeMember: (id: string, userId: string) => apiClient.delete<{ detail: string }>(`/api/v1/groups/${id}/members/`, { json: { user_id: userId } }),

  roles: (id: string, signal?: AbortSignal) => bare<GroupRoleLink>(`/api/v1/groups/${id}/roles/`, signal),
  attachRole: (id: string, roleId: string) => apiClient.post<{ detail: string }>(`/api/v1/groups/${id}/roles/`, { role_id: roleId }),
  detachRole: (id: string, roleId: string) => apiClient.delete<{ detail: string }>(`/api/v1/groups/${id}/roles/`, { json: { role_id: roleId } }),
};
