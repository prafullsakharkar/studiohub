import { apiClient } from '@/api/client/ApiClient';
import type { LoginResponse, MfaChallengeInput, MfaRequiredResponse, User } from '@/types/identity';

const BASE = '/api/v1/auth/';

/**
 * The sign-in routes (docs/sync/00-backend-inventory.md, auth section). Pure transport: it keeps no tokens; the caller
 * (`AuthService`) stores them. With MFA the password step answers a challenge and no tokens (SEC-LOGIN-04).
 */
export const authApi = {
  login: (credentials: { email: string; password: string }) => apiClient.post<LoginResponse | MfaRequiredResponse>(`${BASE}login/`, { email: credentials.email, password: credentials.password }),
  completeMfaLogin: (input: MfaChallengeInput) => apiClient.post<LoginResponse>(`${BASE}mfa/challenge/`, input),
  forgotPassword: (email: string) => apiClient.post<void>(`${BASE}forgot-password/`, { email }),
  resetPassword: (data: { token: string; new_password: string; confirm_password: string }) => apiClient.post<void>(`${BASE}reset-password/`, data),
  /** The backend revokes the session that this refresh token belongs to. */
  logout: (refresh: string | null) => apiClient.post<void>(`${BASE}logout/`, refresh ? { refresh } : {}),
  me: () => apiClient.get<User>(`${BASE}me/`),
  updateProfile: (data: Partial<User>) => apiClient.patch<User>(`${BASE}me/`, data),
  changePassword: (data: { old_password: string; new_password: string; confirm_password: string }) => apiClient.post<void>(`${BASE}change-password/`, data),
};
