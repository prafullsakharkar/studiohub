import { authService, LoginFormData } from '@/modules/auth';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthContext, AuthContextValue } from './AuthContext';
import { User, Role, Permission } from '@/types/identity';
import {
  checkUserHasPermission,
  checkUserHasRole,
} from '@/core/permissions/rbac';
import { logger } from '@/core/logging/logger';
import { queryClient } from '@/providers/QueryProvider';
import { centralErrorHandler } from '@/core/api/error-handler';
import { useActivityStore } from '@/shared/stores/useActivityStore';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const recordActivity = useActivityStore((state) => state.recordActivity);

  // Phase 4 (ADR-0033): permission state derives from the authenticated user
  // only — the removed Zustand permission store / simulation sync is gone.

  const initAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await authService.getCurrentUser();
      if (typeof window !== 'undefined') {
        setUser(currentUser);
      }
    } catch (err) {
      logger.error('AuthProvider', 'Session bootstrap failed', err);
      if (typeof window !== 'undefined') {
        setUser(null);
      }
    } finally {
      if (typeof window !== 'undefined') {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Subscribe to Central Error Handler auth lifecycle
  useEffect(() => {
    const unsubAuth = centralErrorHandler.onAuthExpired(() => {
      logger.warn('AuthProvider', 'Auth expired event received. Clearing local user state.');
      setUser(null);
      queryClient.clear();
    });

    const unsubDisabled = centralErrorHandler.onAccountDisabled(() => {
      logger.error('AuthProvider', 'Account disabled event received. Clearing local user state.');
      setUser(null);
      queryClient.clear();
    });

    return () => {
      unsubAuth();
      unsubDisabled();
    };
  }, []);

  const login = useCallback(async (credentials: LoginFormData) => {
    const response = await authService.login(credentials);
    setUser(response.user);
    // Invalidate queries so freshly authenticated user queries populate
    queryClient.invalidateQueries();

    const userName = response.user.full_name || (response.user as any).name || response.user.email;
    const userAvatar = response.user.avatar_url || (response.user as any).avatar;

    recordActivity({
      action: 'login',
      actionLabel: 'User Signed In',
      resourceType: 'user',
      resourceId: response.user.id,
      resourceName: userName,
      actor: {
        id: response.user.id,
        name: userName,
        email: response.user.email,
        role: typeof response.user.role === 'string' ? response.user.role : 'User',
        avatarUrl: userAvatar,
      },
      description: `Signed in as ${userName} (${response.user.role}).`,
      tags: ['Authentication', 'Session'],
    });
  }, []);

  const logout = useCallback(async () => {
    setIsLoading(true);
    const prevUser = user;
    try {
      await authService.logout();
      if (prevUser) {
        const userName = prevUser.full_name || (prevUser as any).name || prevUser.email;
        const userAvatar = prevUser.avatar_url || (prevUser as any).avatar;

        recordActivity({
          action: 'logout',
          actionLabel: 'User Signed Out',
          resourceType: 'user',
          resourceId: prevUser.id,
          resourceName: userName,
          actor: {
            id: prevUser.id,
            name: userName,
            email: prevUser.email,
            role: typeof prevUser.role === 'string' ? prevUser.role : 'User',
            avatarUrl: userAvatar,
          },
          description: `Signed out of session for ${prevUser.email}.`,
          tags: ['Authentication', 'Session'],
        });
      }
    } catch (err) {
      logger.warn('AuthProvider', 'Logout error', err);
    } finally {
      setUser(null);
      // Cleanse TanStack query cache to prevent any user data leakage
      queryClient.clear();
      setIsLoading(false);
    }
  }, [user]);

  const refreshUser = useCallback(async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  }, []);

  const updateUserProfile = useCallback(async (data: Partial<User>) => {
    const updatedUser = await authService.updateProfile(data);
    setUser(updatedUser);
    return updatedUser;
  }, []);

  const hasRole = useCallback(
    (role: Role | Role[] | string | string[], projectId?: string) =>
      checkUserHasRole(user, role, projectId),
    [user]
  );

  const hasPermission = useCallback(
    (permission: Permission | Permission[] | string | string[], projectId?: string) =>
      checkUserHasPermission(user, permission as any, projectId),
    [user]
  );

  const can = useCallback(
    (action: Permission | Permission[] | string | string[], projectId?: string) =>
      checkUserHasPermission(user, action as any, projectId),
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
      updateUserProfile,
    }),
    [user, isLoading, login, logout, hasRole, hasPermission, can, refreshUser, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
