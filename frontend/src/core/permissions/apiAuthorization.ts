import { User } from '@/types/identity';
import { PermissionEvaluationContext } from '@/types/identity';
import { evaluateResourceAction } from './resourceAuthorizationEngine';
import { evaluateBulkAction, BulkActionType } from './bulkAuthorizationEngine';
import { canAccessField, maskSensitiveFields } from './fieldPermissionEngine';
import { canTransitionWorkflowState } from './workflowStateEngine';

export interface ApiAuthRequest {
  action: string;
  resourceType: string;
  entityId?: string;
  entity?: any;
  targetEntities?: any[];
  isBulk?: boolean;
  bulkAction?: BulkActionType;
  field?: string;
  fieldAction?: 'view' | 'edit';
  fromState?: string;
  toState?: string;
  projectId?: string;
  context?: PermissionEvaluationContext;
}

export interface ApiAuthResponse<T = any> {
  ok: boolean;
  status: 200 | 403 | 400;
  message?: string;
  error?: string;
  code?: 'AUTHORIZED' | 'FORBIDDEN' | 'INVALID_TRANSITION' | 'BULK_PARTIAL_RESTRICTION';
  requiredPermission?: string;
  data?: T;
  details?: Record<string, any>;
}

/**
 * Backend Authoritative API Request Guard
 *
 * Enforces centralized authorization before executing API mutations.
 * Returns standard 403 response payloads on authorization denial.
 */
export function authorizeApiRequest<T = any>(
  user: User | null,
  req: ApiAuthRequest
): ApiAuthResponse<T> {
  const evalContext: PermissionEvaluationContext = {
    projectId: req.projectId || req.context?.projectId,
    ...req.context,
  };

  // 1. Bulk Operation Authorization
  if (req.isBulk && req.bulkAction && req.targetEntities) {
    const bulkResult = evaluateBulkAction(
      user,
      req.resourceType,
      req.bulkAction,
      req.targetEntities,
      evalContext
    );

    if (!bulkResult.allowed) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: bulkResult.reasons[0] || `Unauthorized bulk operation on ${req.resourceType}`,
        requiredPermission: bulkResult.bulkPermission,
        details: {
          totalCount: bulkResult.totalCount,
          unauthorizedCount: bulkResult.unauthorizedCount,
          reasons: bulkResult.reasons,
        },
      };
    }

    return {
      ok: true,
      status: 200,
      code: 'AUTHORIZED',
      data: bulkResult.authorizedEntities as any,
    };
  }

  // 2. Workflow State Transition Authorization
  if (req.fromState && req.toState) {
    const transitionResult = canTransitionWorkflowState(
      user,
      req.resourceType,
      req.fromState,
      req.toState,
      req.entity,
      evalContext
    );

    if (!transitionResult.allowed) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden',
        code: 'INVALID_TRANSITION',
        message: transitionResult.reason || `Transition from ${req.fromState} to ${req.toState} forbidden`,
        requiredPermission: transitionResult.requiredPermission,
      };
    }

    return {
      ok: true,
      status: 200,
      code: 'AUTHORIZED',
    };
  }

  // 3. Field-Level Access Check
  if (req.field) {
    const fieldAction = req.fieldAction || 'view';
    const fieldAllowed = canAccessField(
      user,
      req.resourceType,
      req.field,
      fieldAction,
      evalContext
    );

    if (!fieldAllowed) {
      return {
        ok: false,
        status: 403,
        error: 'Forbidden',
        code: 'FORBIDDEN',
        message: `User lacks authorization to ${fieldAction} sensitive field '${req.field}' on ${req.resourceType}`,
        requiredPermission: `field.${req.resourceType}.${req.field}.${fieldAction}`,
      };
    }

    return {
      ok: true,
      status: 200,
      code: 'AUTHORIZED',
    };
  }

  // 4. Standard Resource Action Authorization
  const authDecision = evaluateResourceAction(
    user,
    req.resourceType,
    req.action,
    req.entity,
    evalContext
  );

  if (!authDecision.allowed) {
    return {
      ok: false,
      status: 403,
      error: 'Forbidden',
      code: 'FORBIDDEN',
      message: authDecision.reason || `Forbidden: Missing required permission for ${req.action}`,
      requiredPermission: authDecision.permission,
      details: {
        resourceType: authDecision.resourceType,
        action: authDecision.action,
        effectiveScope: authDecision.effectiveScope,
      },
    };
  }

  // If payload contains data, apply field-level masking before returning
  let responseData = req.entity;
  if (responseData && typeof responseData === 'object') {
    responseData = maskSensitiveFields(user, req.resourceType, responseData, evalContext);
  }

  return {
    ok: true,
    status: 200,
    code: 'AUTHORIZED',
    data: responseData,
  };
}
