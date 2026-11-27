import { DEPARTMENT_TYPES, departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import type { Department } from '@/api/masterdata/departments';
import type { DirectoryListConfig } from '../types';
import { formatDate } from '@/core/locale/studioLocale';

const typeLabel = (type: Department['department_type']) => DEPARTMENT_TYPES.find((t) => t.value === type)?.label ?? type;

/**
 * The Departments list: Table and Card views, Edit and Delete per row. The form stays the department's own
 * (`modules/departments/pages/CreateDepartmentPage.tsx`: parent, manager and toolchain pickers). The key is
 * `lists()`, which the form's create and save both refresh.
 */
export const departmentsListConfig: DirectoryListConfig<Department> = {
  title: 'Departments',
  noun: 'department',
  subtitle: 'Functional studio departments (Lighting, Comp, FX, Pipeline).',
  queryKey: departmentKeys.lists(),
  fetchPage: departmentsApi.list,
  remove: departmentsApi.remove,
  rowName: (d) => d.name,
  defaultOrdering: 'name',
  searchPlaceholder: 'Search name or code…',
  basePath: '/departments',
  managePermission: 'masterdata.directory.manage',
  filters: [{ key: 'department_type', label: 'Type', options: DEPARTMENT_TYPES }],
  columns: [
    {
      header: 'Name',
      cell: (d) => (
        <span className="inline-flex items-center gap-2">
          {d.color && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} aria-hidden />}
          {d.name}
        </span>
      ),
      sortField: 'name',
    },
    { header: 'Code', cell: (d) => <span className="font-mono">{d.code}</span>, sortField: 'code' },
    { header: 'Type', cell: (d) => typeLabel(d.department_type) },
    { header: 'Description', cell: (d) => <span className="block max-w-xs truncate" title={d.description || undefined}>{d.description || '—'}</span> },
    { header: 'Created', cell: (d) => formatDate(d.created_at, ''), sortField: 'created_at' },
  ],
  exportColumns: [
    { header: 'Code', value: (d) => d.code },
    { header: 'Name', value: (d) => d.name },
    { header: 'Type', value: (d) => d.department_type },
    { header: 'Description', value: (d) => d.description },
    { header: 'Created', value: (d) => d.created_at },
  ],
};
