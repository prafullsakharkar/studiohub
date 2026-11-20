import type React from 'react';
import { Link } from 'react-router-dom';
import type { Version } from '@/api/production/review';

/**
 * RP-26 (C-RP-61): the version's task on the Versions list, linking to the task, with its title as the tooltip. "—" when there is no
 * task or the reader could not open it: the server leaves `task_code` null then, though `task_id` is still given.
 */
export const VersionTaskCell: React.FC<{ version: Pick<Version, 'task_id' | 'task_code' | 'task_title'> }> = ({ version }) => {
  if (!version.task_id || !version.task_code) return <>—</>;
  return (
    <Link to={`/tasks/${version.task_id}`} title={version.task_title ?? undefined} className="text-cyan-300 hover:underline">
      {version.task_code}
    </Link>
  );
};
