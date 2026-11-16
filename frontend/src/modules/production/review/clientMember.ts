import type { User } from '@/types/identity';

/**
 * Whether `user` is a client member of `projectId` (review pipeline RP-11, C-RP-29): an active membership of it that
 * names a client, and not a superuser. A client member is served only client-visible comments, and whatever they
 * write is stored client-visible, so the composer does not offer them "Internal". The server decides either way.
 */
export function isClientMemberOf(user: User | null | undefined, projectId: string | null | undefined): boolean {
  if (!user || !projectId || user.is_superuser) return false;
  return (user.project_memberships ?? []).some((pm) => pm.project_id === projectId && Boolean(pm.client_id) && (pm.status ?? '').toLowerCase() === 'active');
}
