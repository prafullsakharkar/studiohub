import type React from 'react';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { rolesApi, roleKeys } from '@/api/identity/rbac';
import type { Role } from '@/api/identity/rbac';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { useCan } from '@/core/permissions/useCan';
import { notify } from '@/core/notifications/notify';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { Field, FormBanner, PageShell, Table, inputClass } from '../components/ui';
import { ACCESS_TABS } from '../routes';

const PRIORITIES = [
  { value: 10, label: 'Admin' },
  { value: 20, label: 'Manager' },
  { value: 30, label: 'Lead' },
  { value: 40, label: 'Member' },
  { value: 50, label: 'Guest' },
  { value: 60, label: 'Viewer' },
] as const;

// The backend owns the rules (unique code, immutable afterwards); we only require what it requires.
const createSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  code: z
    .string()
    .trim()
    .min(1, 'Enter a code')
    .regex(/^[a-z0-9][a-z0-9_.-]*$/, 'Use lowercase letters, digits, dots, dashes and underscores'),
  description: z.string().optional(),
  priority: z.number(),
});
type CreateValues = z.infer<typeof createSchema>;

const CreateRoleDialog: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: (role: Role) => void }> = ({ isOpen, onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', code: '', description: '', priority: 40 } });

  const create = useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roleKeys.all }),
  });

  const close = () => {
    reset();
    clearServerError();
    onClose();
  };

  const onSubmit = submit(async (values) => {
    const role = await create.mutateAsync({
      name: values.name,
      code: values.code,
      description: values.description || undefined,
      priority: values.priority as Role['priority'],
    });
    notify.success(`Role "${role.name}" was created.`);
    reset();
    onCreated(role);
  });

  return (
    <Dialog isOpen={isOpen} onClose={close} title="New role" size="md">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormBanner error={serverError} />
        <Field id="role-name" label="Name" error={errors.name?.message}>
          <input id="role-name" className={inputClass(Boolean(errors.name))} {...register('name', { onChange: clearServerError })} />
        </Field>
        <Field id="role-code" label="Code" error={errors.code?.message} hint="Unique and permanent: it cannot be changed after the role is created.">
          <input id="role-code" className={inputClass(Boolean(errors.code))} {...register('code', { onChange: clearServerError })} />
        </Field>
        <Field id="role-priority" label="Level" error={errors.priority?.message}>
          <select id="role-priority" className={inputClass(Boolean(errors.priority))} {...register('priority', { valueAsNumber: true })}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="role-description" label="Description" error={errors.description?.message}>
          <textarea id="role-description" rows={3} className={inputClass(Boolean(errors.description))} {...register('description')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Create role
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export const RolesPage: React.FC = () => {
  const navigate = useNavigate();
  const canCreate = useCan('identity.role.create');
  const [creating, setCreating] = useState(false);
  const list = usePaginatedList<Role>({ queryKey: roleKeys.lists(), fetchPage: rolesApi.list, ordering: 'priority' });

  return (
    <PageShell
      title="Roles"
      subtitle="A role is a set of permissions. Users receive roles directly or through groups."
      tabs={ACCESS_TABS}
      actions={
        canCreate ? (
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New role
          </Button>
        ) : undefined
      }
    >
      <SearchInput value={list.search} onChange={(e) => list.setSearch(e.target.value)} placeholder="Search roles by name or code" aria-label="Search roles" className="max-w-sm" />

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.rows.length === 0 ? list.error : null}
        onRetry={() => void list.refetch()}
        entityName="roles"
        isEmpty={list.rows.length === 0}
        empty={{ title: 'No roles found', description: list.search ? 'No role matches your search.' : 'No roles have been created yet.', icon: <Shield className="h-8 w-8" /> }}
      >
        <Table label="Roles" columns={['Name', 'Code', 'Level', 'Scope', 'Status']}>
          {list.rows.map((role) => (
            <tr key={role.id} className="hover:bg-slate-900/60">
              <td className="px-4 py-2">
                <Link to={`/access/roles/${role.id}`} className="font-semibold text-cyan-300 hover:underline">
                  {role.name}
                </Link>
                {role.description && <p className="text-[11px] text-slate-500 line-clamp-1">{role.description}</p>}
              </td>
              <td className="px-4 py-2 font-mono text-slate-300">{role.code}</td>
              <td className="px-4 py-2 text-slate-300">{PRIORITIES.find((p) => p.value === role.priority)?.label ?? '—'}</td>
              <td className="px-4 py-2 capitalize text-slate-300">{role.scope}</td>
              <td className="px-4 py-2 space-x-1">
                {role.is_system && <Badge variant="purple">System</Badge>}
                <Badge variant={role.is_active === false ? 'neutral' : 'success'}>{role.is_active === false ? 'Inactive' : 'Active'}</Badge>
              </td>
            </tr>
          ))}
        </Table>
        <Pagination
          currentPage={list.page}
          totalCount={list.count}
          pageSize={list.pageSize}
          totalPages={list.pageCount}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          itemLabel="roles"
        />
      </QueryBoundary>

      <CreateRoleDialog isOpen={creating} onClose={() => setCreating(false)} onCreated={(role) => navigate(`/access/roles/${role.id}`)} />
    </PageShell>
  );
};
