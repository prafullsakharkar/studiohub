import { apiClient } from '@/api/client/ApiClient';
import type { components } from '@/core/api/generated/openapi';

/**
 * TOTP enrollment (`apps/identity/api/views/mfa_compat.py`). These are among the few endpoints a
 * restricted session may call while it still owes MFA enrollment.
 */

/** `POST /identity/mfa/totp/setup/`: starts a pending enrollment. The secret is shown once. */
export interface TotpSetup {
  secret: string;
  /** `otpauth://` URI for authenticator apps. */
  uri: string;
  /** PNG data URI of the QR code. */
  qr_code: string;
}

/** `POST /identity/mfa/totp/enable/`: activates MFA and returns the recovery codes (shown once). */
export interface TotpEnabled {
  enabled: true;
  verified: true;
  recovery_codes: string[];
}

export interface MfaConfig {
  enabled: boolean;
  pending: boolean;
  methods: string[];
}

/**
 * Re-authentication for sensitive MFA changes: the password PLUS a verification code (TOTP) or a
 * recovery code. A request with only the password is answered `400 "Invalid verification code."`.
 */
export interface MfaReauth {
  password: string;
  code?: string;
  recovery_code?: string;
}

/** Row of `GET /identity/trusted-devices/` (generated `TrustedDeviceList`; the capture had no rows to compare). */
export type TrustedDevice = components['schemas']['TrustedDeviceList'];

export const mfaApi = {
  config: () => apiClient.get<MfaConfig>('/api/v1/identity/mfa/config/'),
  setup: () => apiClient.post<TotpSetup>('/api/v1/identity/mfa/totp/setup/', {}),
  /** The server activates its own pending secret; only the code is sent. */
  enable: (code: string) => apiClient.post<TotpEnabled>('/api/v1/identity/mfa/totp/enable/', { code }),
  /** Remaining one-time codes (the codes themselves are only shown at creation/regeneration). */
  recoveryStatus: () => apiClient.get<{ codes: string[]; remaining: number }>('/api/v1/identity/mfa/recovery-codes/'),
  regenerateRecoveryCodes: (input: MfaReauth) => apiClient.post<{ codes: string[] }>('/api/v1/identity/mfa/recovery-codes/regenerate/', input),
  disable: (input: MfaReauth) => apiClient.post<unknown>('/api/v1/identity/mfa/totp/disable/', input),
  /**
   * Trusted devices: the canonical `trusted-devices` list. (The `/identity/auth/mfa/devices/` tree
   * answers 401 to valid sessions, docs/sync Q-09.)
   */
  trustedDevices: () => apiClient.get<TrustedDevice[]>('/api/v1/identity/trusted-devices/'),
  revokeTrustedDevice: (id: string) => apiClient.delete<void>(`/api/v1/identity/trusted-devices/${id}/`),
  /** Administrator: clear another user's MFA (a lost authenticator). */
  adminReset: (userId: string) => apiClient.post<{ success: boolean }>(`/api/v1/identity/mfa/admin/reset/${userId}/`, {}),
};
