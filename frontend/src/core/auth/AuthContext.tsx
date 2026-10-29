import { LoginFormData } from '@/modules/auth';
import { createContext } from 'react';
import { User, Role, Permission, LoginOutcome, MfaChallengeInput } from '@/types/identity';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Resolves `mfa_required` (with the challenge) instead of signing in when the account has MFA. */
  login: (credentials: LoginFormData) => Promise<LoginOutcome>;
  completeMfaLogin: (input: MfaChallengeInput) => Promise<LoginOutcome>;
  /** Set after login when policy requires MFA but the user has not enrolled yet. */
  mfaEnrollmentRequired: boolean;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[] | string | string[], projectId?: string) => boolean;
  hasPermission: (permission: Permission | Permission[] | string | string[], projectId?: string) => boolean;
  can: (action: Permission | Permission[] | string | string[], projectId?: string) => boolean;
  refreshUser: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
