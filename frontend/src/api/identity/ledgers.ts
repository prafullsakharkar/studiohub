import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';

type Schemas = components['schemas'];

export type SecurityEvent = Schemas['SecurityEventList'];
export type LoginHistoryEntry = Schemas['LoginHistoryList'];
export type LoginAttempt = Schemas['LoginAttemptList'];
export type IpBlacklistEntry = Schemas['IPBlacklistList'];

/**
 * The four security ledgers return BARE arrays of everything (docs/sync Q-10), so callers always
 * send a date window and these helpers never ask for "all time".
 */
export interface LedgerWindow {
  start_date?: string;
  end_date?: string;
  [filter: string]: string | undefined;
}

const get = <T>(url: string, params: LedgerWindow, signal?: AbortSignal) => apiClient.get<T[]>(url, { params, signal });

export const ledgersApi = {
  securityEvents: (params: LedgerWindow = {}, signal?: AbortSignal) => get<SecurityEvent>('/api/v1/identity/security-events/', params, signal),
  loginHistory: (params: LedgerWindow = {}, signal?: AbortSignal) => get<LoginHistoryEntry>('/api/v1/identity/login-history/', params, signal),
  loginAttempts: (params: LedgerWindow = {}, signal?: AbortSignal) => get<LoginAttempt>('/api/v1/identity/login-attempts/', params, signal),
  ipBlacklist: (params: LedgerWindow = {}, signal?: AbortSignal) => get<IpBlacklistEntry>('/api/v1/identity/ip-blacklist/', params, signal),
  addIp: (input: { ip_address: string; description?: string; reason?: string }) => apiClient.post<IpBlacklistEntry>('/api/v1/identity/ip-blacklist/', input),
  activateIp: (id: string) => apiClient.post<IpBlacklistEntry>(`/api/v1/identity/ip-blacklist/${id}/activate/`, {}),
  deactivateIp: (id: string) => apiClient.post<IpBlacklistEntry>(`/api/v1/identity/ip-blacklist/${id}/deactivate/`, {}),
  removeIp: (id: string) => apiClient.delete<void>(`/api/v1/identity/ip-blacklist/${id}/`),
};
