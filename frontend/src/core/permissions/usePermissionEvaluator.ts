import { useCallback, useMemo } from 'react';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import {
  evaluateUserPermission,
  checkUserHasProjectAccess,
  checkUserHasRole,
  getUserProjectMembership,
} from './rbac';
import { PermissionEvaluationContext } from '@/types/identity';

export interface UsePermissionEvaluatorOptions {
  projectId?: string;
}

export function usePermissionEvaluator(options?: UsePermissionEvaluatorOptions) {
  const { user, isAuthenticated } = useCurrentUser();

  const activeProjectId = options?.projectId;

  const projectMembership = useMemo(() => {
    return getUserProjectMembership(user, activeProjectId);
  }, [user, activeProjectId]);

  /**
   * Main evaluate function: can(permission, contextOverride)
   */
  const can = useCallback(
    (
      permission: string,
      contextOverride?: Partial<PermissionEvaluationContext>
    ): boolean => {
      if (!user) return false;
      const ctx: PermissionEvaluationContext = {
        projectId: activeProjectId,
        ...contextOverride,
      };
      return evaluateUserPermission(user, permission, ctx);
    },
    [user, activeProjectId]
  );

  /**
   * Check page level permission: canPage("page.project.shots")
   */
  const canPage = useCallback(
    (
      pagePermission: string,
      contextOverride?: Partial<PermissionEvaluationContext>
    ): boolean => {
      const code = pagePermission.startsWith('page.') ? pagePermission : `page.${pagePermission}`;
      return can(code, contextOverride);
    },
    [can]
  );

  /**
   * Check all permissions (AND logic)
   */
  const canAll = useCallback(
    (
      permissions: string[],
      contextOverride?: Partial<PermissionEvaluationContext>
    ): boolean => {
      if (!permissions || permissions.length === 0) return true;
      return permissions.every((p) => can(p, contextOverride));
    },
    [can]
  );

  /**
   * Check any permission (OR logic)
   */
  const canAny = useCallback(
    (
      permissions: string[],
      contextOverride?: Partial<PermissionEvaluationContext>
    ): boolean => {
      if (!permissions || permissions.length === 0) return true;
      return permissions.some((p) => can(p, contextOverride));
    },
    [can]
  );

  /**
   * Check if user has a role in current context
   */
  const hasRole = useCallback(
    (roles: string | string[], contextOverride?: { projectId?: string }) => {
      return checkUserHasRole(
        user,
        roles,
        contextOverride?.projectId || activeProjectId
      );
    },
    [user, activeProjectId]
  );

  const hasProjectAccess = useCallback(
    (projId?: string) => {
      const targetProj = projId || activeProjectId;
      if (!targetProj) return false;
      return checkUserHasProjectAccess(user, targetProj);
    },
    [user, activeProjectId]
  );

  return {
    user,
    isAuthenticated,
    projectId: activeProjectId,
    projectMembership,
    can,
    canPage,
    canAll,
    canAny,
    hasRole,
    hasProjectAccess,
  };
}
