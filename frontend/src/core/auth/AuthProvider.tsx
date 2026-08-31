import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthContext, AuthContextValue } from './AuthContext';
import { authService } from '@/modules/auth/services/AuthService';
import { User, Role, AnyPermission } from '@/types/auth';
import { LoginFormData } from '@/modules/auth/schemas/authSchemas';
import { checkUserHasPermission, checkUserHasRole } from '@/core/permissions/rbac';
import { logger } from '@/core/logging/logger';
import { useActivityStore } from '@/shared/stores/useActivityStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      logger.error('AuthProvider', 'Session bootstrap failed', err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (user) {
      void useActivityStore.getState().fetchActivities();
    }
  }, [user]);

  const login = useCallback(async (credentials: LoginFormData) => {
    setIsLoading(true);
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  const hasRole = useCallback(
    (role: Role | Role[]) => checkUserHasRole(user, role),
    [user]
  );

  const hasPermission = useCallback(
    (permission: AnyPermission | AnyPermission[]) => checkUserHasPermission(user, permission),
    [user]
  );

  const can = useCallback(
    (action: AnyPermission | AnyPermission[]) => checkUserHasPermission(user, action),
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      hasRole,
      hasPermission,
      can,
      refreshUser,
    }),
    [user, isLoading, login, logout, hasRole, hasPermission, can, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
