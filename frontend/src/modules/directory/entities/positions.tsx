import { positionsApi } from '@/api/masterdata/directory';
import type { Position } from '@/api/masterdata/directory';
import { Badge } from '@/shared/components/Badge';
import type { DirectoryFormConfig, DirectoryListConfig } from '../types';
import { DepartmentPicker, PositionPicker } from '../pickers';

export const positionsListConfig: DirectoryListConfig<Position> = {
  title: 'Positions',
  noun: 'position',
  subtitle: 'Job positions and their level in the studio hierarchy.',
  queryKey: positionsApi.keys.all,
  fetchPage: positionsApi.list,
  remove: positionsApi.remove,
  rowName: (p) => p.name,
  defaultOrdering: 'level',
  searchPlaceholder: 'Search name or code…',
  basePath: '/positions',
  managePermission: 'masterdata.directory.manage',
  filters: [{ key: 'is_managerial', label: 'Kind', options: [{ value: 'true', label: 'Managerial' }, { value: 'false', label: 'Individual contributor' }] }],
  columns: [
    { header: 'Name', cell: (p) => p.name, sortField: 'name' },
    { header: 'Code', cell: (p) => <span className="font-mono">{p.code}</span> },
    { header: 'Level', cell: (p) => p.level ?? '—', sortField: 'level' },
    { header: 'Kind', cell: (p) => (p.is_managerial ? <Badge variant="info">Managerial</Badge> : 'Individual contributor') },
  ],
  exportColumns: [
    { header: 'Code', value: (p) => p.code },
    { header: 'Name', value: (p) => p.name },
    { header: 'Level', value: (p) => p.level },
    { header: 'Managerial', value: (p) => p.is_managerial },
  ],
};

export const positionsFormConfig: DirectoryFormConfig<Position> = {
  noun: 'position',
  basePath: '/positions',
  queryKey: positionsApi.keys.all,
  get: positionsApi.get,
  create: (input) => positionsApi.create(input as never),
  update: (id, patch) => positionsApi.update(id, patch as never),
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'code', label: 'Code', required: true },
    { kind: 'textarea', name: 'description', label: 'Description' },
    { kind: 'entity', name: 'department', label: 'Department', render: (p) => <DepartmentPicker {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'entity', name: 'parent', label: 'Reports to (parent position)', render: (p) => <PositionPicker label="Parent position" {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'number', name: 'level', label: 'Level', hint: 'Lower numbers are more senior.' },
    { kind: 'checkbox', name: 'is_managerial', label: 'Managerial position' },
    { kind: 'text', name: 'band_level', label: 'Band' },
    { kind: 'text', name: 'salary_range', label: 'Salary range' },
    { kind: 'text', name: 'employment_type', label: 'Employment type' },
  ],
};
