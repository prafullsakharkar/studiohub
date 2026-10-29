import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { groupKeys, groupsApi } from '@/api/identity/rbac';
import type { Group } from '@/api/identity/rbac';
import { QueryBoundary } from '@/components/system/QueryBoundary';
import { Dialog } from '@/components/ui/Dialog';
import { notify } from '@/core/notifications/notify';
import { useCan } from '@/core/permissions/useCan';
import { usePaginatedList } from '@/shared/data/usePaginatedList';
import { useServerForm } from '@/shared/forms/useServerForm';
import { Badge } from '@/shared/components/Badge';
import { Button } from '@/shared/components/Button';
import { Pagination } from '@/shared/components/Pagination';
import { SearchInput } from '@/shared/components/SearchInput';
import { Field, FormBanner, PageShell, Table, inputClass } from '../components/ui';
import { ACCESS_TABS } from '../routes';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name'),
  code: z
    .string()
    .trim()
    .min(1, 'Enter a code')
    .regex(/^[a-z0-9][a-z0-9_.-]*$/, 'Use lowercase letters, digits, dots, dashes and underscores'),
  description: z.string().optional(),
});
type CreateValues = z.infer<typeof createSchema>;

const CreateGroupDialog: React.FC<{ isOpen: boolean; onClose: () => void; onCreated: (group: Group) => void }> = ({ isOpen, onClose, onCreated }) => {
  const queryClient = useQueryClient();
  const {
    register,
    submit,
    reset,
    serverError,
    clearServerError,
    formState: { errors, isSubmitting },
  } = useServerForm<CreateValues>({ resolver: zodResolver(createSchema), defaultValues: { name: '', code: '', description: '' } });

  const create = useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  });

  const close = () => {
    reset();
    clearServerError();
    onClose();
  };

  const onSubmit = submit(async (values) => {
    const group = await create.mutateAsync({ name: values.name, code: values.code, description: values.description || undefined });
    notify.success(`Group "${group.name}" was created.`);
    reset();
    onCreated(group);
  });

  return (
    <Dialog isOpen={isOpen} onClose={close} title="New group" size="md">
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormBanner error={serverError} />
        <Field id="group-name" label="Name" error={errors.name?.message}>
          <input id="group-name" className={inputClass(Boolean(errors.name))} {...register('name', { onChange: clearServerError })} />
        </Field>
        <Field id="group-code" label="Code" error={errors.code?.message} hint="Unique and permanent: it cannot be changed after the group is created.">
          <input id="group-code" className={inputClass(Boolean(errors.code))} {...register('code', { onChange: clearServerError })} />
        </Field>
        <Field id="group-description" label="Description" error={errors.description?.message}>
          <textarea id="group-description" rows={3} className={inputClass(Boolean(errors.description))} {...register('description')} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Create group
          </Button>
        </div>
      </form>
    </Dialog>
  );
};

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const canCreate = useCan('identity.group.create');
  const [creating, setCreating] = useState(false);
  const list = usePaginatedList<Group>({ queryKey: groupKeys.lists(), fetchPage: groupsApi.list, ordering: 'name' });

  return (
    <PageShell
      title="Groups"
      subtitle="A group collects users; every role attached to the group applies to all its members."
      tabs={ACCESS_TABS}
      actions={
        canCreate ? (
          <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            New group
          </Button>
        ) : undefined
      }
    >
      <SearchInput value={list.search} onChange={(e) => list.setSearch(e.target.value)} placeholder="Search groups by name or code" aria-label="Search groups" className="max-w-sm" />

      <QueryBoundary
        isLoading={list.isLoading}
        error={list.rows.length === 0 ? list.error : null}
        onRetry={() => void list.refetch()}
        entityName="groups"
        isEmpty={list.rows.length === 0}
        empty={{ title: 'No groups found', description: list.search ? 'No group matches your search.' : 'No groups have been created yet.', icon: <Users className="h-8 w-8" /> }}
      >
        <Table label="Groups" columns={['Name', 'Code', 'Status']}>
          {list.rows.map((group) => (
            <tr key={group.id} className="hover:bg-slate-900/60">
              <td className="px-4 py-2">
                <Link to={`/access/groups/${group.id}`} className="font-semibold text-cyan-300 hover:underline">
                  {group.name}
                </Link>
                {group.description && <p className="text-[11px] text-slate-500 line-clamp-1">{group.description}</p>}
              </td>
              <td className="px-4 py-2 font-mono text-slate-300">{group.code}</td>
              <td className="px-4 py-2">{group.is_system ? <Badge variant="purple">System</Badge> : <Badge variant="neutral">Custom</Badge>}</td>
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
          itemLabel="groups"
        />
      </QueryBoundary>

      <CreateGroupDialog isOpen={creating} onClose={() => setCreating(false)} onCreated={(group) => navigate(`/access/groups/${group.id}`)} />
    </PageShell>
  );
};
