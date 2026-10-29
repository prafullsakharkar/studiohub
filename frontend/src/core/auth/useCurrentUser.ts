import { useAuth } from '@/modules/auth';
import { User, Role, Permission } from '@/types/identity';

export interface UseCurrentUserResult {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasRole: (role: Role | Role[] | string | string[], projectId?: string) => boolean;
  hasPermission: (permission: Permission | Permission[], projectId?: string) => boolean;
  can: (action: Permission | Permission[], projectId?: string) => boolean;
  refreshUser: () => Promise<void>;
}

export function useCurrentUser(): UseCurrentUserResult {
  const auth = useAuth();
  return {
    user: auth.user,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    hasRole: auth.hasRole,
    hasPermission: auth.hasPermission,
    can: auth.can,
    refreshUser: auth.refreshUser,
  };
}
