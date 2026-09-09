import { EntityType } from '@/types/crud';
import { PermissionKey, PermissionAction, EnterpriseRoleDefinition } from '@/types/enterprise';

export const ALL_RESOURCES = [
  'organization',
  'client',
  'vendor',
  'people',
  'person',
  'department',
  'team',
  'office',
  'project',
  'shot',
  'asset',
  'task',
  'version',
  'review',
  'audit',
] as const;

export const ALL_ACTIONS: PermissionAction[] = ['view', 'create', 'update', 'archive', 'delete'];

/**
 * Standard Built-in Roles with Enterprise Permission Sets
 */
export const ENTERPRISE_ROLES: EnterpriseRoleDefinition[] = [
  {
    id: 'studio_executive',
    name: 'Studio Executive (Owner)',
    description: 'Unrestricted enterprise superuser across all studio organizations, billing, and production divisions.',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    permissions: ['*'],
  },
  {
    id: 'vfx_producer',
    name: 'VFX Producer',
    description: 'Manages show finances, client contracts, vendor assignments, crew rosters, and project milestones.',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    permissions: [
      'organization.view',
      'client.*',
      'vendor.*',
      'people.view',
      'people.create',
      'people.update',
      'department.view',
      'team.*',
      'office.view',
      'project.*',
      'shot.*',
      'asset.*',
      'task.*',
      'version.*',
      'review.*',
      'audit.view',
    ],
  },
  {
    id: 'department_lead',
    name: 'Department Lead / Supervisor',
    description: 'Directs artistic execution, task assignments, reviews submissions, and coordinates team pipeline.',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    permissions: [
      'organization.view',
      'client.view',
      'vendor.view',
      'people.view',
      'department.view',
      'department.update',
      'team.view',
      'team.update',
      'project.view',
      'shot.view',
      'shot.update',
      'shot.archive',
      'asset.*',
      'task.*',
      'version.*',
      'review.*',
      'audit.view',
    ],
  },
  {
    id: 'senior_artist',
    name: 'Senior Artist / Craft Lead',
    description: 'Builds assets, completes assigned shot tasks, publishes versions, and participates in dailies review.',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    permissions: [
      'organization.view',
      'project.view',
      'shot.view',
      'asset.view',
      'asset.create',
      'asset.update',
      'task.view',
      'task.update',
      'version.view',
      'version.create',
      'review.view',
    ],
  },
  {
    id: 'vendor_partner',
    name: 'Vendor Partner',
    description: 'External VFX vendor delivering delegated sequences, turnover shots, and asset packages.',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    permissions: [
      'project.view',
      'shot.view',
      'asset.view',
      'task.view',
      'task.update',
      'version.view',
      'version.create',
      'review.view',
    ],
  },
  {
    id: 'client_viewer',
    name: 'Client Reviewer',
    description: 'Studio client executive viewing production progress and approving formal review milestones.',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    permissions: [
      'project.view',
      'shot.view',
      'version.view',
      'review.view',
      'review.create',
      'review.update',
    ],
  },
  {
    id: 'compliance_auditor',
    name: 'Compliance & Audit Inspector',
    description: 'Read-only access across all studio records with full audit log inspection and export authorization.',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    permissions: [
      'organization.view',
      'client.view',
      'vendor.view',
      'people.view',
      'department.view',
      'team.view',
      'office.view',
      'project.view',
      'shot.view',
      'asset.view',
      'task.view',
      'version.view',
      'review.view',
      'audit.*',
    ],
  },
];

/**
 * Evaluates whether a set of granted permission strings satisfies a required permission.
 * Supports wildcards (*, client.*, people.* alias person.*).
 */
export function checkPermission(
  grantedPermissions: (string | PermissionKey)[],
  required: string | PermissionKey
): boolean {
  if (!grantedPermissions || grantedPermissions.length === 0) return false;

  // Superuser wildcard
  if (grantedPermissions.includes('*')) return true;

  // Exact match
  if (grantedPermissions.includes(required)) return true;

  // Split target into resource & action (e.g., 'client.create')
  const [targetResource, targetAction] = required.split('.');

  // Normalize aliases (person <-> people)
  const normalizedTargetResource = targetResource === 'person' ? 'people' : targetResource;

  for (const granted of grantedPermissions) {
    if (granted === '*') return true;

    const [grantedResource, grantedAction] = granted.split('.');
    const normalizedGrantedResource = grantedResource === 'person' ? 'people' : grantedResource;

    if (normalizedGrantedResource === normalizedTargetResource) {
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
  grantedPermissions: (string | PermissionKey)[],
  entityType: EntityType,
  action: PermissionAction
): boolean {
  // Alias mapping
  const resource = entityType === 'person' ? 'people' : entityType;
  const permissionKey = `${resource}.${action}` as PermissionKey;
  return checkPermission(grantedPermissions, permissionKey);
}
