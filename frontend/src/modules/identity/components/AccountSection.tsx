import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { rolesApi, roleKeys } from '@/api/identity/rbac';
import type { Role, RoleUserAssignment } from '@/api/identity/rbac';
import { USER_ACTIONS, personLinkApi, userKeys, usersApi } from '@/api/identity/users';
import type { UserAction } from '@/api/identity/users';
import { ConfirmDialog } from '@/components/system/ConfirmDialog';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { useAuth } from '@/modules/auth';
import { PEOPLE_QUERY_KEYS } from '@/modules/people/hooks/usePeopleData';
import { fetchAllRows } from '@/shared/data/listing';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Field, FormBanner, formatDate, inputClass } from './ui';
import { errorText } from '../errorText';
import { useAfterAccessChange, useUsersIndex } from '../hooks/useIdentityData';

export interface AccountSectionProps {
  personId: string;
  personName: string;
  /** The person's own email, offered as the new login's address. */
  personEmail?: string;
  /** `person.user`: the linked user's id, null when the person has no login. */
  userId: string | null | undefined;
}

const ACTION_COPY: Record<UserAction, { label: string; confirm: string; destructive?: boolean }> = {
  activate: { label: 'Activate', confirm: 'Activate this login so the person can sign in again?' },
  deactivate: { label: 'Deactivate', confirm: 'Deactivate this login? The person can no longer sign in.', destructive: true },
  suspend: { label: 'Suspend', confirm: 'Suspend this login? Access is blocked until it is unsuspended.', destructive: true },
  unsuspend: { label: 'Unsuspend', confirm: 'Lift the suspension on this login?' },
  archive: { label: 'Archive', confirm: 'Archive this login? It is hidden and cannot sign in until restored.', destructive: true },
  restore: { label: 'Restore', confirm: 'Restore this archived login?' },
  resetPassword: { label: 'Reset password', confirm: 'Reset the password? The person must set a new one before doing anything else.', destructive: true },
  forcePasswordChange: { label: 'Require password change', confirm: 'Require a password change at the next sign-in?' },
  revokeSessions: { label: 'Sign out everywhere', confirm: 'End every active session of this login?', destructive: true },
};
const ACTION_ORDER = Object.keys(ACTION_COPY) as UserAction[];

const createSchema = z.object({
  email: z.string().trim().min(1, 'Enter an email address').email('Enter a valid email address'),
  password: z.string().min(1, 'Enter an initial password'),
});
type CreateValues = z.infer<typeof createSchema>;

/**
 * "Create login" is TWO calls (`POST /identity/users/`, then `POST /people/{id}/link-user/`) that
 * are not atomic. If the second fails the user already exists, so we keep its id and offer
 * "Retry link" rather than creating it again (which would fail as a duplicate email).
 */
const NoLogin: React.FC<{ personId: string; personEmail?: string; onLinked: () => Promise<void> | void }> = ({ personId, personEmail, onLinked }) => {
  const canCreate = useCan('identity.user.create');
  const canLink = useCan('people.update');
  const users = useUsersIndex();
  const [orphan, setOrphan] = useState<{ id: string; email: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState('');

  const link = useMutation({
    mutationFn: (userId: string) => personLinkApi.link(personId, userId),
    onSuccess: async () => {
      setOrphan(null);
      setLinkError(null);
      await onLinked();
    },
    onError: (error) => setLinkError(errorText(error)),
  });

  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { email: personEmail ?? '', password: '' } });

  const onCreate = submit(async (values) => {
    const created = await usersApi.create({ email: values.email, password: values.password });
    reset();
    setOrphan({ id: created.id, email: created.email });
    notify.success(`Login ${created.email} was created.`);
    await link.mutateAsync(created.id).catch(() => undefined); // failure is shown with a retry
  });

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400">This person has no login yet, so they cannot sign in.</p>

      {orphan && (
        <div role="alert" className="rounded-lg border border-amber-700/60 bg-amber-950/40 p-3 text-xs text-amber-200 space-y-2">
          <p>
            The login <span className="font-mono">{orphan.email}</span> was created, but linking it to this person failed{linkError ? `: ${linkError}` : '.'}
          </p>
          <Button size="sm" variant="warning" isLoading={link.isPending} onClick={() => link.mutate(orphan.id)}>
            Retry link
          </Button>
        </div>
      )}

      {canCreate && !orphan && (
        <form noValidate onSubmit={onCreate} className="space-y-3 max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h4 className="text-xs font-bold text-white">Create a login</h4>
          <FormBanner error={serverError} />
          <Field id="login-email" label="Email" error={errors.email?.message}>
            <input id="login-email" type="email" autoComplete="off" className={inputClass(Boolean(errors.email))} {...register('email', { onChange: clearServerError })} />
          </Field>
          <Field id="login-password" label="Initial password" error={errors.password?.message} hint="At least 12 characters, not a common password. The person can change it after signing in.">
            <input id="login-password" type="password" autoComplete="new-password" className={inputClass(Boolean(errors.password))} {...register('password', { onChange: clearServerError })} />
          </Field>
          <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting || link.isPending} disabled={!canLink} title={canLink ? undefined : 'Linking needs the people.update permission'}>
            Create login
          </Button>
        </form>
      )}

      {canLink && !orphan && (
        <form
          className="space-y-3 max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (existingId) link.mutate(existingId);
          }}
        >
          <h4 className="text-xs font-bold text-white">Or link an existing login</h4>
          <Field id="link-existing" label="User">
            <select id="link-existing" className={inputClass()} value={existingId} onChange={(e) => setExistingId(e.target.value)}>
              <option value="">Choose a user…</option>
              {users.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.email}
                </option>
              ))}
            </select>
          </Field>
          {linkError && !orphan && (
            <p role="alert" className="text-[11px] text-rose-400">
              {linkError}
            </p>
          )}
          <Button type="submit" variant="outline" size="sm" disabled={!existingId} isLoading={link.isPending}>
            Link login
          </Button>
        </form>
      )}

      {!canCreate && !canLink && <p className="text-xs text-slate-500">You do not have permission to create or link logins.</p>}
    </div>
  );
};

