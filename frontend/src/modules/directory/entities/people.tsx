import { PERSON_STATUSES, peopleApi } from '@/api/masterdata/directory';
import type { Person } from '@/api/masterdata/directory';
import { departmentKeys, departmentsApi } from '@/api/masterdata/departments';
import { officesApi, teamsApi } from '@/api/masterdata/directory';
import { Badge } from '@/shared/components/Badge';
import type { DirectoryFormConfig, DirectoryListConfig } from '../types';
import { DepartmentPicker, OfficePicker, PositionPicker, TeamPicker } from '../pickers';

const statusVariant = (status: Person['status']) => (status === 'active' ? 'success' : status === 'archived' ? 'neutral' : status === 'inactive' ? 'warning' : 'info');

export const peopleListConfig: DirectoryListConfig<Person> = {
  title: 'People',
  noun: 'person',
  subtitle: 'Everyone who works with the studio. A person may have a login (see the Account tab).',
  queryKey: peopleApi.keys.all,
  fetchPage: peopleApi.list,
  remove: peopleApi.remove,
  rowName: (p) => p.full_name || p.name,
  defaultOrdering: 'name',
  searchPlaceholder: 'Search name or email…',
  basePath: '/people',
  managePermission: 'masterdata.directory.manage',
  filters: [
    { key: 'status', label: 'Status', options: PERSON_STATUSES },
    { key: 'department', label: 'Department', optionsFrom: { queryKey: departmentKeys.all, fetchPage: departmentsApi.list, getLabel: (d: { name: string }) => d.name } },
    { key: 'team', label: 'Team', optionsFrom: { queryKey: teamsApi.keys.all, fetchPage: teamsApi.list, getLabel: (t: { name: string }) => t.name } },
    { key: 'office', label: 'Office', optionsFrom: { queryKey: officesApi.keys.all, fetchPage: officesApi.list, getLabel: (o: { name: string }) => o.name } },
  ],
  columns: [
    { header: 'Name', cell: (p) => p.full_name || p.name, sortField: 'name' },
    // Email and phone are absent for callers without masterdata.person.view_sensitive (observed on the wire).
    { header: 'Email', cell: (p) => p.email || '—' },
    { header: 'Department', cell: (p) => p.department_name || '—' },
    { header: 'Team', cell: (p) => p.team_name || '—' },
    { header: 'Office', cell: (p) => p.office_name || '—' },
    { header: 'Status', cell: (p) => <Badge variant={statusVariant(p.status)}>{p.status ?? 'active'}</Badge> },
  ],
  rowActions: (p) => {
    const name = p.full_name || p.name;
    if (p.status === 'archived') return [{ label: 'Restore', confirm: `Restore ${name}?`, run: () => peopleApi.act(p.id, 'restore') }];
    if (p.status === 'inactive') return [{ label: 'Reactivate', confirm: `Reactivate ${name}?`, run: () => peopleApi.act(p.id, 'reactivate') }];
    return [{ label: 'Deactivate', confirm: `Deactivate ${name}? They stay in the directory but are marked inactive.`, destructive: true, run: () => peopleApi.act(p.id, 'deactivate') }];
  },
  exportColumns: [
    { header: 'Name', value: (p) => p.full_name || p.name },
    { header: 'Email', value: (p) => p.email },
    { header: 'Department', value: (p) => p.department_name },
    { header: 'Team', value: (p) => p.team_name },
    { header: 'Office', value: (p) => p.office_name },
    { header: 'Status', value: (p) => p.status },
  ],
};

const SENSITIVE = 'masterdata.person.view_sensitive';

export const peopleFormConfig: DirectoryFormConfig<Person> = {
  noun: 'person',
  basePath: '/people',
  queryKey: peopleApi.keys.all,
  get: peopleApi.get,
  create: (input) => peopleApi.create(input as never),
  update: (id, patch) => peopleApi.update(id, patch as never),
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'email', name: 'email', label: 'Email', permission: SENSITIVE },
    { kind: 'tel', name: 'phone', label: 'Phone', permission: SENSITIVE },
    { kind: 'textarea', name: 'description', label: 'Description' },
    { kind: 'entity', name: 'department', label: 'Department', render: (p) => <DepartmentPicker {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'entity', name: 'team', label: 'Team', render: (p) => <TeamPicker {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'entity', name: 'office', label: 'Office', render: (p) => <OfficePicker {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'entity', name: 'role', label: 'Position', render: (p) => <PositionPicker label="Position" {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'text', name: 'seniority', label: 'Seniority' },
    { kind: 'text', name: 'timezone', label: 'Timezone', hint: 'IANA name, for example Asia/Kolkata.' },
    { kind: 'text', name: 'availability_status', label: 'Availability' },
    { kind: 'text', name: 'security_clearance', label: 'Security clearance', permission: SENSITIVE },
    { kind: 'date', name: 'date_of_birth', label: 'Date of birth', permission: SENSITIVE },
    { kind: 'text', name: 'nationality', label: 'Nationality', permission: SENSITIVE },
  ],
};
