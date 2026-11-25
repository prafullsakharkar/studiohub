import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { Link } from 'react-router-dom';
import { versionsApi } from '@/api/production/review';
import type { Shot } from '@/api/production/work';

/**
 * The shot's current version (D-16) by its code and number, linked to the version. The shot sends only the number
 * and the id; the number alone does not say which department's version it is when several work on the shot, so the
 * version is read by id (the version page's cache key). Until it is read, or if it cannot be, the number is shown.
 */
export const CurrentVersion: React.FC<{ shot: Pick<Shot, 'current_version' | 'current_version_id'> }> = ({ shot }) => {
  const id = shot.current_version_id ?? '';
  const version = useQuery({
    queryKey: versionsApi.keys.detail(id),
    queryFn: ({ signal }) => versionsApi.get(id, signal),
    enabled: Boolean(id),
  });
  if (!id) return <>{shot.current_version || '—'}</>;
  const v = version.data;
  const label = v?.code ? `${v.code} · ${v.version_number || shot.current_version}` : shot.current_version || '—';
  return (
    <Link to={`/versions/${id}`} className="text-cyan-300 hover:underline">
      {label}
    </Link>
  );
};
