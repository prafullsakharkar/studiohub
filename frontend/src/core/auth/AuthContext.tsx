import { createContext } from 'react';
import { User, Role, Permission } from '@/types/auth';
import { LoginFormData } from '@/modules/auth/schemas/authSchemas';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[]) => boolean;
  hasPermission: (permission: Permission | Permission[]) => boolean;
  can: (action: Permission | Permission[]) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
