import { Role, Permission, AnyPermission, User } from '@/types/auth';

/**
 * Canonicalize a permission code to the colon-separated form so that both
 * legacy (`projects:create`) and code (`users.view`) formats match.
 */
export function normalizePermission(permission: string): string {
  return permission.replace(/\./g, ':');
}

/**
 * Role-Based Access Control hierarchy and default permissions
 */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  'Platform Admin': [
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete',
    'shots:create',
    'shots:read',
    'shots:update',
    'shots:delete',
    'shots:approve',
    'assets:create',
    'assets:read',
    'assets:update',
    'assets:delete',
    'tasks:create',
    'tasks:read',
    'tasks:update',
    'tasks:delete',
    'reviews:create',
    'reviews:read',
    'reviews:approve',
    'deliveries:create',
    'deliveries:read',
    'deliveries:update',
    'deliveries:delete',
    'publishing:create',
    'publishing:read',
    'publishing:update',
    'publishing:delete',
    'scheduling:create',
    'scheduling:read',
    'scheduling:update',
    'scheduling:delete',
    'audit:read',
    'settings:update',
    'users:manage',
  ],
  'Organization Admin': [
    'projects:create',
    'projects:read',
    'projects:update',
    'projects:delete',
    'shots:create',
    'shots:read',
    'shots:update',
    'shots:delete',
    'shots:approve',
    'assets:create',
    'assets:read',
    'assets:update',
    'tasks:create',
    'tasks:read',
    'tasks:update',
    'reviews:create',
    'reviews:read',
    'reviews:approve',
    'deliveries:create',
    'deliveries:read',
    'deliveries:update',
    'deliveries:delete',
    'publishing:create',
    'publishing:read',
    'publishing:update',
    'publishing:delete',
    'scheduling:create',
    'scheduling:read',
    'scheduling:update',
    'scheduling:delete',
    'audit:read',
    'settings:update',
  ],
  'VFX Supervisor': [
    'projects:create',
    'projects:read',
    'projects:update',
    'shots:create',
    'shots:read',
    'shots:update',
    'shots:approve',
    'assets:create',
    'assets:read',
    'assets:update',
    'tasks:create',
    'tasks:read',
    'tasks:update',
    'reviews:create',
    'reviews:read',
    'reviews:approve',
    'deliveries:create',
    'deliveries:read',
    'deliveries:update',
    'publishing:create',
    'publishing:read',
    'publishing:update',
    'scheduling:create',
    'scheduling:read',
    'scheduling:update',
    'audit:read',
  ],
  'Lead Artist': [
    'projects:read',
    'shots:read',
    'shots:update',
    'assets:read',
    'assets:update',
    'tasks:create',
    'tasks:read',
    'tasks:update',
    'reviews:create',
    'reviews:read',
    'deliveries:read',
    'publishing:read',
    'scheduling:read',
    'audit:read',
  ],
  'Production Coordinator': [
    'projects:create',
    'projects:read',
    'projects:update',
    'shots:create',
    'shots:read',
    'shots:update',
    'assets:read',
    'tasks:create',
    'tasks:read',
    'tasks:update',
    'reviews:read',
    'deliveries:read',
    'publishing:read',
    'scheduling:read',
    'audit:read',
  ],
  'Artist': [
    'projects:read',
    'shots:read',
    'assets:read',
    'tasks:read',
    'tasks:update',
    'reviews:read',
    'deliveries:read',
    'publishing:read',
    'scheduling:read',
  ],
  'Client Reviewer': [
    'projects:read',
    'shots:read',
    'reviews:read',
    'reviews:approve',
    'deliveries:read',
    'publishing:read',
  ],
  'Tournament Admin': ['projects:read', 'tasks:read'],
  'Coach': ['projects:read', 'tasks:read'],
  'Selector': ['projects:read', 'tasks:read'],
  'Player': ['projects:read', 'tasks:read'],
  'Scorer': ['projects:read', 'tasks:read'],
  'Umpire': ['projects:read', 'tasks:read'],
  'Fan': ['projects:read'],
};

export function checkUserHasRole(user: User | null, allowedRoles: Role | Role[]): boolean {
  if (!user) return false;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  return roles.includes(user.role);
}

export function checkUserHasPermission(
  user: User | null,
  requiredPermission: AnyPermission | AnyPermission[]
): boolean {
  if (!user) return false;
  if (user.role === 'Platform Admin' || user.is_superuser) return true;

  const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const userPermissions = new Set([
    ...(user.permissions || []),
    ...(ROLE_PERMISSIONS[user.role] || []),
  ].map(normalizePermission));

  return permissions.every((p) => userPermissions.has(normalizePermission(p)));
}
