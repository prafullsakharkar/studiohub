import { LoginFormData } from '@/modules/auth';
import { IAuthRepository } from '../../interfaces/IAuthRepository';
import {
  LoginResponse,
  MfaChallengeInput,
  MfaRequiredResponse,
  RefreshResponse,
  User,
  DemoUser,
} from '@/types/identity';
import { BaseRESTAdapter } from './BaseRESTAdapter';
import { tokenStorage } from '@/core/auth/tokenStorage';

export class RESTAuthAdapter extends BaseRESTAdapter<User> implements IAuthRepository {
  constructor() {
    super('/api/v1/auth');
  }

  async login(credentials: LoginFormData): Promise<LoginResponse | MfaRequiredResponse> {
    const response = await this.request<LoginResponse | MfaRequiredResponse>(`${this.basePath}login/`, {
      method: 'POST',
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    // With MFA the password step returns a challenge and no tokens (SEC-LOGIN-04).
    if ('mfa_required' in response && response.mfa_required) {
      return response;
    }
    if ('tokens' in response && response.tokens) {
      tokenStorage.setTokens(response.tokens);
    }

    return response;
  }

  async completeMfaLogin(input: MfaChallengeInput): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>(`${this.basePath}mfa/challenge/`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    if (response.tokens) {
      tokenStorage.setTokens(response.tokens);
    }
    return response;
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request<void>(`${this.basePath}forgot-password/`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(data: { token: string; new_password: string; confirm_password: string }): Promise<void> {
    await this.request<void>(`${this.basePath}reset-password/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    const response = await this.request<RefreshResponse>(`${this.basePath}refresh/`, {
      method: 'POST',
      body: JSON.stringify({
        refresh: refreshToken,
      }),
    });

    if (response.access) {
      tokenStorage.setAccessToken(response.access);
    }
    // Persist rotated refresh tokens (backend rotates on every refresh).
    if (response.refresh) {
      tokenStorage.setRefreshToken(response.refresh);
    }

    return response;
  }

  async logout(): Promise<void> {
    // The backend revokes the session identified by this refresh token.
    const refresh = tokenStorage.getRefreshToken();
    try {
      await this.request<void>(`${this.basePath}logout/`, {
        method: 'POST',
        body: JSON.stringify(refresh ? { refresh } : {}),
      });
    } finally {
      tokenStorage.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>(`${this.basePath}me/`, {
      method: 'GET',
    });
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    return this.request<User>(`${this.basePath}me/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    await this.request<void>(`${this.basePath}change-password/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getDemoUsers(): Promise<DemoUser[]> {
    // Instant demo workspaces are a mock-engine concept. Django exposes no
    // demo-users endpoint, so resolve empty without any network call.
    return [];
  }
}
