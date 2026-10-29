import { LoginFormData } from '@/modules/auth';
import {
  LoginResponse,
  MfaChallengeInput,
  MfaRequiredResponse,
  RefreshResponse,
  User,
  DemoUser,
} from '@/types/identity';

export interface IAuthRepository {
  login(credentials: LoginFormData): Promise<LoginResponse | MfaRequiredResponse>;
  completeMfaLogin(input: MfaChallengeInput): Promise<LoginResponse>;
  refreshToken(refreshToken: string): Promise<RefreshResponse>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User>;
  updateProfile(data: Partial<User>): Promise<User>;
  changePassword(data: { old_password: string; new_password: string; confirm_password: string }): Promise<void>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(data: { token: string; new_password: string; confirm_password: string }): Promise<void>;
  getDemoUsers(): Promise<DemoUser[]>;
}
