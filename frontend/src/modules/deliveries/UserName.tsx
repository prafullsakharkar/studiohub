import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { usersApi } from '@/api/identity/users';
import { useCan } from '@/core/permissions/useCan';

/**
 * Who did it. The delivery routes name people by id only (CR-21), so the name is looked up for callers who
 * may read users; everyone else sees "a teammate" (and "the system" for a move nobody made).
 */
export const UserName: React.FC<{ id: string | null | undefined; system?: string }> = ({ id, system = 'The system' }) => {
  const canLookUp = useCan('identity.user.view');
  const user = useQuery({ queryKey: ['user-name', id], queryFn: ({ signal }) => usersApi.get(id as string, signal), enabled: Boolean(id) && canLookUp, staleTime: 5 * 60_000 });
  if (!id) return <>{system}</>;
  return <>{user.data?.email ?? 'A teammate'}</>;
};
