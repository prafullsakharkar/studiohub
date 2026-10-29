/**
 * Canonical frontend authorization entry point (ADR-0033 / docs/access-control/RBAC.md).
 *
 * Single public shape:
 *
 *   can(user, { permission, organizationId?, projectId?, showId?, resource?, action?, entity?, scope? })
 *
 * Semantics are the canonical evaluation chain implemented by
 * `evaluateUserPermission` in `./rbac` (deny-by-default, superuser
 * break-glass, organization boundary, project/show membership, scope
 * and entity predicates). This module only normalizes the request shape —
 * no parallel engine, no role-name heuristics, no client-side overrides.
 *
 * Frontend gating is a UX affordance; the backend remains authoritative.
 */

import type { PermissionEvaluationContext } from '@/types/identity';
import type { User } from '@/types/identity';
import { evaluateUserPermission } from './rbac';

/** Canonical authorization request. */
export interface CanQuery {
  /** Explicit permission code, e.g. 'shot.create' (takes precedence). */
  permission?: string;
  /** Resource/entity module, e.g. 'shot', 'task', 'project' (used with action). */
  resource?: string;
  /** Action on the resource, e.g. 'view', 'create', 'update', 'bulk_update'. */
  action?: string;
  /** Organization boundary to evaluate within. */
  organizationId?: string;
  /** Project boundary to evaluate within. */
  projectId?: string;
  /** Show boundary to evaluate within (narrows a project membership). */
  showId?: string;
  /** Force an explicit scope tier for entity checks. */
  scope?: PermissionEvaluationContext['scope'];
  /** Entity under evaluation (scope predicates). */
  entity?: PermissionEvaluationContext['entity'];
}

/** Known aliases between resource names and canonical permission modules. */
const RESOURCE_MODULE_ALIASES: Record<string, string> = {
  person: 'people',
};

/**
 * Resolve a `CanQuery` to the canonical permission code string.
 * Returns null when the query carries neither a permission nor a
 * complete (resource, action) pair — callers treat null as DENY.
 */
export function resolvePermissionCode(query: CanQuery): string | null {
  if (query.permission && query.permission.trim()) {
    return query.permission.trim();
  }
  const resource = query.resource?.trim();
  const action = query.action?.trim();
  if (!resource || !action) return null;
  const module = RESOURCE_MODULE_ALIASES[resource] || resource;
  return `${module}.${action}`;
}

/**
 * Canonical evaluation: `can(user, { permission, organizationId, projectId, showId, resource, action, entity, scope })`.
 *
 * Deny-by-default: no user, empty/malformed query, missing grant, missing
 * membership, or scope mismatch all evaluate to false.
 */
export function can(user: User | null, query: CanQuery): boolean {
  if (!user) return false;
  const code = resolvePermissionCode(query);
  if (!code) return false;

  const context: PermissionEvaluationContext = {
    organizationId: query.organizationId,
    projectId: query.projectId,
    showId: query.showId,
    scope: query.scope,
    entity: query.entity,
  };

  return evaluateUserPermission(user, code, context);
}

/** True when any query resolves to allowed. */
export function canAny(user: User | null, queries: CanQuery[]): boolean {
  if (!user) return false;
  return queries.some((q) => can(user, q));
}

/** True only when every query resolves to allowed. */
export function canAll(user: User | null, queries: CanQuery[]): boolean {
  if (!user) return false;
  return queries.every((q) => can(user, q));
}

/** Normalize a legacy (string, context) call into the canonical query shape. */
export function legacyCanArgs(
  permission: string,
  context?: Partial<PermissionEvaluationContext>
): CanQuery {
  return {
    permission,
    organizationId: context?.organizationId,
    projectId: context?.projectId,
    showId: (context as { showId?: string } | undefined)?.showId,
    scope: context?.scope,
    entity: context?.entity,
  };
}

let legacyCanWarned = false;

/**
 * Full-fidelity legacy entry: `legacyCan(user, 'shot.update', { organizationId,
 * projectId, departmentId, teamId, vendorId, clientId, scope, entity })`.
 *
 * Preserves every context field the historic `rbac.can` forwarded (resourceId
 * was already dropped there and stays dropped). Warns once; use `can()` for
 * new code. Single evaluation path — no parallel engine.
 */
export function legacyCan(
  user: User | null,
  permission: string,
  context?: Partial<PermissionEvaluationContext> & { resourceId?: string; [key: string]: unknown },
): boolean {
  if (!legacyCanWarned) {
    legacyCanWarned = true;
    console.warn('[permissions] legacyCan/rbac.can is deprecated — use can(user, query) from ./can');
  }
  if (!user) return false;
  const evalContext: PermissionEvaluationContext = {
    organizationId: context?.organizationId,
    projectId: context?.projectId,
    showId: context?.showId,
    departmentId: context?.departmentId,
    teamId: context?.teamId,
    vendorId: context?.vendorId,
    clientId: context?.clientId,
    scope: context?.scope,
    entity: context?.entity,
  };
  const code = (permission || '').trim();
  if (!code) return false;
  return evaluateUserPermission(user, code, evalContext);
}
