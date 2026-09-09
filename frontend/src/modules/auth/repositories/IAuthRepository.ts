import { LoginResponse, RefreshResponse, User } from '@/types/auth';
import { LoginFormData } from '../schemas/authSchemas';

export interface IAuthRepository {
  login(credentials: LoginFormData): Promise<LoginResponse>;
  refreshToken(refreshToken: string): Promise<RefreshResponse>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User>;
}
