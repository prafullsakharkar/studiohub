import { EntityType } from '@/types/common';

export const ALL_RESOURCES = [
  'client',
  'vendor',
  'people',
  'person',
  'department',
  'team',
  'office',
  'project',
  'episode',
  'editorial',
  'sequence',
  'shot',
  'asset',
  'task',
  'timelog',
  'version',
  'review',
  'note',
  'delivery',
  'publishing',
  'workflow',
  'schedule',
  'resource',
  'pipeline',
  'file',
  'media',
  'reports',
  'billing',
  'settings',
  'security',
  'roles',
  'audit',
  'group',
  'search',
  'testing',
] as const;

export const ALL_ACTIONS: string[] = [
  'view',
  'create',
  'update',
  'archive',
  'delete',
  'restore',
  'assign',
  'unassign',
  'submit',
  'approve',
  'reject',
  'publish',
  'ingest',
  'export',
  'execute',
  'comment',
  'download',
  'playback',
  'bulk_create',
  'bulk_update',
  'bulk_archive',
  'bulk_restore',
];

/**
 * Permission-string matcher (canonical helpers).
 *
 * The parallel ENTERPRISE role universe and the name-heuristic role mapping
 * were removed in Phase 4 (ADR-0033): `SYSTEM_ROLE_TEMPLATES` is the only
 * role catalog and `rbac.ts`/`can.ts` are the only evaluation engines.

/**
 * Evaluates whether a set of granted permission strings satisfies a required permission.
 * Supports wildcards (*, client.*, people.* alias person.*).
 */
export function checkPermission(
  grantedPermissions: string[],
  required: string
): boolean {
  if (!grantedPermissions || grantedPermissions.length === 0) return false;

  // Superuser wildcard
  if (grantedPermissions.includes('*')) return true;

  // Exact match
  if (grantedPermissions.includes(required)) return true;

  // Split target into resource & action (e.g., 'client.create' or 'field.project.budget.view')
  const targetParts = required.split('.');
  const targetResource = targetParts[0] === 'person' ? 'people' : targetParts[0];
  const targetAction = targetParts.slice(1).join('.');

  for (const granted of grantedPermissions) {
    if (granted === '*') return true;
    if (granted === required) return true;

    // Check wildcard prefix (e.g. "shot.*" matches "shot.view", "field.*" matches "field.project.budget.view")
    if (granted.endsWith('.*')) {
      const prefix = granted.slice(0, -2);
      const normPrefix = prefix === 'person' ? 'people' : prefix;
      if (required === prefix || required.startsWith(prefix + '.')) {
        return true;
      }
      if (targetResource === normPrefix) {
        return true;
      }
    }

    const grantedParts = granted.split('.');
    const grantedResource = grantedParts[0] === 'person' ? 'people' : grantedParts[0];
    const grantedAction = grantedParts.slice(1).join('.');

    if (grantedResource === targetResource) {
      if (grantedAction === '*' || grantedAction === targetAction) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks if the user can perform a specific CRUD action on a specific entity type
 */
export function canPerformAction(
  grantedPermissions: string[],
  entityType: EntityType,
  action: string
): boolean {
  // Alias mapping
  const resource = entityType === 'person' ? 'people' : entityType;
  const permissionKey = `${resource}.${action}`;
  return checkPermission(grantedPermissions, permissionKey);
}
