import type React from 'react';
import { Link } from 'react-router-dom';
import { teamsApi } from '@/api/masterdata/directory';
import type { Team } from '@/api/masterdata/directory';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Table } from '@/modules/identity/components/ui';
import { Pagination } from '@/shared/components/Pagination';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { PersonLabel } from './PersonLabel';

/** The teams of one department: `GET /teams/?department=<id>`. */
export const TeamsOfDepartment: React.FC<{ departmentId: string; departmentName: string }> = ({ departmentId, departmentName }) => {
  const list = usePaginatedList<Team>({ queryKey: [...teamsApi.keys.lists(), 'of-department', departmentId], fetchPage: teamsApi.list, ordering: 'name', filters: { department: departmentId } });
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-white">Teams{list.count ? ` (${list.count})` : ''}</h3>
      <QueryBoundary isLoading={list.isLoading} error={list.rows.length === 0 ? list.error : null} onRetry={() => void list.refetch()} entityName="teams" isEmpty={list.rows.length === 0} empty={{ title: 'No teams', description: `${departmentName} has no teams yet.` }}>
        <Table label="Teams" columns={['Name', 'Code', 'Lead', 'Focus', 'Capacity']}>
          {list.rows.map((team) => (
            <tr key={team.id}>
              <td className="px-4 py-2">
                <Link to={`/teams/${team.id}`} className="text-indigo-300 hover:underline">
                  {team.name}
                </Link>
              </td>
              <td className="px-4 py-2 font-mono text-slate-300">{team.code}</td>
              <td className="px-4 py-2 text-slate-300">
                <PersonLabel id={team.lead} />
              </td>
              <td className="px-4 py-2 text-slate-300">{team.focus_discipline || '—'}</td>
              <td className="px-4 py-2 text-slate-300">{team.capacity ?? '—'}</td>
            </tr>
          ))}
        </Table>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="teams" />
      </QueryBoundary>
    </div>
  );
};
