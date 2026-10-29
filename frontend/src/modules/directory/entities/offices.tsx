import { officesApi } from '@/api/masterdata/directory';
import type { Office } from '@/api/masterdata/directory';
import { Badge } from '@/shared/components/Badge';
import type { DirectoryFormConfig, DirectoryListConfig } from '../types';

export const officesListConfig: DirectoryListConfig<Office> = {
  title: 'Offices',
  noun: 'office',
  subtitle: 'Studio locations and their capacity.',
  queryKey: officesApi.keys.all,
  fetchPage: officesApi.list,
  remove: officesApi.remove,
  rowName: (o) => o.name,
  defaultOrdering: 'name',
  searchPlaceholder: 'Search name, code or city…',
  basePath: '/offices',
  managePermission: 'masterdata.directory.manage',
  filters: [
    { key: 'is_active', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
    { key: 'is_headquarters', label: 'Headquarters', options: [{ value: 'true', label: 'Headquarters' }, { value: 'false', label: 'Not headquarters' }] },
  ],
  columns: [
    { header: 'Name', cell: (o) => o.name, sortField: 'name' },
    { header: 'Code', cell: (o) => <span className="font-mono">{o.code}</span>, sortField: 'code' },
    { header: 'City', cell: (o) => `${o.city}, ${o.country}` },
    { header: 'Headcount', cell: (o) => o.headcount },
    {
      header: 'Status',
      cell: (o) => (
        <span className="space-x-1">
          {o.is_headquarters && <Badge variant="purple">HQ</Badge>}
          <Badge variant={o.is_active === false ? 'neutral' : 'success'}>{o.is_active === false ? 'Inactive' : 'Active'}</Badge>
        </span>
      ),
    },
  ],
  exportColumns: [
    { header: 'Code', value: (o) => o.code },
    { header: 'Name', value: (o) => o.name },
    { header: 'Type', value: (o) => o.office_type },
    { header: 'City', value: (o) => o.city },
    { header: 'Country', value: (o) => o.country },
    { header: 'Timezone', value: (o) => o.timezone },
    { header: 'Headcount', value: (o) => o.headcount },
  ],
};

export const officesFormConfig: DirectoryFormConfig<Office> = {
  noun: 'office',
  basePath: '/offices',
  queryKey: officesApi.keys.all,
  get: officesApi.get,
  create: (input) => officesApi.create(input as never),
  update: (id, patch) => officesApi.update(id, patch as never),
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'code', label: 'Code', required: true },
    { kind: 'text', name: 'office_type', label: 'Type', required: true, hint: 'For example headquarters or branch.' },
    { kind: 'text', name: 'city', label: 'City', required: true },
    { kind: 'text', name: 'country', label: 'Country', required: true, hint: 'Country code, for example IN.' },
    { kind: 'text', name: 'timezone', label: 'Timezone', required: true, hint: 'IANA name, for example Asia/Kolkata.' },
    { kind: 'text', name: 'state', label: 'State / region' },
    { kind: 'textarea', name: 'address', label: 'Address' },
    { kind: 'text', name: 'postal_code', label: 'Postal code' },
    { kind: 'tel', name: 'phone', label: 'Phone' },
    { kind: 'email', name: 'email', label: 'Email' },
    { kind: 'text', name: 'working_hours', label: 'Working hours' },
    { kind: 'number', name: 'workstations_count', label: 'Workstations' },
    { kind: 'number', name: 'render_nodes_count', label: 'Render nodes' },
    { kind: 'checkbox', name: 'is_active', label: 'Active' },
    { kind: 'checkbox', name: 'is_headquarters', label: 'Headquarters' },
  ],
};
