import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { mapHttpError } from '@/api/errors/errorMapper';
import { groupKeys, groupsApi, permissionKeys, permissionsApi, roleKeys, rolesApi } from '@/api/identity/rbac';
import type { Permission } from '@/api/identity/rbac';
import { userKeys, usersApi } from '@/api/identity/users';
import type { UserSummary } from '@/api/identity/users';
import { useAuth } from '@/modules/auth';
import { fetchAllRows } from '@/shared/data/listing';

/** The whole permission catalog (145 rows), cached: needed to turn grant ids into codes and for pickers. */
export function useAllPermissions() {
  return useQuery({
    queryKey: [...permissionKeys.all, 'all'],
    queryFn: ({ signal }) => permissionsApi.all(signal),
    staleTime: 5 * 60_000,
  });
}

/**
 * Every user the caller may see, indexed by id. Role/group sub-resources return user ids only;
 * the list is scoped by the server (a user without `identity.user.view` sees just themselves).
 */
export function useUsersIndex() {
  const query = useQuery({
    queryKey: [...userKeys.all, 'all'],
    queryFn: ({ signal }) => fetchAllRows(usersApi.list, {}, { signal }),
    staleTime: 60_000,
    retry: (count, error) => mapHttpError(error).status >= 500 && count < 2,
  });
  const byId = useMemo(() => new Map<string, UserSummary>((query.data ?? []).map((u) => [u.id, u])), [query.data]);
  return { ...query, users: query.data ?? [], byId };
}

export function usePermissionsIndex() {
  const query = useAllPermissions();
  const byId = useMemo(() => new Map<string, Permission>((query.data ?? []).map((p) => [p.id, p])), [query.data]);
  return { ...query, byId };
}

export const roleQuery = (id: string) => ({
  queryKey: roleKeys.detail(id),
  queryFn: ({ signal }: { signal: AbortSignal }) => rolesApi.get(id, signal),
});
export const groupQuery = (id: string) => ({
  queryKey: groupKeys.detail(id),
  queryFn: ({ signal }: { signal: AbortSignal }) => groupsApi.get(id, signal),
});

/**
 * After any role/group change the signed-in user's own permissions may have changed (they could hold
 * that role), so re-read `/auth/me/`: the UI then follows the new permissions without a reload.
 */
export function useAfterAccessChange() {
  const queryClient = useQueryClient();
  const { refreshUser } = useAuth();
  return useCallback(
    async (...keys: ReadonlyArray<readonly unknown[]>) => {
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      await refreshUser().catch(() => undefined);
    },
    [queryClient, refreshUser]
  );
}
