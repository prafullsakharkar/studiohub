import type React from 'react';
import { Link } from 'react-router-dom';
import { tasksApi } from '@/api/production/work';
import type { Task } from '@/api/production/work';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { useCan } from '@/core/permissions/useCan';
import { Table } from '@/modules/identity/components/ui';
import { Badge } from '@/shared/components/Badge';
import { Pagination } from '@/shared/components/Pagination';
import { usePaginatedList } from '@/shared/data/usePaginatedList';

/**
 * The tasks assigned to the person's login: `GET /tasks/?assignee_id=<user id>`. A task is assigned to a
 * user, not to a person record, so a person with no login has none. The API narrows the list to the
 * projects the viewer may see.
 */
export const PersonAssignmentsTab: React.FC<{ userId: string | null | undefined; personName: string }> = ({ userId, personName }) => {
  const canView = useCan('task.view');
  const list = usePaginatedList<Task>({ queryKey: [...tasksApi.keys.lists(), 'of-assignee', userId], fetchPage: tasksApi.list, ordering: '-created_at', filters: { assignee_id: userId ?? undefined }, enabled: Boolean(userId) && canView });

  if (!userId) return <p className="text-xs text-slate-400">{personName} has no login, so no task can be assigned to them.</p>;
  if (!canView) return <p className="text-xs text-slate-400">You do not have access to tasks.</p>;
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white">Assigned tasks{list.count ? ` (${list.count})` : ''}</h3>
      <QueryBoundary isLoading={list.isLoading} error={list.rows.length === 0 ? list.error : null} onRetry={() => void list.refetch()} entityName="tasks" isEmpty={list.rows.length === 0} empty={{ title: 'No tasks', description: `No task is assigned to ${personName} in the projects you can see.` }}>
        <Table label="Assigned tasks" columns={['Task', 'Project', 'Status', 'Due']}>
          {list.rows.map((task) => (
            <tr key={task.id}>
              <td className="px-4 py-2">
                <Link to={`/tasks/${task.id}`} className="text-indigo-300 hover:underline">
                  {task.title}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-300">{task.project_name || '—'}</td>
              <td className="px-4 py-2">
                <Badge variant="neutral">{task.status}</Badge>
              </td>
              <td className="px-4 py-2 text-slate-300">{task.due_date ?? '—'}</td>
            </tr>
          ))}
        </Table>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="tasks" />
      </QueryBoundary>
    </div>
  );
};
