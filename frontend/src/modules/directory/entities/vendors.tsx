import { vendorsApi } from '@/api/masterdata/directory';
import type { Vendor } from '@/api/masterdata/directory';
import { Badge } from '@/shared/components/Badge';
import type { DirectoryFormConfig, DirectoryListConfig } from '../types';

export const vendorsListConfig: DirectoryListConfig<Vendor> = {
  title: 'Vendors',
  noun: 'vendor',
  subtitle: 'External studios and partners.',
  queryKey: vendorsApi.keys.all,
  fetchPage: vendorsApi.list,
  remove: vendorsApi.remove,
  rowName: (v) => v.name,
  defaultOrdering: 'name',
  searchPlaceholder: 'Search name, code or contact…',
  basePath: '/vendors',
  managePermission: 'masterdata.directory.manage',
  columns: [
    { header: 'Name', cell: (v) => v.name, sortField: 'name' },
    { header: 'Code', cell: (v) => <span className="font-mono">{v.code}</span>, sortField: 'code' },
    { header: 'Specialization', cell: (v) => v.specialization || '—' },
    { header: 'Location', cell: (v) => v.location || '—' },
    { header: 'Contacts', cell: (v) => v.contact_count },
    { header: 'NDA', cell: (v) => (v.nda_signed ? <Badge variant="success">Signed</Badge> : <Badge variant="neutral">No</Badge>) },
    { header: 'Status', cell: (v) => v.status || '—' },
  ],
  exportColumns: [
    { header: 'Code', value: (v) => v.code },
    { header: 'Name', value: (v) => v.name },
    { header: 'Specialization', value: (v) => v.specialization },
    { header: 'Location', value: (v) => v.location },
    { header: 'Status', value: (v) => v.status },
  ],
};

export const vendorsFormConfig: DirectoryFormConfig<Vendor> = {
  noun: 'vendor',
  basePath: '/vendors',
  queryKey: vendorsApi.keys.all,
  get: vendorsApi.get,
  create: (input) => vendorsApi.create(input as never),
  update: (id, patch) => vendorsApi.update(id, patch as never),
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'code', label: 'Code', required: true },
    { kind: 'text', name: 'contact_name', label: 'Main contact' },
    { kind: 'email', name: 'email', label: 'Email' },
    { kind: 'text', name: 'specialization', label: 'Specialization' },
    { kind: 'text', name: 'location', label: 'Location' },
    { kind: 'text', name: 'security_tier', label: 'Security tier' },
    { kind: 'text', name: 'status', label: 'Status' },
    { kind: 'number', name: 'rating', label: 'Rating' },
    { kind: 'number', name: 'bandwidth_gbps', label: 'Bandwidth (Gbps)' },
    { kind: 'text', name: 'bandwidth_link', label: 'Bandwidth link' },
    { kind: 'url', name: 'logo_url', label: 'Logo URL' },
    { kind: 'checkbox', name: 'nda_signed', label: 'NDA signed' },
  ],
};
