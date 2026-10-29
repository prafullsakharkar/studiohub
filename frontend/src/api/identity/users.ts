import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';
import { listFetcher } from '@/shared/data/listing';
import { createQueryKeys } from '@/shared/data/queryKeys';

type Schemas = components['schemas'];

/** `GET /identity/users/` row (a bare array, scoped to what the caller may see). */
export type UserSummary = Schemas['UserList'];
export type UserDetail = Schemas['UserDetail'];

export const userKeys = createQueryKeys('identity-users');

/** `POST /identity/users/`. The password must satisfy the server policy (12+ characters, not common). */
export interface UserCreateInput {
  email: string;
  password: string;
}

/**
 * Account lifecycle actions: `POST /identity/users/{id}/<action>/`. The permission each needs is
 * enforced by the server (`identity.user.*`); the keys below are the URL segments.
 */
export const USER_ACTIONS = {
  activate: { path: 'activate', permission: 'identity.user.activate' },
  deactivate: { path: 'deactivate', permission: 'identity.user.deactivate' },
  suspend: { path: 'suspend', permission: 'identity.user.deactivate' },
  unsuspend: { path: 'unsuspend', permission: 'identity.user.activate' },
  archive: { path: 'archive', permission: 'identity.user.archive' },
  restore: { path: 'restore', permission: 'identity.user.restore' },
  resetPassword: { path: 'reset-password', permission: 'identity.user.reset_password' },
  forcePasswordChange: { path: 'force-password-change', permission: 'identity.user.update' },
  revokeSessions: { path: 'revoke-sessions', permission: 'identity.user.update' },
} as const;
export type UserAction = keyof typeof USER_ACTIONS;

export const usersApi = {
  list: listFetcher<UserSummary>('/api/v1/identity/users/'),
  get: (id: string, signal?: AbortSignal) => apiClient.get<UserDetail>(`/api/v1/identity/users/${id}/`, { signal }),
  create: (input: UserCreateInput) => apiClient.post<UserDetail>('/api/v1/identity/users/', input),
  update: (id: string, patch: { is_staff?: boolean; is_active?: boolean }) => apiClient.patch<UserDetail>(`/api/v1/identity/users/${id}/`, patch),
  act: (id: string, action: UserAction) =>
    apiClient.post<{ detail?: string; sessions?: number }>(`/api/v1/identity/users/${id}/${USER_ACTIONS[action].path}/`, {}),
};

/** `POST /people/{id}/link-user/` and `/unlink-user/` (masterdata). 409 if the user is linked to another person. */
export const personLinkApi = {
  link: (personId: string, userId: string) => apiClient.post<{ id: string; user: string | null }>(`/api/v1/people/${personId}/link-user/`, { user: userId }),
  unlink: (personId: string) => apiClient.post<{ id: string; user: string | null }>(`/api/v1/people/${personId}/unlink-user/`, {}),
};
