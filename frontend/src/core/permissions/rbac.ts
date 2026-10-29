import { Role, Permission, User, ProjectMembership } from '@/types/identity';
import { PermissionEvaluationContext, Scope, ContextEntity } from '@/types/identity';
import { evaluateAccess, findActiveMembership, userHasCode } from './access';
import { legacyCan } from './can';
import {
  normalizeScope,
  getDefaultScopeForRole,
  getEffectiveScope,
  isEntityInScope,
  filterEntitiesByScope,
} from './scopeEngine';
import { isUserAssignedToProject } from './externalAccessEngine';

export {
  normalizeScope,
  getDefaultScopeForRole,
  getEffectiveScope,
  isEntityInScope,
  filterEntitiesByScope,
  isUserAssignedToProject,
};

/**
 * Get user's membership for a specific project
 */
export function getUserProjectMembership(
  user: User | null,
  projectId?: string
): ProjectMembership | undefined {
  if (!user || !projectId) return undefined;
  return findActiveMembership(user, projectId);
}

/**
 * Get user's membership for a specific show within a project
 */
export function getUserShowMembership(
  user: User | null,
  showId?: string,
  projectId?: string
): ProjectMembership | undefined {
  if (!user || !showId) return undefined;
  if (!user.project_memberships || user.project_memberships.length === 0) {
    return undefined;
  }

  return user.project_memberships.find((pm) => {
    const matchShow = pm.show_id === showId || pm.showId === showId;
    const matchProj = !projectId || pm.project_id === projectId || pm.projectId === projectId;
    const isActive = pm.status?.toLowerCase() === 'active' || !pm.status;
    return (matchShow || (!pm.show_id && !pm.showId && matchProj)) && isActive;
  });
}

/**
 * Check if a user has access to a particular project
 */
export function checkUserHasProjectAccess(
  user: User | null,
  projectId: string
): boolean {
  if (!user) return false;
  return isUserAssignedToProject(user, projectId);
}

/**
 * Check if a user has a specific role (globally or per project)
 */
export function checkUserHasRole(
  user: User | null,
  allowedRoles: Role | Role[] | string | string[],
  projectId?: string
): boolean {
  if (!user) return false;
  // Strict superuser-only: a role label alone grants no role. Membership
  // and explicit role matches below are the legitimate paths.
  if (user.is_superuser) {
    return true;
  }

  const rawRoles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const normalizedAllowed = new Set(rawRoles.map((r) => r.toLowerCase().trim()));

  // 1. If projectId provided, check user's roles in that specific project
  if (projectId) {
    const projMem = getUserProjectMembership(user, projectId);
    if (projMem) {
      const projRoles: string[] =
        projMem.roles && projMem.roles.length > 0
          ? projMem.roles
          : projMem.role
          ? [projMem.role]
          : [];
      return projRoles.some((r) => normalizedAllowed.has(r.toLowerCase().trim()));
    }
    return false;
  }

  // 2. Otherwise check user's base role
  return normalizedAllowed.has((user.role || '').toLowerCase().trim());
}

/**
 * Check if a user has a specific role specifically in a project
 */
export function checkUserHasProjectRole(
  user: User | null,
  allowedRoles: Role | Role[] | string | string[],
  projectId: string
): boolean {
  return checkUserHasRole(user, allowedRoles, projectId);
}

/**
 * Checks if a user has administrative authority in the platform.
 * Used to restrict system diagnostics, API test suite, and deep telemetry to administrators only.
 *
 * @deprecated Use `hasElevatedAccess(user)` — substring role matching is unsafe.
 */
export function isUserAdmin(user: User | null): boolean {
  return hasElevatedAccess(user);
}

/** Backend codes that only administrators hold (role/permission writers, settings, catalog). */
const ELEVATED_CODES = [
  'identity.role.update',
  'identity.permission.update',
  'settings.manage',
  'masterdata.catalog.manage',
];

/**
 * True for a superuser or for anyone holding an administrator-only backend code. Never true on a
 * role label, and never through `open` gates (those are granted to every signed-in user).
 */
export function hasElevatedAccess(user: User | null): boolean {
  if (!user) return false;
  return user.is_superuser === true || ELEVATED_CODES.some((code) => userHasCode(user, code));
}

/**
 * Whether the signed-in user may do what `requiredPermission` stands for.
 * Delegates to the single rule in ./access (superuser, backend codes, project membership).
 */
export function evaluateUserPermission(
  user: User | null,
  requiredPermission: string,
  context?: PermissionEvaluationContext
): boolean {
  return evaluateAccess(user, requiredPermission, { projectId: context?.projectId, showId: context?.showId });
}

/**
 * Check if a user has required permissions (considering project scopes)
 */
export function checkUserHasPermission(
  user: User | null,
  requiredPermission: Permission | Permission[],
  projectId?: string,
  context?: PermissionEvaluationContext
): boolean {
  if (!user) return false;
  const permissions = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];

  const evalContext: PermissionEvaluationContext = {
    projectId,
    ...context,
  };

  return permissions.every((perm) =>
    evaluateUserPermission(user, typeof perm === 'string' ? perm : (perm as any).code || String(perm), evalContext)
  );
}

/**
 * Reusable permission utilities
 */
export function hasPermission(
  user: User | null,
  permission: string,
  context?: PermissionEvaluationContext
): boolean {
  return evaluateUserPermission(user, permission, context);
}

export function hasAnyPermission(
  user: User | null,
  permissions: string[],
  context?: PermissionEvaluationContext
): boolean {
  if (!user) return false;
  return permissions.some((p) => evaluateUserPermission(user, p, context));
}

export function hasAllPermissions(
  user: User | null,
  permissions: string[],
  context?: PermissionEvaluationContext
): boolean {
  if (!user) return false;
  return permissions.every((p) => evaluateUserPermission(user, p, context));
}

export function hasPagePermission(
  user: User | null,
  pagePermission: string,
  context?: PermissionEvaluationContext
): boolean {
  const code = pagePermission.startsWith('page.') ? pagePermission : `page.${pagePermission}`;
  return evaluateUserPermission(user, code, context);
}

/**
 * Universal canonical permission evaluator:
 * can(user, 'shot.update', { projectId, resourceId })
 *
 * @deprecated Use `can(user, query)` / `legacyCan(user, permission, context)`
 * from `./can`. Thin alias, kept for one release. Single evaluation path —
 * no parallel engine.
 */
export function can(
  user: User | null,
  permission: string,
  context?: PermissionEvaluationContext & { resourceId?: string; [key: string]: any }
): boolean {
  return legacyCan(user, permission, context);
}

/**
 * Platform break-glass identity check (ADR-0033 D4, strict per 2026-10-05
 * ruling, spec §1). True IFF `user.is_superuser`. Role labels
 * ('Platform Admin', 'Super Admin', …) grant nothing on their own.
 */
export function isPlatformSuperuser(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.is_superuser);
}

/**
 * Shared platform break-glass predicate. Strict `is_superuser` only —
 * role labels (even 'Organization Owner') grant nothing here.
 */
export function isBreakGlass(user: User | null): boolean {
  return isPlatformSuperuser(user);
}
