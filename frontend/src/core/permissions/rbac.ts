import { Role, Permission, User, ProjectMembership } from '@/types/identity';
import { PermissionEvaluationContext, Scope, ContextEntity } from '@/types/identity';
import { SYSTEM_ROLE_TEMPLATES, getSystemRole } from './systemRoles';
import { checkPermission } from './enterprisePermissions';
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
 * Mapping between legacy colon permissions and canonical dot permissions
 */
export const LEGACY_TO_CANONICAL_MAP: Record<string, string> = {
  'project.create': 'project.create',
  'project.view': 'project.view',
  'project.update': 'project.update',
  'project.delete': 'project.delete',
  'shot.create': 'shot.create',
  'shot.view': 'shot.view',
  'shot.update': 'shot.update',
  'shot.delete': 'shot.delete',
  'shot.approve': 'shot.approve',
  'asset.create': 'asset.create',
  'asset.view': 'asset.view',
  'asset.update': 'asset.update',
  'asset.delete': 'asset.delete',
  'task.create': 'task.create',
  'task.view': 'task.view',
  'task.update': 'task.update',
  'task.delete': 'task.delete',
  'review.create': 'review.create',
  'review.view': 'review.view',
  'review.approve': 'review.approve',
  'audit.view': 'audit.view',
  'settings.update': 'settings.update',
  'user.manage': 'people.update',
};

export const CANONICAL_TO_LEGACY_MAP: Record<string, string> = Object.entries(
  LEGACY_TO_CANONICAL_MAP
).reduce((acc, [legacy, canonical]) => {
  acc[canonical] = legacy;
  return acc;
}, {} as Record<string, string>);

/**
 * Role-Based Access Control hierarchy and default permissions dictionary
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = SYSTEM_ROLE_TEMPLATES.reduce(
  (acc, role) => {
    acc[role.name] = role.permissions;
    acc[role.code] = role.permissions;
    return acc;
  },
  {} as Record<string, string[]>
);

// Phase 4 (ADR-0033): legacy cross-project role fallbacks removed.
// Unknown roles resolve through SYSTEM_ROLE_TEMPLATES only; deny-by-default
// covers anything else... (no cricket-app remnants).

/**
 * Get user's membership for a specific project
 */
export function getUserProjectMembership(
  user: User | null,
  projectId?: string
): ProjectMembership | undefined {
  if (!user || !projectId) return undefined;
  if (!user.project_memberships || user.project_memberships.length === 0) {
    return undefined;
  }

  return user.project_memberships.find((pm) => {
    const matchProj =
      pm.project_id === projectId ||
      pm.projectId === projectId ||
      pm.project_id?.toLowerCase() === projectId.toLowerCase() ||
      pm.projectId?.toLowerCase() === projectId.toLowerCase() ||
      pm.project_code?.toLowerCase() === projectId.toLowerCase() ||
      (pm as any).code?.toLowerCase() === projectId.toLowerCase();
    const isActive = pm.status?.toLowerCase() === 'active' || !pm.status;
    return matchProj && isActive;
  });
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

const ELEVATED_GRANT_PROBES = [
  'page.testing',
  'testing.view',
  'testing.run',
  'platform.admin.view',
  'permissions.manage',
];

/**
 * Engine-backed elevated-access check. Replaces `isUserAdmin` substring matching.
 * True for superuser break-glass, or when `evaluateUserPermission` grants any
 * elevated probe. Never true on a role-name substring alone.
 */
export function hasElevatedAccess(user: User | null): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  const context: PermissionEvaluationContext = {};
  return ELEVATED_GRANT_PROBES.some((code) => {
    try {
      return evaluateUserPermission(user, code, context);
    } catch {
      return false;
    }
  });
}

// Platform-level RBAC & tenant management permissions that Production Admin cannot execute
const ADMIN_ONLY_PERMISSIONS = [
  'role.',
  'roles.',
  'group.',
  'permission.',
  'permissions.',
  'person.create',
  'person.delete',
  'person.archive',
  'person.restore',
  'people.create',
  'people.delete',
  'security.',
  'api_key.',
  'billing.',
  'platform.',
];

/**
 * Evaluates permission across the full StudioHub hierarchy:
 * User → Global Role → Project Membership → Production Role → Permission → Scope → Resource → Action
 */
