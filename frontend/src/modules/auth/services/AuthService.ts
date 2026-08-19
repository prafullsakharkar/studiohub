import { IAuthRepository } from '../repositories/IAuthRepository';
import { authRepository } from '../repositories/AuthRepository';
import { tokenStorage } from '@/core/auth/tokenStorage';
import { User, LoginResponse } from '@/types/auth';
import { LoginFormData } from '../schemas/authSchemas';
import { logger } from '@/core/logging/logger';

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
      tokenStorage.clearTokens();
      return null;
    }
  }
}

export const authService = new AuthService();
