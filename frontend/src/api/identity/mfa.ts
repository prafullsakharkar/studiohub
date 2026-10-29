import { apiClient } from '@/api/client/ApiClient';

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

export const mfaApi = {
  config: () => apiClient.get<MfaConfig>('/api/v1/identity/mfa/config/'),
  setup: () => apiClient.post<TotpSetup>('/api/v1/identity/mfa/totp/setup/', {}),
  /** The server activates its own pending secret; only the code is sent. */
  enable: (code: string) => apiClient.post<TotpEnabled>('/api/v1/identity/mfa/totp/enable/', { code }),
};
