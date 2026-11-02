import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auditKeys } from '@/api/audit/audit';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import type { Department, DepartmentInput } from '@/api/masterdata/departments';
import { notify } from '@/core/notifications/notify';
import { usePaginatedList } from '@/shared/data/usePaginatedList';

/** Server-side paginated, searchable, sortable department table. */
export function useDepartmentList(initial: { ordering?: string } = {}) {
  return usePaginatedList<Department>({
    queryKey: departmentKeys.lists(),
    fetchPage: departmentsApi.list,
    ordering: initial.ordering ?? 'name',
  });
}

/**
 * Create. Failures are NOT toasted here: the form maps field errors inline and shows the rest in
 * its banner (useServerForm), so a toast on top would say the same thing twice.
 */
export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DepartmentInput) => departmentsApi.create(input),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      notify.success(`${created.name} [${created.code}] was created.`, { title: 'Department created' });
    },
  });
}

/** Edit. As for create, the form shows the failure; a save refreshes the lists, the record and its history. */
export function useUpdateDepartment(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<DepartmentInput>) => departmentsApi.update(id, patch),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all });
      void queryClient.invalidateQueries({ queryKey: auditKeys.all });
      notify.success(`${updated.name} [${updated.code}] was saved.`, { title: 'Department saved' });
    },
  });
}

/** Delete. A 409 has_dependants is shown by ConfirmDialog, which keeps the dialog open. */
export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (department: Pick<Department, 'id' | 'name'>) => departmentsApi.remove(department.id),
    onSuccess: (_void, department) => {
      void queryClient.invalidateQueries({ queryKey: departmentKeys.lists() });
      notify.success(`${department.name} was deleted.`, { title: 'Department deleted' });
    },
  });
}
