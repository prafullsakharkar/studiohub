import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link } from 'react-router-dom';
import { peopleApi } from '@/api/masterdata/directory';

/** A person referenced by id (a manager, a lead), shown by name and linked to their page. */
export const PersonLabel: React.FC<{ id: string | null | undefined }> = ({ id }) => {
  const query = useQuery({ queryKey: peopleApi.keys.detail(id ?? ''), queryFn: ({ signal }) => peopleApi.get(id as string, signal), enabled: Boolean(id), staleTime: 60_000 });
  if (!id) return <>—</>;
  if (query.data) return <Link to={`/people/${id}`} className="text-indigo-300 hover:underline">{query.data.full_name || query.data.name}</Link>;
  return <>{query.isError ? 'Unavailable' : '…'}</>;
};
