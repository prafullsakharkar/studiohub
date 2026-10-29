import { useContext } from 'react';
import { AuthContext, AuthContextValue } from '@/core/auth/AuthContext';

const fallbackAuthContext: AuthContextValue = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: async () => {
    throw new Error('login called outside AuthProvider');
  },
  completeMfaLogin: async () => {
    throw new Error('completeMfaLogin called outside AuthProvider');
  },
  restriction: null,
  clearRestriction: () => {},
  logout: async () => {},
  hasRole: () => false,
  hasPermission: () => false,
  can: () => false,
  refreshUser: async () => {},
  updateUserProfile: async () => {
    throw new Error('updateUserProfile called outside AuthProvider');
  },
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return fallbackAuthContext;
  }
  return context;
}

