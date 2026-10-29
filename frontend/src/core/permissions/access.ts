import type { ProjectMembership, User } from '@/types/identity';
import { isBackendPermissionCode } from './backendCodes';
import { PERMISSION_MAP } from './permissionMap';
import type { PermissionRule } from './permissionMap';

/**
 * The one authorization rule of the frontend:
 *
 *   allowed = user.is_superuser
 *           ∨ (backend codes the gate maps to) ⊆ user.permissions       (global)
 *   and, for project data, an active membership of that project.
 *
 * `user.permissions` comes from `/auth/me/` and holds backend codes only. The server stays
 * authoritative (every request is checked again); this decides what the UI offers.
 * Deny by default: an unknown code is denied and reported once.
 */

export interface AccessContext {
  projectId?: string;
  showId?: string;
}

const warned = new Set<string>();

/** Rule for a gate code: an explicit mapping, else the code itself if the backend knows it. */
export function resolveRule(code: string): PermissionRule | null {
  const mapped = PERMISSION_MAP[code];
  if (mapped) return mapped;
  if (isBackendPermissionCode(code)) return { kind: 'codes', all: [code], why: 'Backend permission code.' };
  return null;
}

export function userHasCode(user: User, code: string): boolean {
  return user.is_superuser === true || (user.permissions ?? []).includes(code);
}

/** Active membership of a project, matched by id or code (the API accepts both). */
export function findActiveMembership(user: User, projectId: string): ProjectMembership | undefined {
  const wanted = projectId.toLowerCase();
  return (user.project_memberships ?? []).find((pm) => {
    const matches =
      pm.project_id?.toLowerCase() === wanted ||
      pm.projectId?.toLowerCase() === wanted ||
      pm.project_code?.toLowerCase() === wanted;
    return matches && (pm.status ?? 'active').toLowerCase() === 'active';
  });
}

function membershipAllows(user: User, context: AccessContext): boolean {
  if (!context.projectId || user.is_superuser) return true;
  const membership = findActiveMembership(user, context.projectId);
  if (!membership) return false;
  if (context.showId && membership.scope === 'SHOW') {
    const memberShow = membership.show_id ?? membership.showId;
    if (memberShow && memberShow !== context.showId) return false;
  }
  return true;
}

export function evaluateAccess(user: User | null, code: string, context: AccessContext = {}): boolean {
  if (!user || !code || user.is_active === false) return false;

  const rule = resolveRule(code);
  if (!rule) {
    if (!warned.has(code)) {
      warned.add(code);
      console.warn(`[permissions] "${code}" is neither a backend code nor in PERMISSION_MAP; denying.`);
    }
    return false;
  }

  if (rule.kind === 'unbacked') return false;
  if (!membershipAllows(user, context)) return false;
  if (rule.kind === 'open') return true;

  const all = rule.all ?? [];
  const any = rule.any ?? [];
  const allOk = all.every((c) => userHasCode(user, c));
  const anyOk = any.length === 0 || any.some((c) => userHasCode(user, c));
  return allOk && anyOk;
}

/** Test seam. */
export function __resetPermissionWarningsForTests(): void {
  warned.clear();
}
