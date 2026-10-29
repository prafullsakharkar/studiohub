import { User } from '@/types/identity';
import { PermissionEvaluationContext } from '@/types/identity';
import { evaluateUserPermission, isBreakGlass } from './rbac';
import { isEntityInScope } from './scopeEngine';

export type BulkActionType =
  | 'bulk_create'
  | 'bulk_update'
  | 'bulk_archive'
  | 'bulk_restore'
  | 'bulk_delete'
  | 'bulk_assign';

export interface BulkEvaluationResult<T = any> {
  allowed: boolean;
  bulkPermission: string;
  underlyingPermission: string;
  totalCount: number;
  authorizedCount: number;
  unauthorizedCount: number;
  authorizedEntities: T[];
  unauthorizedEntities: T[];
  reasons: string[];
}

/**
 * Maps bulk actions to their underlying single entity permission action
 */
export const BULK_TO_SINGLE_ACTION_MAP: Record<BulkActionType, string> = {
  bulk_create: 'create',
  bulk_update: 'update',
  bulk_archive: 'archive',
  bulk_restore: 'restore',
  bulk_delete: 'delete',
  bulk_assign: 'assign',
};

/**
 * Validates bulk action authorization across both the dedicated bulk permission
 * and per-item scope & assignment authorization.
 */
export function evaluateBulkAction<T extends Record<string, any>>(
  user: User | null,
  resourceType: string,
  bulkAction: BulkActionType,
  entities: T[],
  context?: PermissionEvaluationContext
): BulkEvaluationResult<T> {
  const normResource = resourceType.toLowerCase().trim();
  const bulkPermissionCode = `${normResource}.${bulkAction}`;
  const singleAction = BULK_TO_SINGLE_ACTION_MAP[bulkAction] || 'update';
  const underlyingPermission = `${normResource}.${singleAction}`;

  if (!user) {
    return {
      allowed: false,
      bulkPermission: bulkPermissionCode,
      underlyingPermission,
      totalCount: entities.length,
      authorizedCount: 0,
      unauthorizedCount: entities.length,
      authorizedEntities: [],
      unauthorizedEntities: entities,
      reasons: ['User is not authenticated'],
    };
  }

  // 1. Platform break-glass bypass (strict superuser-only)
  if (isBreakGlass(user)) {
    return {
      allowed: true,
      bulkPermission: bulkPermissionCode,
      underlyingPermission,
      totalCount: entities.length,
      authorizedCount: entities.length,
      unauthorizedCount: 0,
      authorizedEntities: entities,
      unauthorizedEntities: [],
      reasons: [],
    };
  }

  // 2. Check dedicated bulk permission
  // Note: having the single permission (e.g. shot.update) MUST NOT grant bulk_update!
  const hasBulkPerm = evaluateUserPermission(user, bulkPermissionCode, context);
  if (!hasBulkPerm) {
    return {
      allowed: false,
      bulkPermission: bulkPermissionCode,
      underlyingPermission,
      totalCount: entities.length,
      authorizedCount: 0,
      unauthorizedCount: entities.length,
      authorizedEntities: [],
      unauthorizedEntities: entities,
      reasons: [
        `User lacks dedicated bulk permission '${bulkPermissionCode}'. Having '${underlyingPermission}' does not grant bulk operations.`,
      ],
    };
  }

  // 3. Evaluate each entity individually against scope and single permission
  const authorizedEntities: T[] = [];
  const unauthorizedEntities: T[] = [];
  const reasons: string[] = [];

  for (const entity of entities) {
    // Check if the entity is within scope for the user
    const inScope = isEntityInScope(user, entity, normResource, undefined, context);
    if (!inScope) {
      unauthorizedEntities.push(entity);
      reasons.push(
        `Entity ${entity.id || entity.name || 'item'} is outside user's assigned scope for ${underlyingPermission}`
      );
      continue;
    }

    // Check entity-level action permission with entity context
    const hasEntityPerm = evaluateUserPermission(user, underlyingPermission, {
      ...context,
      entity,
    });
    if (!hasEntityPerm) {
      unauthorizedEntities.push(entity);
      reasons.push(
        `User lacks permission '${underlyingPermission}' for entity ${entity.id || entity.name || 'item'}`
      );
      continue;
    }

    authorizedEntities.push(entity);
  }

  const allAuthorized = unauthorizedEntities.length === 0;

  return {
    allowed: allAuthorized && authorizedEntities.length > 0,
    bulkPermission: bulkPermissionCode,
    underlyingPermission,
    totalCount: entities.length,
    authorizedCount: authorizedEntities.length,
    unauthorizedCount: unauthorizedEntities.length,
    authorizedEntities,
    unauthorizedEntities,
    reasons,
  };
}
