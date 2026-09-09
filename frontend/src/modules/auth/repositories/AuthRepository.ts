import { IApiClient } from '@/api/client/types';
import { apiClient } from '@/api/client/ApiClient';
import { IAuthRepository } from './IAuthRepository';
import { LoginResponse, RefreshResponse, User } from '@/types/auth';
import { LoginFormData } from '../schemas/authSchemas';

export class AuthRepository implements IAuthRepository {
  private client: IApiClient;

  constructor(client: IApiClient = apiClient) {
    this.client = client;
  }

  async login(credentials: LoginFormData): Promise<LoginResponse> {
    return this.client.post<LoginResponse>(
      '/api/v1/auth/login/',
      {
        email: credentials.email,
        password: credentials.password,
      },
      { skipAuth: true }
    );
  }

  async refreshToken(refreshToken: string): Promise<RefreshResponse> {
    return this.client.post<RefreshResponse>(
      '/api/v1/auth/refresh/',
      {
        refresh: refreshToken,
      },
      { skipAuth: true }
    );
  }

  async logout(): Promise<void> {
    await this.client.post('/api/v1/auth/logout/');
  }

  async getCurrentUser(): Promise<User> {
    return this.client.get<User>('/api/v1/auth/me/');
  }
}

export const authRepository = new AuthRepository();
