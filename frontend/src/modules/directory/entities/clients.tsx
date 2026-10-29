import { clientsApi } from '@/api/masterdata/directory';
import type { Client } from '@/api/masterdata/directory';
import { Badge } from '@/shared/components/Badge';
import type { DirectoryFormConfig, DirectoryListConfig } from '../types';

export const clientsListConfig: DirectoryListConfig<Client> = {
  title: 'Clients',
  noun: 'client',
  subtitle: 'Studios and customers the work is delivered to.',
  queryKey: clientsApi.keys.all,
  fetchPage: clientsApi.list,
  remove: clientsApi.remove,
  rowName: (c) => c.name,
  defaultOrdering: 'name',
  searchPlaceholder: 'Search name, code or contact…',
  basePath: '/clients',
  managePermission: 'masterdata.directory.manage',
  columns: [
    { header: 'Name', cell: (c) => c.name, sortField: 'name' },
    { header: 'Code', cell: (c) => <span className="font-mono">{c.code}</span>, sortField: 'code' },
    { header: 'Contact', cell: (c) => c.contact_name || '—' },
    { header: 'Type', cell: (c) => c.studio_type || '—' },
    { header: 'Contacts', cell: (c) => c.contact_count },
    // total_billed_usd is hidden by the API from callers without masterdata.client.view_financial.
    { header: 'Billed (USD)', cell: (c) => (c.total_billed_usd === undefined ? '—' : String(c.total_billed_usd)) },
    { header: 'Status', cell: (c) => <Badge variant={c.status === 'Active' ? 'success' : 'neutral'}>{c.status || '—'}</Badge> },
  ],
  exportColumns: [
    { header: 'Code', value: (c) => c.code },
    { header: 'Name', value: (c) => c.name },
    { header: 'Contact', value: (c) => c.contact_name },
    { header: 'Email', value: (c) => c.email },
    { header: 'Status', value: (c) => c.status },
  ],
};

export const clientsFormConfig: DirectoryFormConfig<Client> = {
  noun: 'client',
  basePath: '/clients',
  queryKey: clientsApi.keys.all,
  get: clientsApi.get,
  create: (input) => clientsApi.create(input as never),
  update: (id, patch) => clientsApi.update(id, patch as never),
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'code', label: 'Code', required: true },
    { kind: 'text', name: 'contact_name', label: 'Main contact' },
    { kind: 'email', name: 'email', label: 'Email' },
    { kind: 'tel', name: 'phone', label: 'Phone' },
    { kind: 'text', name: 'studio_type', label: 'Studio type' },
    { kind: 'text', name: 'contract_tier', label: 'Contract tier' },
    { kind: 'text', name: 'headquarters', label: 'Headquarters' },
    { kind: 'text', name: 'status', label: 'Status' },
    { kind: 'url', name: 'logo_url', label: 'Logo URL' },
    { kind: 'checkbox', name: 'portal_access', label: 'Portal access' },
    { kind: 'number', name: 'total_billed_usd', label: 'Total billed (USD)', permission: 'masterdata.client.view_financial' },
  ],
};
