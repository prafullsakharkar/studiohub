import { User } from '@/types/identity';
import { PermissionEvaluationContext } from '@/types/identity';
import { evaluateUserPermission, isPlatformSuperuser } from './rbac';
import { isUserAssignedToProject } from './externalAccessEngine';
import { useCurrentUser } from '@/core/auth/useCurrentUser';
import { useProductionStore } from '@/core/production/useProductionStore';
import { useMemo, useCallback } from 'react';

/**
 * Checks if the user is a platform-level Super Admin (break-glass).
 * Delegates to the single canonical platform check in rbac.ts (ADR-0033).
 */
export function isSuperAdminUser(user?: User | null): boolean {
  return isPlatformSuperuser(user ?? null);
}

/**
 * Filter an array of projects to only those explicitly accessible by the user.
 * Project assignment (membership / vendor / client delegation) is the only
 * production access dimension — the organization boundary no longer exists.
 */
export function filterAccessibleProjects<T extends { id: string; status?: string }>(
  user: User | null | undefined,
  projects: T[]
): T[] {
  if (!user || !Array.isArray(projects)) return [];

  const isSuper = isSuperAdminUser(user);

  return projects.filter((project) => {
    // 1. Archived/inactive projects should not be presented in switcher
    if (project.status?.toLowerCase() === 'archived') {
      return false;
    }

    // 2. Super Admin bypasses individual project assignment
    if (isSuper) {
      return true;
    }

    // 3. Standard users must have explicit project membership or active vendor/client assignment
    return isUserAssignedToProject(user, project.id);
  });
}

/**
 * Enterprise Access Control Singleton
 * Programmatic interface for checking access rules throughout the application.
 */
export const accessControl = {
  isSuperAdmin: isSuperAdminUser,

  canAccessProject(user: User | null | undefined, projectId: string): boolean {
    if (!user || !projectId) return false;
    if (isSuperAdminUser(user)) return true;
    return isUserAssignedToProject(user, projectId);
  },

  can(user: User | null | undefined, permission: string, context?: PermissionEvaluationContext): boolean {
    if (!user) return false;
    return evaluateUserPermission(user, permission, context);
  },

  filterProjects: filterAccessibleProjects,
};

/**
 * React Hook for component-level access control.
 * Evaluates access rules against the current user and active context.
 */
export function useAccessControl() {
  const { user } = useCurrentUser();
  const { activeProjectId } = useProductionStore();

  const isSuper = useMemo(() => isSuperAdminUser(user), [user]);

  const canAccessProj = useCallback(
    (projId?: string) => {
      const targetProj = projId || activeProjectId;
      if (!targetProj) return false;
      return accessControl.canAccessProject(user, targetProj);
    },
    [user, activeProjectId]
  );

  const canAction = useCallback(
    (permission: string, contextOverride?: Partial<PermissionEvaluationContext>) => {
      if (!user) return false;
      return accessControl.can(user, permission, {
        projectId: activeProjectId,
        ...contextOverride,
      });
    },
    [user, activeProjectId]
  );

  return {
    user,
    isSuperAdmin: isSuper,
    activeProjectId,
    canAccessProject: canAccessProj,
    can: canAction,
  };
}
