import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';
import { listFetcher } from '@/shared/data/listing';
import type { Page } from '@/shared/data/listing';
import { createQueryKeys } from '@/shared/data/queryKeys';
import type { User } from '@/types/identity';

type Schemas = components['schemas'];

// ---------------------------------------------------------------- profile (PATCH /auth/me/)
/** Only Profile fields are writable; account-state fields in the body are silently ignored. */
export interface ProfilePatch {
  first_name?: string;
  last_name?: string;
  display_name?: string;
  avatar_url?: string;
  phone?: string;
  bio?: string;
  timezone?: string;
  language?: string;
}
export const profileApi = {
  update: (patch: ProfilePatch) => apiClient.patch<User>('/api/v1/auth/me/', patch),
};

// ---------------------------------------------------------------- sessions
export type UserSession = Schemas['UserSessionBase'] & { is_current: boolean };
export const sessionKeys = createQueryKeys('sessions');
export const sessionsApi = {
  list: (signal?: AbortSignal) => apiClient.get<UserSession[]>('/api/v1/identity/sessions/', { signal }),
  revoke: (id: string) => apiClient.post<unknown>(`/api/v1/identity/sessions/${id}/revoke/`, {}),
  revokeAllOther: () => apiClient.post<{ sessions: number }>('/api/v1/identity/sessions/revoke-all-other/', {}),
  /** Administrators: another user's sessions. */
  adminList: (userId: string, signal?: AbortSignal) => apiClient.get<UserSession[]>(`/api/v1/identity/sessions/admin/${userId}/`, { signal }),
  adminRevokeAll: (userId: string) => apiClient.post<{ sessions: number }>(`/api/v1/identity/sessions/admin/${userId}/revoke-all/`, {}),
};

// ---------------------------------------------------------------- personal access tokens and API keys
/** Read shape: never carries the secret. */
export interface Credential {
  id: string;
  kind: 'personal_access_token' | 'api_key';
  name: string;
  description: string;
  prefix: string;
  scopes: string[];
  unrestricted: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
}
/** Create/rotate response: the secret is returned exactly once. */
export type IssuedCredential = Credential & { secret: string };
export interface CredentialInput {
  name: string;
  description?: string;
  /** Permission codes the caller holds (the server rejects any other). Non-empty. */
  scopes: string[];
  expires_at?: string | null;
}

export type CredentialKind = 'tokens' | 'keys';
const BASE: Record<CredentialKind, string> = {
  tokens: '/api/v1/identity/personal-access-tokens/',
  keys: '/api/v1/identity/api-keys/',
};
export const credentialKeys = createQueryKeys('credentials');

export const credentialsApi = {
  list: (kind: CredentialKind) => listFetcher<Credential>(BASE[kind]),
  /** Active credentials only; pass `include_revoked` to see rotated/revoked ones as well. */
  listAll: async (kind: CredentialKind, includeRevoked = false, signal?: AbortSignal) => {
    const res = await apiClient.get<Page<Credential> | Credential[]>(BASE[kind], { params: { page_size: 100, ...(includeRevoked ? { include_revoked: 'true' } : {}) }, signal });
    return Array.isArray(res) ? res : res.results;
  },
  create: (kind: CredentialKind, input: CredentialInput) => apiClient.post<IssuedCredential>(BASE[kind], input),
  rotate: (kind: CredentialKind, id: string) => apiClient.post<IssuedCredential>(`${BASE[kind]}${id}/rotate/`, {}),
  revoke: (kind: CredentialKind, id: string) => apiClient.delete<void>(`${BASE[kind]}${id}/`),
};
