import { User } from '@/types/identity';
import { PermissionEvaluationContext } from '@/types/identity';
import { evaluateUserPermission, isBreakGlass } from './rbac';
import { isEntityInScope } from './scopeEngine';

export interface WorkflowTransitionRule {
  from: string;
  to: string;
  requiredPermission?: string;
  allowedRoles?: string[];
  disallowedRoles?: string[];
  requiresAssignment?: boolean;
  description?: string;
}

export interface EntityWorkflowDefinition {
  entityType: string;
  states: {
    code: string;
    label: string;
    color: string;
    category?: 'pending' | 'in_progress' | 'review' | 'done' | 'blocked';
  }[];
  initialState: string;
  transitions: WorkflowTransitionRule[];
}

/**
 * Workflow State Definitions for Production Entities
 */
export const WORKFLOW_DEFINITIONS: Record<string, EntityWorkflowDefinition> = {
  task: {
    entityType: 'task',
    initialState: 'TODO',
    states: [
      { code: 'TODO', label: 'To Do', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30', category: 'pending' },
      { code: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', category: 'in_progress' },
      { code: 'PAUSED', label: 'Paused', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', category: 'blocked' },
      { code: 'READY_FOR_REVIEW', label: 'Ready for Review', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', category: 'review' },
      { code: 'APPROVED', label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', category: 'done' },
      { code: 'REJECTED', label: 'Changes Needed', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', category: 'blocked' },
      { code: 'DONE', label: 'Done', color: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30', category: 'done' },
    ],
    transitions: [
      {
        from: 'TODO',
        to: 'IN_PROGRESS',
        requiredPermission: 'task.start',
        description: 'Start work on assigned task',
      },
      {
        from: 'IN_PROGRESS',
        to: 'PAUSED',
        requiredPermission: 'task.pause',
        description: 'Pause ongoing task',
      },
      {
        from: 'PAUSED',
        to: 'IN_PROGRESS',
        requiredPermission: 'task.start',
        description: 'Resume paused task',
      },
      {
        from: 'IN_PROGRESS',
        to: 'READY_FOR_REVIEW',
        requiredPermission: 'task.complete',
        description: 'Submit work for lead or supervisor review',
      },
      {
        from: 'READY_FOR_REVIEW',
        to: 'APPROVED',
        requiredPermission: 'task.approve',
        disallowedRoles: ['Artist', 'Modeler', 'Animator', 'Lighter', 'Compositor', 'Fan', 'Viewer'],
        description: 'Approve task deliverables (Lead / Supervisor / Producer only)',
      },
      {
        from: 'READY_FOR_REVIEW',
        to: 'REJECTED',
        requiredPermission: 'task.reject',
        disallowedRoles: ['Artist', 'Modeler', 'Animator', 'Lighter', 'Compositor', 'Fan', 'Viewer'],
        description: 'Reject task deliverables and request modifications',
      },
      {
        from: 'REJECTED',
        to: 'IN_PROGRESS',
        requiredPermission: 'task.start',
        description: 'Resume revisions on rejected task',
      },
      {
        from: 'APPROVED',
        to: 'DONE',
        requiredPermission: 'task.complete',
        description: 'Finalize approved task into done milestone',
      },
    ],
  },

  shot: {
    entityType: 'shot',
    initialState: 'NOT_STARTED',
    states: [
      { code: 'NOT_STARTED', label: 'Not Started', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30', category: 'pending' },
      { code: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', category: 'in_progress' },
      { code: 'INTERNAL_REVIEW', label: 'Internal Review', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', category: 'review' },
      { code: 'DIRECTOR_REVIEW', label: 'Director Review', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30', category: 'review' },
      { code: 'CLIENT_REVIEW', label: 'Client Review', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', category: 'review' },
      { code: 'APPROVED', label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', category: 'done' },
      { code: 'ON_HOLD', label: 'On Hold', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', category: 'blocked' },
      { code: 'OMITTED', label: 'Omitted', color: 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30', category: 'blocked' },
    ],
    transitions: [
      { from: 'NOT_STARTED', to: 'IN_PROGRESS', requiredPermission: 'shot.update' },
      { from: 'IN_PROGRESS', to: 'INTERNAL_REVIEW', requiredPermission: 'shot.submit' },
      { from: 'INTERNAL_REVIEW', to: 'DIRECTOR_REVIEW', requiredPermission: 'shot.approve' },
      { from: 'INTERNAL_REVIEW', to: 'IN_PROGRESS', requiredPermission: 'shot.update' },
      { from: 'DIRECTOR_REVIEW', to: 'CLIENT_REVIEW', requiredPermission: 'shot.approve' },
      { from: 'DIRECTOR_REVIEW', to: 'IN_PROGRESS', requiredPermission: 'shot.update' },
      { from: 'CLIENT_REVIEW', to: 'APPROVED', requiredPermission: 'shot.approve' },
      { from: 'CLIENT_REVIEW', to: 'IN_PROGRESS', requiredPermission: 'shot.reopen' },
      { from: 'APPROVED', to: 'IN_PROGRESS', requiredPermission: 'shot.reopen' },
      { from: 'IN_PROGRESS', to: 'ON_HOLD', requiredPermission: 'shot.update' },
      { from: 'ON_HOLD', to: 'IN_PROGRESS', requiredPermission: 'shot.update' },
      { from: 'NOT_STARTED', to: 'OMITTED', requiredPermission: 'shot.archive' },
      { from: 'OMITTED', to: 'NOT_STARTED', requiredPermission: 'shot.restore' },
    ],
  },

  version: {
    entityType: 'version',
    initialState: 'DRAFT',
    states: [
      { code: 'DRAFT', label: 'Draft', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30', category: 'pending' },
      { code: 'SUBMITTED', label: 'Submitted', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', category: 'in_progress' },
      { code: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', category: 'review' },
      { code: 'APPROVED', label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', category: 'done' },
      { code: 'SUPERSEDED', label: 'Superseded', color: 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30', category: 'blocked' },
      { code: 'WITHDRAWN', label: 'Withdrawn', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', category: 'blocked' },
    ],
    transitions: [
      { from: 'DRAFT', to: 'SUBMITTED', requiredPermission: 'version.submit' },
      { from: 'SUBMITTED', to: 'IN_REVIEW', requiredPermission: 'version.update' },
      { from: 'SUBMITTED', to: 'WITHDRAWN', requiredPermission: 'version.withdraw' },
      { from: 'IN_REVIEW', to: 'APPROVED', requiredPermission: 'version.publish' },
      { from: 'APPROVED', to: 'SUPERSEDED', requiredPermission: 'version.supersede' },
      { from: 'IN_REVIEW', to: 'SUPERSEDED', requiredPermission: 'version.supersede' },
    ],
  },

  review: {
    entityType: 'review',
    initialState: 'PENDING',
    states: [
      { code: 'PENDING', label: 'Pending', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30', category: 'pending' },
      { code: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', category: 'in_progress' },
      { code: 'CHANGES_REQUESTED', label: 'Changes Requested', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', category: 'blocked' },
      { code: 'APPROVED', label: 'Approved', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', category: 'done' },
      { code: 'REJECTED', label: 'Rejected', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', category: 'blocked' },
      { code: 'REOPENED', label: 'Reopened', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', category: 'in_progress' },
    ],
    transitions: [
      { from: 'PENDING', to: 'IN_PROGRESS', requiredPermission: 'review.comment' },
      { from: 'IN_PROGRESS', to: 'APPROVED', requiredPermission: 'review.approve' },
      { from: 'IN_PROGRESS', to: 'CHANGES_REQUESTED', requiredPermission: 'review.request_changes' },
      { from: 'IN_PROGRESS', to: 'REJECTED', requiredPermission: 'review.reject' },
      { from: 'CHANGES_REQUESTED', to: 'REOPENED', requiredPermission: 'review.reopen' },
      { from: 'REJECTED', to: 'REOPENED', requiredPermission: 'review.reopen' },
      { from: 'APPROVED', to: 'REOPENED', requiredPermission: 'review.reopen' },
    ],
  },

  delivery: {
    entityType: 'delivery',
    initialState: 'DRAFT',
    states: [
      { code: 'DRAFT', label: 'Draft Package', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30', category: 'pending' },
      { code: 'SUBMITTED', label: 'Submitted to Client', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', category: 'in_progress' },
      { code: 'IN_INSPECTION', label: 'QC Inspection', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', category: 'review' },
      { code: 'APPROVED', label: 'Client Accepted', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', category: 'done' },
      { code: 'REJECTED', label: 'QC Failed', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30', category: 'blocked' },
      { code: 'PUBLISHED', label: 'Published / Mastered', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30', category: 'done' },
      { code: 'CANCELLED', label: 'Cancelled', color: 'bg-zinc-600/20 text-zinc-400 border-zinc-600/30', category: 'blocked' },
    ],
    transitions: [
      { from: 'DRAFT', to: 'SUBMITTED', requiredPermission: 'delivery.submit' },
      { from: 'SUBMITTED', to: 'IN_INSPECTION', requiredPermission: 'delivery.update' },
      { from: 'IN_INSPECTION', to: 'APPROVED', requiredPermission: 'delivery.approve' },
      { from: 'IN_INSPECTION', to: 'REJECTED', requiredPermission: 'delivery.reject' },
      { from: 'APPROVED', to: 'PUBLISHED', requiredPermission: 'delivery.publish' },
      { from: 'DRAFT', to: 'CANCELLED', requiredPermission: 'delivery.cancel' },
      { from: 'SUBMITTED', to: 'CANCELLED', requiredPermission: 'delivery.cancel' },
    ],
  },
};

/**
 * Checks if a user has permission to perform a workflow state transition
 */
export function canTransitionWorkflowState(
  user: User | null,
  entityType: string,
  fromState: string,
  toState: string,
  entity?: any,
  context?: PermissionEvaluationContext
): { allowed: boolean; reason?: string; requiredPermission?: string } {
  if (!user) {
    return { allowed: false, reason: 'User is not authenticated' };
  }

  // Platform break-glass override (strict superuser-only)
  if (isBreakGlass(user)) {
    return { allowed: true };
  }

  const def = WORKFLOW_DEFINITIONS[entityType.toLowerCase()];
  if (!def) {
    // If entity has no special state machine, default to entity.update permission
    const updatePerm = `${entityType.toLowerCase()}.update`;
    const allowed = evaluateUserPermission(user, updatePerm, { ...context, entity });
    return {
      allowed,
      requiredPermission: updatePerm,
      reason: allowed ? undefined : `Requires ${updatePerm} permission`,
    };
  }

  // Normalize state codes
  const normFrom = fromState.toUpperCase().trim();
  const normTo = toState.toUpperCase().trim();

  if (normFrom === normTo) {
    return { allowed: true };
  }

  // Find defined transition rule
  const rule = def.transitions.find((t) => t.from === normFrom && t.to === normTo);
  if (!rule) {
    return {
      allowed: false,
      reason: `Illegal state transition from ${normFrom} to ${normTo} for ${entityType}`,
    };
  }

  // Disallowed role check (e.g. Artist cannot self-approve tasks)
  const userRole = user.role;
  if (rule.disallowedRoles && userRole && rule.disallowedRoles.includes(userRole)) {
    return {
      allowed: false,
      reason: `Role '${userRole}' is strictly restricted from performing transition to ${normTo}`,
    };
  }

  // Allowed roles check (if explicit whitelist exists)
  if (rule.allowedRoles && rule.allowedRoles.length > 0) {
    if (!userRole || !rule.allowedRoles.includes(userRole)) {
      return {
        allowed: false,
        reason: `Transition to ${normTo} requires one of: ${rule.allowedRoles.join(', ')}`,
      };
    }
  }

  // Permission evaluation
  if (rule.requiredPermission) {
    const hasPerm = evaluateUserPermission(user, rule.requiredPermission, {
      ...context,
      entity,
    });
    if (!hasPerm) {
      return {
        allowed: false,
        requiredPermission: rule.requiredPermission,
        reason: `Missing required permission: ${rule.requiredPermission}`,
      };
    }
  }

  // Entity scope evaluation
  if (entity) {
    const inScope = isEntityInScope(user, entity, entityType, undefined, context);
    if (!inScope) {
      return {
        allowed: false,
        reason: `Entity is not within user's assigned scope`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Returns all valid next states for the given entity that the user is permitted to transition to
 */
export function getAllowedWorkflowTransitions(
  user: User | null,
  entityType: string,
  currentState: string,
  entity?: any,
  context?: PermissionEvaluationContext
) {
  const def = WORKFLOW_DEFINITIONS[entityType.toLowerCase()];
  if (!def) return [];

  const normCurrent = currentState.toUpperCase().trim();
  const validTransitions = def.transitions.filter((t) => t.from === normCurrent);

  return validTransitions
    .map((rule) => {
      const auth = canTransitionWorkflowState(
        user,
        entityType,
        normCurrent,
        rule.to,
        entity,
        context
      );
      const targetStateMeta = def.states.find((s) => s.code === rule.to);
      return {
        targetState: rule.to,
        label: targetStateMeta?.label || rule.to,
        color: targetStateMeta?.color || 'bg-zinc-500/20 text-zinc-300',
        allowed: auth.allowed,
        reason: auth.reason,
        requiredPermission: auth.requiredPermission,
      };
    })
    .filter((res) => res.allowed);
}
