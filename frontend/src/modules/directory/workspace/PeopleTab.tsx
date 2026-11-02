import type React from 'react';
import { Link } from 'react-router-dom';
import { peopleApi } from '@/api/masterdata/directory';
import type { Person } from '@/api/masterdata/directory';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Table } from '@/modules/identity/components/ui';
import { Badge } from '@/shared/components/Badge';
import { Pagination } from '@/shared/components/Pagination';
import { usePaginatedList } from '@/shared/data/usePaginatedList';

export interface PeopleTabProps {
  /** The person field that points at the parent: `department` or `office` (the people filters). */
  field: 'department' | 'office';
  parentId: string;
  parentName: string;
}

/**
 * The people of a department or an office. Each person has one of each, stored on the person, so the list
 * is `GET /people/?<field>=<id>`. A team's members are different (a person can be in several teams): see
 * `TeamMembersTab`.
 */
export const PeopleTab: React.FC<PeopleTabProps> = ({ field, parentId, parentName }) => {
  const list = usePaginatedList<Person>({ queryKey: [...peopleApi.keys.lists(), 'of', field, parentId], fetchPage: peopleApi.list, ordering: 'name', filters: { [field]: parentId } });

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white">People{list.count ? ` (${list.count})` : ''}</h3>
      <QueryBoundary isLoading={list.isLoading} error={list.rows.length === 0 ? list.error : null} onRetry={() => void list.refetch()} entityName="people" isEmpty={list.rows.length === 0} empty={{ title: 'No people', description: `Nobody is assigned to ${parentName} yet.` }}>
        <Table label="People" columns={['Name', 'Department', 'Team', 'Office', 'Status']}>
          {list.rows.map((person) => (
            <tr key={person.id}>
              <td className="px-4 py-2">
                <Link to={`/people/${person.id}`} className="text-indigo-300 hover:underline">
                  {person.full_name || person.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-300">{person.department_name || '—'}</td>
              <td className="px-4 py-2 text-slate-300">{person.team_name || '—'}</td>
              <td className="px-4 py-2 text-slate-300">{person.office_name || '—'}</td>
              <td className="px-4 py-2">
                <Badge variant={person.status === 'active' ? 'success' : 'neutral'}>{person.status ?? '—'}</Badge>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="people" />
      </QueryBoundary>
    </div>
  );
};
