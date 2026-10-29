import { LoginFormData } from '@/modules/auth';
import { createContext } from 'react';
import { User, Role, Permission, LoginOutcome, MfaChallengeInput } from '@/types/identity';

export type Restriction = 'mfa_enrollment' | 'password_change';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Resolves `mfa_required` (with the challenge) instead of signing in when the account has MFA. */
  login: (credentials: LoginFormData) => Promise<LoginOutcome>;
  completeMfaLogin: (input: MfaChallengeInput) => Promise<LoginOutcome>;
  /**
   * What the session owes before it may use the API (backend "restricted sessions"): set by the
   * `mfa_enrollment_required` login flag or by a 403 with that code / `password_change_required`.
   */
  restriction: Restriction | null;
  /** Call after the debt is settled (MFA enrolled); the next request proves it. */
  clearRestriction: () => void;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[] | string | string[], projectId?: string) => boolean;
  hasPermission: (permission: Permission | Permission[] | string | string[], projectId?: string) => boolean;
  can: (action: Permission | Permission[] | string | string[], projectId?: string) => boolean;
  refreshUser: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