/** Roles held by one user. There is no user -> roles route, so each role's members are read (few roles). */
function useRolesOfUser(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...userKeys.detail(userId), 'roles'],
    enabled,
    queryFn: async ({ signal }) => {
      const roles = await fetchAllRows(rolesApi.list, { ordering: 'priority' }, { signal });
      const memberships = await Promise.all(roles.map(async (role) => ({ role, members: await rolesApi.users(role.id, signal) })));
      const held = memberships.filter((m) => m.members.some((a: RoleUserAssignment) => a.user.id === userId)).map((m) => m.role);
      return { all: roles, held };
    },
  });
}

const RolesCard: React.FC<{ userId: string }> = ({ userId }) => {
  const afterChange = useAfterAccessChange();
  const { user: me } = useAuth();
  const roles = useRolesOfUser(userId, true);
  const key = [...userKeys.detail(userId), 'roles'] as const;
  const [roleId, setRoleId] = useState('');
  const [removing, setRemoving] = useState<Role | null>(null);

  const heldIds = useMemo(() => new Set((roles.data?.held ?? []).map((r) => r.id)), [roles.data]);
  const candidates = (roles.data?.all ?? []).filter((r) => !heldIds.has(r.id));

  const assign = useMutation({
    mutationFn: () => rolesApi.assignUser(roleId, userId),
    onSuccess: async () => {
      setRoleId('');
      await afterChange(key, roleKeys.all);
    },
    onError: (error) => notify.error(errorText(error)),
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
      <h4 className="text-xs font-bold text-white">Roles{me?.id === userId ? ' (your own login)' : ''}</h4>
      <QueryBoundary isLoading={roles.isLoading} error={roles.error} onRetry={() => void roles.refetch()} entityName="roles">
        <ul className="flex flex-wrap gap-2">
          {(roles.data?.held ?? []).length === 0 && <li className="text-xs text-slate-500">No roles assigned directly.</li>}
          {(roles.data?.held ?? []).map((role) => (
            <li key={role.id} className="flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
              {role.name}
              <button type="button" aria-label={`Remove role ${role.name}`} className="text-rose-400 hover:text-rose-300" onClick={() => setRemoving(role)}>
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (roleId) assign.mutate();
          }}
        >
          <div className="flex-1">
            <Field id="account-role" label="Assign role">
              <select id="account-role" className={inputClass()} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                <option value="">Choose a role…</option>
                {candidates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button type="submit" size="sm" variant="primary" disabled={!roleId} isLoading={assign.isPending}>
            Assign
          </Button>
        </form>
      </QueryBoundary>

      <ConfirmDialog
        isOpen={removing !== null}
        title="Remove role"
        message={`Remove the role "${removing?.name ?? ''}" from this login?`}
        confirmLabel="Remove"
        destructive
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await rolesApi.unassignUser(removing.id, userId);
          await afterChange(key, roleKeys.all);
        }}
      />
    </div>
  );
};

const Linked: React.FC<{ personId: string; userId: string; onChanged: () => Promise<void> | void }> = ({ personId, userId, onChanged }) => {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const canUnlink = useCan('people.update');
  // Reading who holds each role needs identity.role.view; assigning needs identity.role.update (verified live).
  const canAssignRoles = useCan(['identity.role.view', 'identity.role.update']);
  const user = useQuery({ queryKey: userKeys.detail(userId), queryFn: ({ signal }) => usersApi.get(userId, signal) });
  const [pending, setPending] = useState<UserAction | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const isSelf = me?.id === userId;

  // One hook call per known action, in a fixed order, so the number of hooks never changes.
  const allowed = {
    activate: useCan(USER_ACTIONS.activate.permission),
    deactivate: useCan(USER_ACTIONS.deactivate.permission),
    suspend: useCan(USER_ACTIONS.suspend.permission),
    unsuspend: useCan(USER_ACTIONS.unsuspend.permission),
    archive: useCan(USER_ACTIONS.archive.permission),
    restore: useCan(USER_ACTIONS.restore.permission),
    resetPassword: useCan(USER_ACTIONS.resetPassword.permission),
    forcePasswordChange: useCan(USER_ACTIONS.forcePasswordChange.permission),
    revokeSessions: useCan(USER_ACTIONS.revokeSessions.permission),
  } satisfies Record<UserAction, boolean>;
  const actions = ACTION_ORDER.filter((a) => allowed[a]);
  // The API lets an administrator deactivate or delete their own account (docs/sync Q-08); the UI does not.
  const SELF_LOCKED = new Set<UserAction>(['deactivate', 'suspend', 'archive']);

  const refresh = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: userKeys.all }), queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.all })]);
  };

  return (
    <div className="space-y-5">
      <QueryBoundary isLoading={user.isLoading} error={user.error} onRetry={() => void user.refetch()} entityName="login">
        {user.data && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">{user.data.email}</p>
                <p className="text-[11px] text-slate-500">Last seen {formatDate(user.data.last_seen)}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant={user.data.is_active ? 'success' : 'warning'}>{user.data.is_active ? 'Active' : 'Inactive'}</Badge>
                <Badge variant={user.data.is_email_verified ? 'info' : 'neutral'}>{user.data.is_email_verified ? 'Email verified' : 'Email unverified'}</Badge>
              </div>
            </div>

            {actions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {actions.map((action) => {
                  const locked = isSelf && SELF_LOCKED.has(action);
                  return (
                    <Button
                      key={action}
                      size="sm"
                      variant={ACTION_COPY[action].destructive ? 'outline' : 'secondary'}
                      disabled={locked}
                      title={locked ? 'You cannot do this to your own login' : undefined}
                      onClick={() => setPending(action)}
                    >
                      {ACTION_COPY[action].label}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </QueryBoundary>

      {canAssignRoles && <RolesCard userId={userId} />}

      {canUnlink && (
        <div>
          <Button size="sm" variant="ghost" onClick={() => setUnlinking(true)}>
            Unlink login from this person
          </Button>
        </div>
      )}

      <ConfirmDialog
        isOpen={pending !== null}
        title={pending ? ACTION_COPY[pending].label : ''}
        message={pending ? ACTION_COPY[pending].confirm : ''}
        confirmLabel={pending ? ACTION_COPY[pending].label : 'Confirm'}
        destructive={pending ? ACTION_COPY[pending].destructive : false}
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const result = await usersApi.act(userId, pending);
          await refresh();
          notify.success(result.detail ?? (result.sessions !== undefined ? `${result.sessions} session(s) ended.` : `${ACTION_COPY[pending].label}: done.`));
        }}
      />
      <ConfirmDialog
        isOpen={unlinking}
        title="Unlink login"
        message="The login keeps existing but is no longer attached to this person."
        confirmLabel="Unlink"
        destructive
        onClose={() => setUnlinking(false)}
        onConfirm={async () => {
          await personLinkApi.unlink(personId);
          await onChanged();
        }}
      />
    </div>
  );
};

export const AccountSection: React.FC<AccountSectionProps> = ({ personId, personName, personEmail, userId }) => {
  const queryClient = useQueryClient();
  const onChanged = async () => {
    await Promise.all([queryClient.invalidateQueries({ queryKey: PEOPLE_QUERY_KEYS.all }), queryClient.invalidateQueries({ queryKey: userKeys.all })]);
  };

  return (
    <section aria-label={`Account for ${personName}`} className="space-y-4">
      <div className="pb-3 border-b border-slate-800">
        <h3 className="text-sm font-bold text-white">Account</h3>
        <p className="text-xs text-slate-400">The login this person uses to sign in, its state and its roles.</p>
      </div>
      {userId ? <Linked personId={personId} userId={userId} onChanged={onChanged} /> : <NoLogin personId={personId} personEmail={personEmail} onLinked={onChanged} />}
    </section>
  );
};
