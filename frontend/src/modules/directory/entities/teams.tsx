import { teamsApi } from '@/api/masterdata/directory';
import type { Team } from '@/api/masterdata/directory';
import type { DirectoryFormConfig, DirectoryListConfig } from '../types';
import { DepartmentPicker } from '../pickers';

export const teamsListConfig: DirectoryListConfig<Team> = {
  title: 'Teams',
  noun: 'team',
  subtitle: 'Working squads inside a department.',
  queryKey: teamsApi.keys.all,
  fetchPage: teamsApi.list,
  remove: teamsApi.remove,
  rowName: (t) => t.name,
  defaultOrdering: 'name',
  searchPlaceholder: 'Search name or code…',
  basePath: '/teams',
  managePermission: 'masterdata.directory.manage',
  columns: [
    { header: 'Name', cell: (t) => t.name, sortField: 'name' },
    { header: 'Code', cell: (t) => <span className="font-mono">{t.code}</span>, sortField: 'code' },
    { header: 'Capacity', cell: (t) => t.capacity ?? '—' },
    { header: 'Created', cell: (t) => new Date(t.created_at).toLocaleDateString(), sortField: 'created_at' },
  ],
  exportColumns: [
    { header: 'Code', value: (t) => t.code },
    { header: 'Name', value: (t) => t.name },
    { header: 'Department', value: (t) => t.department },
    { header: 'Capacity', value: (t) => t.capacity },
    { header: 'Created', value: (t) => t.created_at },
  ],
};

export const teamsFormConfig: DirectoryFormConfig<Team> = {
  noun: 'team',
  basePath: '/teams',
  queryKey: teamsApi.keys.all,
  get: teamsApi.get,
  create: (input) => teamsApi.create(input as never),
  update: (id, patch) => teamsApi.update(id, patch as never),
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'code', label: 'Code', required: true, hint: 'Unique, e.g. LGT-A.' },
    { kind: 'entity', name: 'department', label: 'Department', required: true, render: (p) => <DepartmentPicker required {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'textarea', name: 'description', label: 'Description' },
    { kind: 'text', name: 'focus_discipline', label: 'Focus discipline' },
    { kind: 'text', name: 'current_project_code', label: 'Current project code' },
    { kind: 'number', name: 'capacity', label: 'Capacity' },
    { kind: 'text', name: 'color', label: 'Color', hint: 'A hex color such as #4f46e5.' },
  ],
};
