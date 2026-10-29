/**
 * Canonical usePermissions hook (ADR-0033 / docs/access-control/RBAC.md §9).
 *
 * Backed by the authenticated user and active context ONLY:
 *   AuthContext (user) + production store (active project/show). There is no
 *   simulation mode and no client-side override store — those were removed
 *   because they could self-grant authorization ("Hidden UI ≠ Security"; the
 *   backend is authoritative).
 *
 * API (stable for existing callers):
 *   can('shot.create')                      legacy string form
 *   can({ permission, projectId, showId, resource, action })   canonical form
 *   canPerform(entityType, action)          CRUD/bulk shorthand
 *   hasPermission / hasAnyPermission / hasAllPermissions (string codes)
 *   hasRole(roles)                          role display checks
 */

import { useContext, useMemo } from 'react';

import { AuthContext } from '@/core/auth/AuthContext';
import { useProductionStore } from '@/core/production/useProductionStore';
import type { EntityType } from '@/types/common';
import {
  can as evaluateCan,
  canAll as evaluateCanAll,
  canAny as evaluateCanAny,
  resolvePermissionCode,
  type CanQuery,
} from './can';
import { checkUserHasRole } from './rbac';

export function usePermissions() {
  // Provider-tolerant: components (e.g. shared Button) may render in tests or
  // shells without Auth provider. Absent context ⇒ user null ⇒ deny-by-default
  // (never throw).
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const activeProjectId = useProductionStore((s) => s.activeProjectId);
  const activeShowId = useProductionStore((s) => s.activeShowId);

  return useMemo(() => {
    const withDefaults = (query: CanQuery): CanQuery => ({
      projectId: activeProjectId || undefined,
      showId: activeShowId || undefined,
      ...query,
    });

    const can = (query: string | CanQuery): boolean =>
      evaluateCan(user, typeof query === 'string' ? withDefaults({ permission: query }) : withDefaults(query));

    const hasPermission = (permission: string): boolean =>
      evaluateCan(user, withDefaults({ permission }));

    const hasAnyPermission = (permissions: string[]): boolean =>
      evaluateCanAny(user, permissions.map((permission) => withDefaults({ permission })));

    const hasAllPermissions = (permissions: string[]): boolean =>
      evaluateCanAll(user, permissions.map((permission) => withDefaults({ permission })));

    const canPerform = (entityType: EntityType | string, action: string): boolean =>
      evaluateCan(user, withDefaults({ resource: entityType, action }));

    const hasRole = (roles: string | string[]): boolean =>
      checkUserHasRole(user, roles);

    return {
      user,
      /** Display-only role label (never used for evaluation). */
      currentRole: user?.role
        ? { id: user.role, name: user.role }
        : null,
      activeProjectId: activeProjectId || undefined,
      activeShowId: activeShowId || undefined,
      can,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      canPerform,
      hasRole,
      resolvePermissionCode,
    };
  }, [user, activeProjectId, activeShowId]);
}

export type { CanQuery };
