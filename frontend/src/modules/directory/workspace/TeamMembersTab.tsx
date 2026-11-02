import { useQueryClient } from '@tanstack/react-query';
import { UserMinus, UserPlus } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auditKeys } from '@/api/audit/audit';
import { serverMessage } from '@/api/errors/serverMessage';
import { peopleApi, teamMembershipsApi } from '@/api/masterdata/directory';
import type { TeamMembership } from '@/api/masterdata/directory';
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

const MANAGE = 'masterdata.directory.manage';

/**
 * The members of a team: `GET /team-memberships/?team=<id>`. A person can be in several teams, so adding a
 * member is `POST /team-memberships/` (it moves nobody) and removing one is `DELETE` of that membership.
 * Which team is a person's *primary* team is their own `team` field, shown on their page.
 */
export const TeamMembersTab: React.FC<{ teamId: string; teamName: string }> = ({ teamId, teamName }) => {
  const queryClient = useQueryClient();
  const canManage = useCan(MANAGE);
  const list = usePaginatedList<TeamMembership>({ queryKey: [...teamMembershipsApi.keys.lists(), 'of-team', teamId], fetchPage: teamMembershipsApi.list, ordering: 'created_at', filters: { team: teamId } });
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMembership | null>(null);

  // A membership is a person's, too: refresh the people lists and the history along with the memberships.
  const refresh = () => Promise.all([teamMembershipsApi.keys.all, peopleApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  const close = () => {
    setAdding(false);
    setPicked(null);
    setAddError(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Members{list.count ? ` (${list.count})` : ''}</h3>
        {canManage && (
          <Button size="sm" variant="primary" leftIcon={<UserPlus className="w-3.5 h-3.5" />} onClick={() => setAdding(true)}>
            Add member
          </Button>
        )}
      </div>

      <QueryBoundary isLoading={list.isLoading} error={list.rows.length === 0 ? list.error : null} onRetry={() => void list.refetch()} entityName="members" isEmpty={list.rows.length === 0} empty={{ title: 'No members', description: `Nobody is in ${teamName} yet.` }}>
        <Table label="Members" columns={['Name', 'Department', 'Office', 'Status', ...(canManage ? [''] : [])]}>
          {list.rows.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2">
                <Link to={`/people/${m.person}`} className="text-indigo-300 hover:underline">
                  {m.person_name}
                </Link>
              </td>
              <td className="px-4 py-2 text-slate-300">{m.person_department_name || '—'}</td>
              <td className="px-4 py-2 text-slate-300">{m.person_office_name || '—'}</td>
              <td className="px-4 py-2">
                <Badge variant={m.person_status === 'active' ? 'success' : 'neutral'}>{m.person_status}</Badge>
              </td>
              {canManage && (
                <td className="px-4 py-2 text-right">
                  <button type="button" className="inline-flex items-center gap-1 text-rose-400 hover:underline" aria-label={`Remove ${m.person_name} from ${teamName}`} onClick={() => setRemoving(m)}>
                    <UserMinus className="w-3.5 h-3.5" aria-hidden="true" /> Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </Table>
        <Pagination currentPage={list.page} totalCount={list.count} pageSize={list.pageSize} totalPages={list.pageCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="members" />
      </QueryBoundary>

      {adding && (
        <Dialog isOpen onClose={close} title={`Add a member to ${teamName}`} size="md">
          <div className="space-y-4">
            <PersonPicker label="Person" required value={picked} onChange={(id) => { setPicked(id); setAddError(null); }} error={addError ?? undefined} />
            <p className="text-xs text-slate-400">A person can be in several teams; adding them here does not take them out of another.</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!picked}
                onClick={async () => {
                  if (!picked) return;
                  try {
                    await teamMembershipsApi.create({ team: teamId, person: picked });
                    await refresh();
                    notify.success(`Added to ${teamName}.`);
                    close();
                  } catch (error) {
                    setAddError(serverMessage(error));
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
        message={`Remove ${removing?.person_name ?? ''} from ${teamName}? They stay in the directory and in their other teams. If this is their primary team, they will have none afterwards.`}
        confirmLabel="Remove"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await teamMembershipsApi.remove(removing.id);
          await refresh();
          notify.success('Removed from the team.');
        }}
      />
    </div>
  );
};