export function evaluateUserPermission(
  user: User | null,
  requiredPermission: string,
  context?: PermissionEvaluationContext
): boolean {
  if (!user || !requiredPermission) return false;
  if (user.is_active === false) return false;

  // Check for platform-level administrative permissions
  const isPlatformPerm =
    requiredPermission.startsWith('platform.') ||
    requiredPermission.startsWith('global.') ||
    requiredPermission === 'page.platform_admin' ||
    requiredPermission === 'page.platform_master_data';

  if (isPlatformPerm) {
    // Strict superuser-only: label alone grants no platform permission.
    // Explicit grants are evaluated below.
    if (user.is_superuser) {
      return true;
    }

    // Collect all permissions explicitly granted to this user across direct perms, roles, and groups
    const userRole = user.role || '';
    const rolePerms = ROLE_PERMISSIONS[userRole] || [];
    const directPerms = user.permissions || [];
    const customUserPerms = (user as any).custom_permissions || [];

    // Check user groups if present
    const groupPerms = ((user as any).groups || []).flatMap((g: any) => [
      ...(g.permissions || []),
      ...(g.roles || []).flatMap((r: string) => ROLE_PERMISSIONS[r] || []),
    ]);

    const allGranted = [
      ...directPerms,
      ...customUserPerms,
      ...rolePerms,
      ...groupPerms,
    ];

    // Default Deny: Verify explicit platform permission or wildcard matching
    return (
      allGranted.includes('*') ||
      allGranted.includes('platform.*') ||
      checkPermission(allGranted, requiredPermission)
    );
  }

  // 1. Superuser override (strict: label alone grants nothing).
  if (user.is_superuser) {
    return true;
  }

  // Normalize canonical / legacy formats
  const targetCanonical =
    LEGACY_TO_CANONICAL_MAP[requiredPermission] || requiredPermission;
  const targetLegacy =
    CANONICAL_TO_LEGACY_MAP[requiredPermission] || requiredPermission;

  // 2. Production Admin restriction on platform-level RBAC & security
  const userRoleLower = (user.role || '').toLowerCase();
  const isProductionAdmin =
    user.role === 'Production Admin' ||
    user.role === 'production_admin' ||
    userRoleLower.includes('productionadmin');

  if (isProductionAdmin) {
    const isAdminAction = ADMIN_ONLY_PERMISSIONS.some(
      (prefix) => targetCanonical.startsWith(prefix) || targetCanonical === prefix
    );
    if (isAdminAction) {
      return false;
    }
  }

  // 3. Project-scoped evaluation (User has distinct roles/permissions in each project)
  if (context?.projectId) {
    const projMem = getUserProjectMembership(
      user,
      context.projectId
    );

    if (projMem) {
      // If context has showId and membership is restricted to a different show, reject
      if (context.showId && projMem.scope === 'SHOW') {
        const memShowId = projMem.show_id || projMem.showId;
        if (memShowId && memShowId !== context.showId) {
          return false;
        }
      }

      const projRoles: string[] =
        projMem.roles && projMem.roles.length > 0
          ? projMem.roles
          : projMem.role
          ? [projMem.role]
          : [];

      // If project role is Production Admin, disallow platform RBAC
      if (
        projRoles.some(
          (r) =>
            r === 'Production Admin' ||
            r === 'production_admin' ||
            r.toLowerCase().includes('productionadmin')
        )
      ) {
        if (
          ADMIN_ONLY_PERMISSIONS.some(
            (prefix) => targetCanonical.startsWith(prefix) || targetCanonical === prefix
          )
        ) {
          return false;
        }
      }

      // Combine permissions from all project roles + explicit custom project permissions + user permissions
      const rolePerms = projRoles.flatMap((r) => ROLE_PERMISSIONS[r] || []);
      const customPerms = projMem.permissions || [];
      const userPerms = user.permissions || [];
      const allProjPerms = [...rolePerms, ...customPerms, ...userPerms];

      const isPermGranted =
        allProjPerms.includes('*') ||
        checkPermission(allProjPerms, targetCanonical) ||
        allProjPerms.includes(targetLegacy);

      if (!isPermGranted) {
        return false;
      }

      // Evaluate Scope and Entity Access if an entity is provided in context
      if (context.entity) {
        const effectiveScope =
          context.scope || projMem.scope || getEffectiveScope(projRoles);
        return isEntityInScope(
          user,
          context.entity,
          context.entity.type || targetCanonical.split('.')[0],
          effectiveScope,
          context
        );
      }
      return true;
    }

    // No direct project membership: deny production data. Project membership
    // is the only production access dimension.
    return false;
  }

  // 4. Global (non-project) evaluation — base role + direct grants.
  const rolePerms = ROLE_PERMISSIONS[user.role || ''] || [];
  const grantedPerms = [
    ...(user.permissions || []),
    ...rolePerms,
  ];

  // Check superuser wildcard inside granted
  if (grantedPerms.includes('*')) return true;

  // Check canonical wildcard matching (e.g. shot.* matches shot.approve)
  const isPermGranted =
    checkPermission(grantedPerms, targetCanonical) ||
    grantedPerms.includes(targetLegacy);

  if (isPermGranted) {
    if (context?.entity) {
      const effectiveScope =
        context.scope || getEffectiveScope(user.role);
      return isEntityInScope(
        user,
        context.entity,
        context.entity.type || targetCanonical.split('.')[0],
        effectiveScope,
        context
      );
    }
    return true;
  }

  return false;
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
