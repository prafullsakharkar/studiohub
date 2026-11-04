import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';
import { createQueryKeys } from '@/shared/data/queryKeys';

type Schemas = components['schemas'];

/**
 * `GET /identity/directory/`: the one directory (LDAP) configuration (CR-40, ADR-0039). The service
 * password is write-only; a read says only whether one is set (`bind_password_set`).
 */
export type DirectoryConfiguration = Schemas['DirectoryConfiguration'];
/** `PATCH` body: `bind_password` sets a new one, `''` clears it, absent keeps it. */
export type DirectoryConfigurationPatch = Schemas['PatchedDirectoryConfiguration'];

/** `POST …/test-connection/` (200 either way; `ok` says whether it worked). Shape from `_directory_flow.json`. */
export interface DirectoryConnectionResult {
  ok: boolean;
  detail: string;
  tested_at?: string;
}

/** One entry, as the "test a username" check shows it (the attributes a sign-in would copy). */
export interface DirectoryEntryPreview {
  dn: string;
  subject: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
}

/** `POST …/test-user/`: `found` false carries `detail`; found carries the entry and what stops it signing in. */
export interface DirectoryUserResult {
  ok: boolean;
  found: boolean;
  detail?: string;
  entry?: DirectoryEntryPreview;
  problems?: string[];
}

export const directoryKeys = createQueryKeys('identity-directory');

const BASE = '/api/v1/identity/directory/';

export const directoryApi = {
  get: (signal?: AbortSignal) => apiClient.get<DirectoryConfiguration>(BASE, { signal }),
  update: (patch: DirectoryConfigurationPatch) => apiClient.patch<DirectoryConfiguration>(BASE, patch),
  testConnection: () => apiClient.post<DirectoryConnectionResult>(`${BASE}test-connection/`, {}),
  testUser: (username: string) => apiClient.post<DirectoryUserResult>(`${BASE}test-user/`, { username }),
};
