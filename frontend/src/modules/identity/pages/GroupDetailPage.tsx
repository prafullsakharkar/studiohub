import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { groupKeys, groupsApi, roleKeys, rolesApi } from '@/api/identity/rbac';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { fetchAllRows } from '@/shared/data/listing';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Field, PageShell, Table, formatDate, inputClass } from '../components/ui';
import { groupQuery, useAfterAccessChange, useUsersIndex } from '../hooks/useIdentityData';
import { ACCESS_TABS } from '../routes';

type Tab = 'members' | 'roles';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');

const MembersTab: React.FC<{ groupId: string; canEdit: boolean }> = ({ groupId, canEdit }) => {
  const afterChange = useAfterAccessChange();
  const users = useUsersIndex();
  const key = [...groupKeys.detail(groupId), 'members'] as const;
  const members = useQuery({ queryKey: key, queryFn: ({ signal }) => groupsApi.members(groupId, signal) });
  const [userId, setUserId] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; email: string } | null>(null);

  const present = useMemo(() => new Set((members.data ?? []).map((m) => m.user.id)), [members.data]);
  const candidates = users.users.filter((u) => !present.has(u.id));

  const add = useMutation({
    mutationFn: () => groupsApi.addMember(groupId, userId, { is_owner: isOwner, is_manager: isManager }),
    onSuccess: async () => {
      setUserId('');
      setIsOwner(false);
      setIsManager(false);
      await afterChange(key);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      {canEdit && !users.error && (
      <form
        className="flex flex-col sm:flex-row sm:items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (userId) add.mutate();
        }}
      >
        <div className="flex-1">
          <Field id="member-user" label="Add member">
            <select id="member-user" className={inputClass()} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Choose a user…</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={isOwner} onChange={(e) => setIsOwner(e.target.checked)} /> Owner
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" checked={isManager} onChange={(e) => setIsManager(e.target.checked)} /> Manager
        </label>
        <Button type="submit" variant="primary" size="sm" disabled={!userId} isLoading={add.isPending}>
          Add
        </Button>
      </form>
      )}
      {canEdit && users.error && (
        <p role="note" className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
          Choosing a user to add needs the <span className="font-mono text-slate-300">identity.user.view</span> permission.
        </p>
      )}

      <QueryBoundary
        isLoading={members.isLoading}
        error={members.error}
        onRetry={() => void members.refetch()}
        entityName="group members"
        isEmpty={(members.data ?? []).length === 0}
        empty={{ title: 'No members', description: 'Add users to give them every role attached to this group.' }}
      >
        <Table label="Group members" columns={['User', 'Role in group', 'Joined', '']}>
          {(members.data ?? []).map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-2 text-slate-200">{m.user.email}</td>
              <td className="px-4 py-2 space-x-1">
                {m.is_owner && <Badge variant="purple">Owner</Badge>}
                {m.is_manager && <Badge variant="info">Manager</Badge>}
                {!m.is_owner && !m.is_manager && <span className="text-slate-500">Member</span>}
              </td>
              <td className="px-4 py-2 text-slate-400">{formatDate(m.joined_at)}</td>
              <td className="px-4 py-2 text-right">
                {canEdit && (
                <button type="button" aria-label={`Remove ${m.user.email}`} className="text-rose-400 hover:text-rose-300" onClick={() => setRemoving({ id: m.user.id, email: m.user.email })}>
                  <Trash2 className="h-4 w-4" />
                </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </QueryBoundary>

      <ConfirmDialog
        isOpen={removing !== null}
        title="Remove member"
        message={`Remove ${removing?.email ?? 'this user'} from the group? They lose the roles it grants.`}
        confirmLabel="Remove"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await groupsApi.removeMember(groupId, removing.id);
          await afterChange(key);
        }}
      />
    </div>
  );
};

