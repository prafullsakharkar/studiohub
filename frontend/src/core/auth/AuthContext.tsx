import { createContext } from 'react';
import { User, Role, AnyPermission } from '@/types/auth';
import { LoginFormData } from '@/modules/auth/schemas/authSchemas';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginFormData) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role | Role[]) => boolean;
  hasPermission: (permission: AnyPermission | AnyPermission[]) => boolean;
  can: (action: AnyPermission | AnyPermission[]) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
