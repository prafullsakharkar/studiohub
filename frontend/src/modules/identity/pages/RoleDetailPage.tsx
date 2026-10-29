import type React from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { roleKeys, rolesApi } from '@/api/identity/rbac';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Field, PageShell, Table, formatDate, inputClass } from '../components/ui';
import { roleQuery, useAfterAccessChange, usePermissionsIndex, useUsersIndex } from '../hooks/useIdentityData';
import { ACCESS_TABS } from '../routes';

type Tab = 'permissions' | 'users' | 'groups';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.');

const PermissionsTab: React.FC<{ roleId: string; canEdit: boolean }> = ({ roleId, canEdit }) => {
  const afterChange = useAfterAccessChange();
  const catalog = usePermissionsIndex();
  const grants = useQuery({ queryKey: [...roleKeys.detail(roleId), 'permissions'], queryFn: ({ signal }) => rolesApi.permissions(roleId, signal) });
  const [permissionId, setPermissionId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [revoking, setRevoking] = useState<{ id: string; code: string } | null>(null);

  const granted = useMemo(() => new Set((grants.data ?? []).map((g) => g.permission.id)), [grants.data]);
  const available = useMemo(() => [...catalog.byId.values()].filter((p) => !granted.has(p.id)), [catalog.byId, granted]);

  const grant = useMutation({
    mutationFn: () => rolesApi.grantPermission(roleId, permissionId, expiresAt ? new Date(expiresAt).toISOString() : null),
    onSuccess: async () => {
      setPermissionId('');
      setExpiresAt('');
      await afterChange([...roleKeys.detail(roleId), 'permissions']);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          className="flex flex-col sm:flex-row sm:items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (permissionId) grant.mutate();
          }}
        >
          <div className="flex-1">
            <Field id="grant-permission" label="Grant permission">
              <select id="grant-permission" className={inputClass()} value={permissionId} onChange={(e) => setPermissionId(e.target.value)}>
                <option value="">Choose a permission…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <Field id="grant-expires" label="Expires (optional)">
              <input id="grant-expires" type="datetime-local" className={inputClass()} value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={!permissionId} isLoading={grant.isPending}>
            Grant
          </Button>
        </form>
      )}

      <QueryBoundary
        isLoading={grants.isLoading || catalog.isLoading}
        error={grants.error ?? catalog.error}
        onRetry={() => void grants.refetch()}
        entityName="role permissions"
        isEmpty={(grants.data ?? []).length === 0}
        empty={{ title: 'No permissions granted', description: 'This role does not grant anything yet.' }}
      >
        <Table label="Granted permissions" columns={['Permission', 'Granted', 'Expires', '']}>
          {(grants.data ?? []).map((g) => {
            const permission = g.permission;
            return (
              <tr key={g.id}>
                <td className="px-4 py-2 font-mono text-slate-200">{permission.code}</td>
                <td className="px-4 py-2 text-slate-400">{formatDate(g.granted_at)}</td>
                <td className="px-4 py-2 text-slate-400">{g.expires_at ? formatDate(g.expires_at) : 'Never'}</td>
                <td className="px-4 py-2 text-right">
                  {canEdit && (
                    <button type="button" aria-label={`Revoke ${permission.code}`} className="text-rose-400 hover:text-rose-300" onClick={() => setRevoking({ id: permission.id, code: permission.code })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      </QueryBoundary>

      <ConfirmDialog
        isOpen={revoking !== null}
        title="Revoke permission"
        message={`Remove ${revoking?.code ?? 'this permission'} from the role? Everyone holding the role loses it.`}
        confirmLabel="Revoke"
        destructive
        onClose={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          await rolesApi.revokePermission(roleId, revoking.id);
          await afterChange([...roleKeys.detail(roleId), 'permissions']);
        }}
      />
    </div>
  );
};

const UsersTab: React.FC<{ roleId: string; canEdit: boolean }> = ({ roleId, canEdit }) => {
  const afterChange = useAfterAccessChange();
  const users = useUsersIndex();
  const assignments = useQuery({ queryKey: [...roleKeys.detail(roleId), 'users'], queryFn: ({ signal }) => rolesApi.users(roleId, signal) });
  const [userId, setUserId] = useState('');
  const [removing, setRemoving] = useState<{ id: string; email: string } | null>(null);

  const assigned = useMemo(() => new Set((assignments.data ?? []).map((a) => a.user.id)), [assignments.data]);
  const candidates = users.users.filter((u) => !assigned.has(u.id));

  const assign = useMutation({
    mutationFn: () => rolesApi.assignUser(roleId, userId),
    onSuccess: async () => {
      setUserId('');
      await afterChange([...roleKeys.detail(roleId), 'users']);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      {canEdit && !users.error && (
        <form
          className="flex items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (userId) assign.mutate();
          }}
        >
          <div className="flex-1">
            <Field id="assign-user" label="Assign to user">
              <select id="assign-user" className={inputClass()} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">Choose a user…</option>
                {candidates.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit" variant="primary" size="sm" disabled={!userId} isLoading={assign.isPending}>
            Assign
          </Button>
        </form>
      )}
      {canEdit && users.error && (
        <p role="note" className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
          Choosing a user to assign needs the <span className="font-mono text-slate-300">identity.user.view</span> permission.
        </p>
      )}

      <QueryBoundary
        isLoading={assignments.isLoading}
        error={assignments.error}
        onRetry={() => void assignments.refetch()}
        entityName="role members"
        isEmpty={(assignments.data ?? []).length === 0}
        empty={{ title: 'No direct members', description: 'Nobody holds this role directly. Group members may still receive it.' }}
      >
        <Table label="Users with this role" columns={['User', 'Assigned', '']}>
          {(assignments.data ?? []).map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-2 text-slate-200">{a.user.email}</td>
              <td className="px-4 py-2 text-slate-400">{formatDate(a.created_at)}</td>
              <td className="px-4 py-2 text-right">
                {canEdit && (
                  <button type="button" aria-label={`Remove ${a.user.email}`} className="text-rose-400 hover:text-rose-300" onClick={() => setRemoving({ id: a.user.id, email: a.user.email })}>
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
        title="Remove from role"
        message={`Remove ${removing?.email ?? 'this user'} from this role?`}
        confirmLabel="Remove"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await rolesApi.unassignUser(roleId, removing.id);
          await afterChange([...roleKeys.detail(roleId), 'users']);
        }}
      />
    </div>
  );
};

const GroupsTab: React.FC<{ roleId: string }> = ({ roleId }) => {
  const links = useQuery({ queryKey: [...roleKeys.detail(roleId), 'groups'], queryFn: ({ signal }) => rolesApi.groups(roleId, signal) });

  return (
    <QueryBoundary
      isLoading={links.isLoading}
      error={links.error}
      onRetry={() => void links.refetch()}
      entityName="role groups"
      isEmpty={(links.data ?? []).length === 0}
      empty={{ title: 'Not attached to any group', description: 'Attach the role to a group from the group page.' }}
    >
      <Table label="Groups with this role" columns={['Group', 'Code']}>
        {(links.data ?? []).map((l) => (
          <tr key={l.id}>
            <td className="px-4 py-2">
              <Link to={`/access/groups/${l.group.id}`} className="text-cyan-300 hover:underline">
                {l.group.name}
              </Link>
            </td>
            <td className="px-4 py-2 font-mono text-slate-300">{l.group.code}</td>
          </tr>
        ))}
      </Table>
    </QueryBoundary>
  );
};

export const RoleDetailPage: React.FC = () => {
  const { roleId = '' } = useParams();
  const navigate = useNavigate();
  const afterChange = useAfterAccessChange();
  const canView = useCan('identity.role.view');
  const canUpdate = useCan('identity.role.update');
  const canDelete = useCan('identity.role.delete');
  const [tab, setTab] = useState<Tab>('permissions');
  const [deleting, setDeleting] = useState(false);
  const role = useQuery(roleQuery(roleId));

  return (
    <PageShell
      title={role.data?.name ?? 'Role'}
      subtitle={role.data?.description}
      tabs={ACCESS_TABS}
      actions={
        role.data && canDelete ? (
          <Button variant="danger" size="sm" onClick={() => setDeleting(true)} disabled={role.data.is_system} title={role.data.is_system ? 'System roles cannot be deleted' : undefined}>
            Delete role
          </Button>
        ) : undefined
      }
    >
      <QueryBoundary isLoading={role.isLoading} error={role.error} onRetry={() => void role.refetch()} entityName="role">
        {role.data && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-slate-300">{role.data.code}</span>
              {role.data.is_system && <Badge variant="purple">System</Badge>}
              <Badge variant={role.data.is_active === false ? 'neutral' : 'success'}>{role.data.is_active === false ? 'Inactive' : 'Active'}</Badge>
            </div>

              <div role="tablist" aria-label="Role sections" className="flex gap-1 border-b border-slate-800">
                {(['permissions', 'users', 'groups'] as const).map((t) => (
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

              {tab === 'permissions' && <PermissionsTab roleId={roleId} canEdit={canUpdate} />}
              {tab === 'users' &&
                (canView ? (
                  <UsersTab roleId={roleId} canEdit={canUpdate} />
                ) : (
                  <p role="note" className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
                    Who holds a role is user data: it needs the <span className="font-mono text-slate-300">identity.role.view</span> permission.
                  </p>
                ))}
              {tab === 'groups' && <GroupsTab roleId={roleId} />}
          </>
        )}
      </QueryBoundary>

      <ConfirmDialog
        isOpen={deleting}
        title="Delete role"
        message={`Delete "${role.data?.name ?? 'this role'}"? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          await rolesApi.remove(roleId);
          await afterChange(roleKeys.all);
          notify.success('Role deleted.');
          navigate('/access/roles', { replace: true });
        }}
      />
    </PageShell>
  );
};