const RolesTab: React.FC<{ groupId: string; canEdit: boolean }> = ({ groupId, canEdit }) => {
  const afterChange = useAfterAccessChange();
  const key = [...groupKeys.detail(groupId), 'roles'] as const;
  const links = useQuery({ queryKey: key, queryFn: ({ signal }) => groupsApi.roles(groupId, signal) });
  const allRoles = useQuery({ queryKey: [...roleKeys.all, 'all'], queryFn: ({ signal }) => fetchAllRows(rolesApi.list, { ordering: 'priority' }, { signal }), staleTime: 60_000 });
  const [roleId, setRoleId] = useState('');
  const [detaching, setDetaching] = useState<{ id: string; name: string } | null>(null);

  const attached = useMemo(() => new Set((links.data ?? []).map((l) => l.role.id)), [links.data]);
  const candidates = (allRoles.data ?? []).filter((r) => !attached.has(r.id));

  const attach = useMutation({
    mutationFn: () => groupsApi.attachRole(groupId, roleId),
    onSuccess: async () => {
      setRoleId('');
      await afterChange(key);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      {canEdit && (
      <form
        className="flex items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (roleId) attach.mutate();
        }}
      >
        <div className="flex-1">
          <Field id="attach-role" label="Attach role">
            <select id="attach-role" className={inputClass()} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">Choose a role…</option>
              {candidates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={!roleId} isLoading={attach.isPending}>
          Attach
        </Button>
      </form>
      )}

      <QueryBoundary
        isLoading={links.isLoading}
        error={links.error}
        onRetry={() => void links.refetch()}
        entityName="group roles"
        isEmpty={(links.data ?? []).length === 0}
        empty={{ title: 'No roles attached', description: 'Members of this group receive no permissions from it yet.' }}
      >
        <Table label="Group roles" columns={['Role', 'Code', '']}>
          {(links.data ?? []).map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-2">
                <Link to={`/access/roles/${l.role.id}`} className="text-cyan-300 hover:underline">
                  {l.role.name}
                </Link>
              </td>
              <td className="px-4 py-2 font-mono text-slate-300">{l.role.code}</td>
              <td className="px-4 py-2 text-right">
                {canEdit && (
                <button type="button" aria-label={`Detach ${l.role.name}`} className="text-rose-400 hover:text-rose-300" onClick={() => setDetaching({ id: l.role.id, name: l.role.name })}>
                  <Trash2 className="h-4 w-4" />
                </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </QueryBoundary>

      <ConfirmDialog
        isOpen={detaching !== null}
        title="Detach role"
        message={`Detach ${detaching?.name ?? 'this role'} from the group? Its members lose what only this role granted.`}
        confirmLabel="Detach"
        destructive
        onClose={() => setDetaching(null)}
        onConfirm={async () => {
          if (!detaching) return;
          await groupsApi.detachRole(groupId, detaching.id);
          await afterChange(key);
        }}
      />
    </div>
  );
};

export const GroupDetailPage: React.FC = () => {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const afterChange = useAfterAccessChange();
  const canView = useCan('identity.group.view');
  const canUpdate = useCan('identity.group.update');
  const canDelete = useCan('identity.group.delete');
  const [tab, setTab] = useState<Tab>('members');
  const [deleting, setDeleting] = useState(false);
  const group = useQuery(groupQuery(groupId));

  return (
    <PageShell
      title={group.data?.name ?? 'Group'}
      subtitle={group.data?.description}
      tabs={ACCESS_TABS}
      actions={
        group.data && canDelete ? (
          <Button variant="danger" size="sm" onClick={() => setDeleting(true)} disabled={group.data.is_system} title={group.data.is_system ? 'System groups cannot be deleted' : undefined}>
            Delete group
          </Button>
        ) : undefined
      }
    >
      <QueryBoundary isLoading={group.isLoading} error={group.error} onRetry={() => void group.refetch()} entityName="group">
        {group.data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-slate-300">{group.data.code}</span>
              {group.data.is_system && <Badge variant="purple">System</Badge>}
            </div>

                <div role="tablist" aria-label="Group sections" className="flex gap-1 border-b border-slate-800">
                  {(['members', 'roles'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="tab"
                      aria-selected={tab === t}
                      onClick={() => setTab(t)}
                      className={`px-3 py-2 text-xs font-semibold capitalize border-b-2 -mb-px ${tab === t ? 'border-cyan-400 text-cyan-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {tab === 'members' &&
                  (canView ? (
                    <MembersTab groupId={groupId} canEdit={canUpdate} />
                  ) : (
                    <p role="note" className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
                      Who belongs to a group is user data: it needs the <span className="font-mono text-slate-300">identity.group.view</span> permission.
                    </p>
                  ))}
                {tab === 'roles' && <RolesTab groupId={groupId} canEdit={canUpdate} />}
          </>
        )}
      </QueryBoundary>

      <ConfirmDialog
        isOpen={deleting}
        title="Delete group"
        message={`Delete "${group.data?.name ?? 'this group'}"? Its members lose the roles it grants. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await groupsApi.remove(groupId);
          await afterChange(groupKeys.all);
          notify.success('Group deleted.');
          navigate('/access/groups', { replace: true });
        }}
      />
    </PageShell>
  );
};
