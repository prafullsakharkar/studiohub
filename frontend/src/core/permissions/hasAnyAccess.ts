import type { User } from '@/types/identity';

/**
 * Whether the signed-in user holds anything that grants access: a superuser flag, at least one
 * permission (the backend resolves them from roles and groups; `/auth/me/` is the only source), or a
 * project membership. A user with none of these has no role, and the app shell is closed to them.
 *
 * This only decides what the UI shows. The API still answers every request on its own.
 */
export function hasAnyAccess(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  if ((user.permissions?.length ?? 0) > 0) return true;
  if ((user.project_memberships?.length ?? 0) > 0) return true;
  return false;
}
