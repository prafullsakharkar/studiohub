import { LoginFormData } from '@/modules/auth';
import { createContext } from 'react';
import { User, Role, Permission } from '@/types/identity';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[] | string | string[], projectId?: string) => boolean;
  hasPermission: (permission: Permission | Permission[] | string | string[], projectId?: string) => boolean;
  can: (action: Permission | Permission[] | string | string[], projectId?: string) => boolean;
  refreshUser: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<User>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
