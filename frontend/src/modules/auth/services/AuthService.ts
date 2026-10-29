import { IAuthRepository, authRepository } from '@/api/repositories';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { User, LoginResponse, DemoUser } from '@/types/identity';
import { LoginFormData } from '../schemas/authSchemas';
import { logger } from '@/core/logging/logger';
import { mapHttpError } from '@/api/errors/errorMapper';

export class AuthService {
  private repository: IAuthRepository;

  constructor(repository: IAuthRepository = authRepository) {
    this.repository = repository;
  }

  async login(credentials: LoginFormData): Promise<LoginResponse> {
    logger.info('AuthService', `Attempting login for user: ${credentials.email}`);
    const response = await this.repository.login(credentials);
    tokenStorage.setTokens(response.tokens);
    logger.info('AuthService', `Login successful for: ${response.user.full_name} (${response.user.role})`);
    return response;
  }

  async logout(): Promise<void> {
    logger.info('AuthService', 'Logging out user session');
    try {
      await this.repository.logout();
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
      return await this.repository.getCurrentUser();
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
    return await this.repository.updateProfile(data);
  }

  async changePassword(data: {
    old_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<void> {
    await this.repository.changePassword(data);
  }

  async getDemoUsers(): Promise<DemoUser[]> {
    logger.info('AuthService', 'Fetching demo user personas from database via API');
    return await this.repository.getDemoUsers();
  }
}

export const authService = new AuthService();
