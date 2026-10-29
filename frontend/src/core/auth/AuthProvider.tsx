import { authService, LoginFormData } from '@/modules/auth';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AuthContext, AuthContextValue, Restriction } from './AuthContext';
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
  const [restriction, setRestriction] = useState<Restriction | null>(null);

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

    // 403 `mfa_enrollment_required` / `password_change_required`: the route guard sends the user
    // to the screen that settles it (this also covers a reload, where /auth/me has no such flag).
    const unsubRestricted = centralErrorHandler.onSessionRestricted((error) => {
      logger.warn('AuthProvider', `Session restricted: ${error.code}`);
      setRestriction(error.requiredAction);
    });

    const unsubDisabled = centralErrorHandler.onAccountDisabled(() => {
      logger.error('AuthProvider', 'Account disabled event received. Clearing local user state.');
      setUser(null);
      queryClient.clear();
    });

    // The session ended, here or in another tab (sign-out, rejected refresh, password changed):
    // the signed-in user and every cached query go with it.
    const unsubTokens = tokenStorage.subscribe((event) => {
      if (event.type === 'cleared') {
        logger.info('AuthProvider', event.remote ? 'Session ended in another tab.' : 'Session ended.');
        setUser(null);
        queryClient.clear();
      }
    });

    return () => {
      unsubAuth();
      unsubDisabled();
      unsubRestricted();
      unsubTokens();
    };
  }, []);

  const finishLogin = useCallback(
    (outcome: LoginOutcome): LoginOutcome => {
      if (outcome.status !== 'authenticated') return outcome;
      const authedUser = outcome.user;
      setUser(authedUser);
      setRestriction(outcome.mfaEnrollmentRequired ? 'mfa_enrollment' : null);
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
      setRestriction(null);
      // Cleanse TanStack query cache to prevent any user data leakage
      queryClient.clear();
      setIsLoading(false);
    }
  }, []);

  const clearRestriction = useCallback(() => setRestriction(null), []);

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
      restriction,
      clearRestriction,
      logout,
      hasRole,
      hasPermission,
      can,
      refreshUser,
      updateUserProfile,
    }),
    [user, isLoading, login, completeMfaLogin, restriction, clearRestriction, logout, hasRole, hasPermission, can, refreshUser, updateUserProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
