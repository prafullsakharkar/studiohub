import { authService, LoginFormData } from '@/modules/auth';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthContext, AuthContextValue } from './AuthContext';
import { User, Role, Permission, LoginOutcome, MfaChallengeInput } from '@/types/identity';
import {
  checkUserHasPermission,
  checkUserHasRole,
} from '@/core/permissions/rbac';
import { logger } from '@/core/logging/logger';
import { queryClient } from '@/providers/QueryProvider';
import { centralErrorHandler } from '@/core/api/error-handler';
import { tokenStorage } from '@/core/auth/tokenStorage';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);

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

    // Signed out (or session lost) in another tab: follow it here.
    const unsubTokens = tokenStorage.subscribe((event) => {
      if (event.type === 'cleared' && event.remote) {
        logger.info('AuthProvider', 'Session ended in another tab.');
        setUser(null);
        queryClient.clear();
      }
    });

    return () => {
      unsubAuth();
      unsubDisabled();
      unsubTokens();
    };
  }, []);

  const finishLogin = useCallback(
    (outcome: LoginOutcome): LoginOutcome => {
      if (outcome.status !== 'authenticated') return outcome;
      const authedUser = outcome.user;
      setUser(authedUser);
      setMfaEnrollmentRequired(outcome.mfaEnrollmentRequired);
      // Invalidate queries so freshly authenticated user queries populate
      queryClient.invalidateQueries();

      return outcome;
    },
    []
  );

  const login = useCallback(
    async (credentials: LoginFormData) => finishLogin(await authService.login(credentials)),
    [finishLogin]
  );

  const completeMfaLogin = useCallback(
    async (input: MfaChallengeInput) => finishLogin(await authService.completeMfaLogin(input)),
    [finishLogin]
  );

  const logout = useCallback(async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      logger.warn('AuthProvider', 'Logout error', err);
    } finally {
      setUser(null);
      setMfaEnrollmentRequired(false);
      // Cleanse TanStack query cache to prevent any user data leakage
      queryClient.clear();
      setIsLoading(false);
    }
  }, []);

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
      completeMfaLogin,
      mfaEnrollmentRequired,
      logout,
      hasRole,
      hasPermission,
      can,
      refreshUser,
      updateUserProfile,
    }),
    [user, isLoading, login, completeMfaLogin, mfaEnrollmentRequired, logout, hasRole, hasPermission, can, refreshUser, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
