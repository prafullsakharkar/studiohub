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
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Table } from '@/modules/identity/components/ui';
import { StatusBadge } from '@/shared/components/StatusBadge';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { FormDialog } from '@/shared/forms/FormDialog';
import { PersonPicker } from '../pickers';

const MANAGE = 'masterdata.directory.manage';

/** Pick a person and add them to the team. Mounted only while open. */
const AddMemberDialog: React.FC<{ teamId: string; teamName: string; onDone: () => Promise<unknown>; onClose: () => void }> = ({ teamId, teamName, onDone, onClose }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      await teamMembershipsApi.create({ team: teamId, person: picked });
      await onDone();
      notify.success(`Added to ${teamName}.`);
      onClose();
    } catch (e) {
      setError(serverMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDialog title={`Add a member to ${teamName}`} size="md" onClose={onClose} onSubmit={onSubmit} isSubmitting={saving} isDirty={picked !== null} submitLabel="Add to team" submitDisabled={!picked}>
      <PersonPicker label="Person" required value={picked} onChange={(id) => { setPicked(id); setError(null); }} error={error ?? undefined} />
      <p className="text-xs text-slate-400">A person can be in several teams; adding them here does not take them out of another.</p>
    </FormDialog>
  );
};

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
  const [removing, setRemoving] = useState<TeamMembership | null>(null);

  // A membership is a person's, too: refresh the people lists and the history along with the memberships.
  const refresh = () => Promise.all([teamMembershipsApi.keys.all, peopleApi.keys.all, auditKeys.all].map((queryKey) => queryClient.invalidateQueries({ queryKey })));

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
                <StatusBadge status={m.person_status} />
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

      {adding && <AddMemberDialog teamId={teamId} teamName={teamName} onDone={refresh} onClose={() => setAdding(false)} />}

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
