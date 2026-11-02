import { authApi } from '@/api/identity/auth';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { User, LoginOutcome, LoginResponse, MfaChallengeInput } from '@/types/identity';
import { LoginFormData } from '../schemas/authSchemas';
import { logger } from '@/core/logging/logger';
import { mapHttpError } from '@/api/errors/errorMapper';

export class AuthService {
  async login(credentials: LoginFormData): Promise<LoginOutcome> {
    logger.info('AuthService', 'Attempting login');
    const response = await authApi.login(credentials);
    if ('mfa_required' in response && response.mfa_required) {
      return { status: 'mfa_required', challenge: response.challenge, expiresIn: response.expires_in };
    }
    return this.toAuthenticated(response as LoginResponse);
  }

  async completeMfaLogin(input: MfaChallengeInput): Promise<LoginOutcome> {
    logger.info('AuthService', 'Completing MFA login');
    return this.toAuthenticated(await authApi.completeMfaLogin(input));
  }

  private toAuthenticated(response: LoginResponse): LoginOutcome {
    if (response.tokens) tokenStorage.setTokens(response.tokens);
    return {
      status: 'authenticated',
      user: response.user,
      mfaEnrollmentRequired: response.mfa_enrollment_required === true,
    };
  }

  async logout(): Promise<void> {
    logger.info('AuthService', 'Logging out user session');
    try {
      await authApi.logout(tokenStorage.getRefreshToken());
    } catch (err) {
      logger.warn('AuthService', 'Logout request failed, clearing local tokens anyway', err);
    } finally {
      tokenStorage.clearTokens();
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!tokenStorage.hasValidSession()) {
      return null;
    }
    try {
      return await authApi.me();
    } catch (err) {
      logger.warn('AuthService', 'Failed to retrieve current user', err);
      // Only a rejected session ends it. A network error or 5xx at boot must not wipe the
      // refresh token, or a brief outage would sign the user out of every tab.
      if (mapHttpError(err).isAuthError) tokenStorage.clearTokens();
      return null;
    }
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    logger.info('AuthService', 'Updating current user profile preferences');
    return await authApi.updateProfile(data);
  }

  async changePassword(data: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    await authApi.changePassword(data);
  }

  async forgotPassword(email: string): Promise<void> {
    await authApi.forgotPassword(email);
  }

  async resetPassword(data: { token: string; new_password: string; confirm_password: string }): Promise<void> {
    await authApi.resetPassword(data);
  }
}

export const authService = new AuthService();
