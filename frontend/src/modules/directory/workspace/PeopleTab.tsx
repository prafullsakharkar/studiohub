import { useQueryClient } from '@tanstack/react-query';
import { UserMinus, UserPlus } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { peopleApi } from '@/api/masterdata/directory';
import type { Person } from '@/api/masterdata/directory';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Table } from '@/modules/identity/components/ui';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { PersonPicker } from '../pickers';

export interface PeopleTabProps {
  /** The person field that points at the parent: `team`, `department` or `office` (the people filters). */
  field: 'team' | 'department' | 'office';
  parentId: string;
  parentName: string;
  /** Only teams: add a person to the team, or take them out, by changing the person's `team`. */
  manageMembers?: boolean;
}

const PEOPLE_MANAGE = 'masterdata.directory.manage';

/**
 * The people who belong to a team, department or office. Membership is stored on the person (one team,
 * one department, one office each), so the list is `GET /people/?<field>=<id>` and adding or removing a
 * team member is a PATCH of that person's `team`; the API has no member list on the team.
 */
export const PeopleTab: React.FC<PeopleTabProps> = ({ field, parentId, parentName, manageMembers = false }) => {
  const queryClient = useQueryClient();
  const canEditPeople = useCan(PEOPLE_MANAGE);
  const list = usePaginatedList<Person>({ queryKey: [...peopleApi.keys.lists(), 'of', field, parentId], fetchPage: peopleApi.list, ordering: 'name', filters: { [field]: parentId } });
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Person | null>(null);

  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: peopleApi.keys.all }), queryClient.invalidateQueries({ queryKey: auditKeys.all })]);
  const canManage = manageMembers && canEditPeople;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">People{list.count ? ` (${list.count})` : ''}</h3>
        {canManage && (
          <Button size="sm" variant="primary" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
            Add member
          </Button>
        )}
      </div>

      <QueryBoundary isLoading={list.isLoading} error={list.rows.length === 0 ? list.error : null} onRetry={() => void list.refetch()} entityName="people" isEmpty={list.rows.length === 0} empty={{ title: 'No people', description: `Nobody is assigned to ${parentName} yet.` }}>
        <Table label="People" columns={['Name', 'Department', 'Team', 'Office', 'Status', ...(canManage ? [''] : [])]}>
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
              {canManage && (
                <td className="px-4 py-2 text-right">
                  <button type="button" className="inline-flex items-center gap-1 text-rose-400 hover:underline" aria-label={`Remove ${person.full_name || person.name} from ${parentName}`} onClick={() => setRemoving(person)}>
                    <UserMinus className="w-3.5 h-3.5" aria-hidden="true" /> Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </Table>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="people" />
      </QueryBoundary>

      {adding && (
        <Dialog isOpen onClose={() => { setAdding(false); setPicked(null); }} title={`Add a member to ${parentName}`} size="md">
          <div className="space-y-4">
            <PersonPicker label="Person" required value={picked} onChange={setPicked} />
            <p className="text-xs text-slate-400">A person belongs to one team. Choosing someone who is in another team moves them here.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setAdding(false); setPicked(null); }}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!picked}
                onClick={async () => {
                  if (!picked) return;
                  try {
                    await peopleApi.update(picked, { team: parentId });
                    await refresh();
                    notify.success(`Added to ${parentName}.`);
                    setAdding(false);
                    setPicked(null);
                  } catch (error) {
                    notify.fromError(error);
                  }
                }}
              >
                Add to team
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      <ConfirmDialog
        isOpen={removing !== null}
        title="Remove from team"
        message={`Remove ${removing ? removing.full_name || removing.name : ''} from ${parentName}? They stay in the directory without a team.`}
        confirmLabel="Remove"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await peopleApi.update(removing.id, { team: null });
          await refresh();
          notify.success('Removed from the team.');
        }}
      />
    </div>
  );
};
