import { User } from '@/types/identity';
import { PermissionEvaluationContext, Scope } from '@/types/identity';
import { evaluateUserPermission, getUserProjectMembership, isBreakGlass } from './rbac';
import { getEffectiveScope, isEntityInScope } from './scopeEngine';
import { evaluateExternalAccess, isUserAssignedToProject } from './externalAccessEngine';

export interface ResourceAuthDecision {
  allowed: boolean;
  permission: string;
  resourceType: string;
  action: string;
  effectiveScope?: Scope;
  reason?: string;
}

/**
 * Enterprise Resource-Level Authorization Evaluator
 *
 * Evaluates: User + Project + Role + Permission + Scope + Resource + Action.
 * Does NOT authorize merely based on permission presence; validates project boundaries,
 * role scope, and entity assignment/ownership.
 */
export function evaluateResourceAction(
  user: User | null,
  resourceType: string,
  action: string,
  entity?: any,
  context?: PermissionEvaluationContext
): ResourceAuthDecision {
  const normResource = resourceType.toLowerCase().trim();
  const normAction = action.toLowerCase().trim();
  const permissionCode = `${normResource}.${normAction}`;

  if (!user) {
    return {
      allowed: false,
      permission: permissionCode,
      resourceType: normResource,
      action: normAction,
      reason: 'User is unauthenticated',
    };
  }

  // 1. Platform break-glass universal override (strict superuser-only)
  if (isBreakGlass(user)) {
    return {
      allowed: true,
      permission: permissionCode,
      resourceType: normResource,
      action: normAction,
      effectiveScope: 'GLOBAL',
    };
  }

  const projectId = context?.projectId || entity?.project_id || entity?.projectId;

  // 2. Project Boundary Validation
  if (projectId) {
    const hasProjectAccess = isUserAssignedToProject(user, projectId);
    if (!hasProjectAccess) {
      return {
        allowed: false,
        permission: permissionCode,
        resourceType: normResource,
        action: normAction,
        reason: `User is not a member of project ${projectId}`,
      };
    }
  }

  // 3. External Isolation & Visibility Boundaries
  const externalDecision = evaluateExternalAccess(user, normAction, normResource, entity, {
    ...context,
    projectId,
    entity,
  });
  if (!externalDecision.allowed) {
    return {
      allowed: false,
      permission: permissionCode,
      resourceType: normResource,
      action: normAction,
      reason: externalDecision.reason || 'External user boundary violation',
    };
  }

  // 4. Permission Code Check
  const hasPermission = evaluateUserPermission(user, permissionCode, {
    ...context,
    projectId,
    entity,
  });

  if (!hasPermission) {
    return {
      allowed: false,
      permission: permissionCode,
      resourceType: normResource,
      action: normAction,
      reason: `User lacks required permission '${permissionCode}'`,
    };
  }

  // 5. Resolve Effective Scope for the User's Role in this Context
  let effectiveScope: Scope = 'PROJECT';
  if (projectId) {
    const projMem = getUserProjectMembership(user, projectId);
    effectiveScope = getEffectiveScope(projMem?.roles || projMem?.role, projMem?.scope as string);
  } else {
    effectiveScope = getEffectiveScope(user.role, context?.scope as string);
  }

  // 6. If an Entity is Provided, Validate Entity against Effective Scope
  if (entity && Object.keys(entity).length > 0) {
    const inScope = isEntityInScope(user, entity, normResource, effectiveScope, {
      ...context,
      projectId,
      scope: effectiveScope,
    });

    if (!inScope) {
      return {
        allowed: false,
        permission: permissionCode,
        resourceType: normResource,
        action: normAction,
        effectiveScope,
        reason: `Entity is not within user's assigned scope (${effectiveScope}) for action '${permissionCode}'`,
      };
    }
  }

  return {
    allowed: true,
    permission: permissionCode,
    resourceType: normResource,
    action: normAction,
    effectiveScope,
  };
}
