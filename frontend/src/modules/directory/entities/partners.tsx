import { clientContactsApi, clientContractsApi, vendorContactsApi, vendorContractsApi } from '@/api/masterdata/directory';
import type { ClientContact, ClientContract, VendorContact, VendorContract } from '@/api/masterdata/directory';
import { Badge } from '@/shared/components/Badge';
import type { FieldDef, RelatedRecordsConfig, RowAction } from '../types';

const MANAGE = 'masterdata.directory.manage';

const contactFields = (extra: ReadonlyArray<FieldDef> = []): FieldDef[] => [
  { kind: 'text', name: 'name', label: 'Name', required: true },
  { kind: 'text', name: 'role', label: 'Role' },
  { kind: 'email', name: 'email', label: 'Email' },
  { kind: 'tel', name: 'phone', label: 'Phone' },
  { kind: 'text', name: 'timezone', label: 'Timezone' },
  ...extra,
  { kind: 'checkbox', name: 'is_primary', label: 'Primary contact' },
];

const contactColumns = <T extends { name: string; role?: string; email?: string; phone?: string; is_primary?: boolean }>() => [
  { header: 'Name', cell: (c: T) => c.name },
  { header: 'Role', cell: (c: T) => c.role || '—' },
  { header: 'Email', cell: (c: T) => c.email || '—' },
  { header: 'Phone', cell: (c: T) => c.phone || '—' },
  { header: 'Primary', cell: (c: T) => (c.is_primary ? <Badge variant="info">Primary</Badge> : '') },
];

export const clientContactsConfig: RelatedRecordsConfig<ClientContact> = {
  noun: 'contact',
  title: 'Contacts',
  queryKey: clientContactsApi.keys.all,
  parentField: 'client',
  fetchPage: clientContactsApi.list,
  create: (input) => clientContactsApi.create(input as never),
  update: (id, patch) => clientContactsApi.update(id, patch as never),
  remove: clientContactsApi.remove,
  rowName: (c) => c.name,
  defaultOrdering: 'name',
  managePermission: MANAGE,
  columns: contactColumns<ClientContact>(),
  fields: contactFields([{ kind: 'checkbox', name: 'portal_access', label: 'Portal access' }]),
};

export const vendorContactsConfig: RelatedRecordsConfig<VendorContact> = {
  noun: 'contact',
  title: 'Contacts',
  queryKey: vendorContactsApi.keys.all,
  parentField: 'vendor',
  fetchPage: vendorContactsApi.list,
  create: (input) => vendorContactsApi.create(input as never),
  update: (id, patch) => vendorContactsApi.update(id, patch as never),
  remove: vendorContactsApi.remove,
  rowName: (c) => c.name,
  defaultOrdering: 'name',
  managePermission: MANAGE,
  columns: contactColumns<VendorContact>(),
  fields: contactFields(),
};

/**
 * A contract's status is changed only by the lifecycle routes (the API refuses `status` on update):
 * Draft -> Active (activate), Draft/Active -> Terminated (terminate); adjust-end-date corrects the end of any.
 */
function contractActions(act: (id: string, action: string, body?: Record<string, unknown>) => Promise<unknown>, row: { id: string; status?: string; expiry_date?: string | null; contract_number: string }): RowAction[] {
  const actions: RowAction[] = [];
  if (row.status === 'Draft') actions.push({ label: 'Activate', confirm: `Activate contract ${row.contract_number}? Its dates then become fixed.`, run: () => act(row.id, 'activate') });
  if (row.status === 'Draft' || row.status === 'Active') actions.push({ label: 'Terminate', confirm: `Terminate contract ${row.contract_number}? This cannot be undone.`, destructive: true, run: () => act(row.id, 'terminate') });
  actions.push({
    label: 'Adjust end date',
    confirm: `Correct the end date of contract ${row.contract_number}.`,
    askDate: { label: 'New end date', initial: row.expiry_date },
    run: (date) => act(row.id, 'adjust-end-date', { expiry_date: date }),
  });
  return actions;
}

const statusBadge = (status?: string) => <Badge variant={status === 'Active' ? 'success' : status === 'Draft' ? 'info' : 'neutral'}>{status || '—'}</Badge>;

const contractFields = (moneyName: string, extra: ReadonlyArray<FieldDef>): FieldDef[] => [
  {
    kind: 'select',
    name: 'status',
    label: 'Starts as',
    required: true,
    options: [
      { value: 'Draft', label: 'Draft (editable, not yet in force)' },
      { value: 'Active', label: 'Active (needs an effective date)' },
    ],
  },
  { kind: 'text', name: 'contract_number', label: 'Contract number', required: true },
  { kind: 'text', name: 'title', label: 'Title', required: true },
  { kind: 'text', name: 'type', label: 'Type', hint: 'For example MSA or SOW. At most one active MSA may cover a given period.' },
  { kind: 'date', name: 'effective_date', label: 'Effective date' },
  { kind: 'date', name: 'expiry_date', label: 'Expiry date' },
  { kind: 'number', name: moneyName, label: 'Value', permission: 'masterdata.client.view_financial' },
  { kind: 'text', name: 'currency', label: 'Currency' },
  { kind: 'checkbox', name: 'nda_signed', label: 'NDA signed' },
  ...extra,
];

export const clientContractsConfig: RelatedRecordsConfig<ClientContract> = {
  noun: 'contract',
  title: 'Contracts',
  queryKey: clientContractsApi.keys.all,
  parentField: 'client',
  fetchPage: clientContractsApi.list,
  create: (input) => clientContractsApi.create(input as never),
  update: (id, patch) => clientContractsApi.update(id, patch as never),
  remove: clientContractsApi.remove,
  rowName: (c) => c.contract_number,
  defaultOrdering: 'contract_number',
  managePermission: MANAGE,
  rowActions: (c) => contractActions(clientContractsApi.act, c),
  columns: [
    { header: 'Number', cell: (c) => <span className="font-mono">{c.contract_number}</span> },
    { header: 'Title', cell: (c) => c.title },
    { header: 'Type', cell: (c) => c.type || '—' },
    { header: 'Period', cell: (c) => `${c.effective_date ?? '…'} → ${c.expiry_date ?? 'open'}` },
    { header: 'Value', cell: (c) => (c.value_usd === undefined ? '—' : `${c.value_usd} ${c.currency ?? ''}`) },
    { header: 'Status', cell: (c) => statusBadge(c.status) },
  ],
  immutableOnEdit: ['status'],
  fields: contractFields('value_usd', [{ kind: 'url', name: 'document_url', label: 'Document URL' }]),
};

export const vendorContractsConfig: RelatedRecordsConfig<VendorContract> = {
  noun: 'contract',
  title: 'Contracts',
  queryKey: vendorContractsApi.keys.all,
  parentField: 'vendor',
  fetchPage: vendorContractsApi.list,
  create: (input) => vendorContractsApi.create(input as never),
  update: (id, patch) => vendorContractsApi.update(id, patch as never),
  remove: vendorContractsApi.remove,
  rowName: (c) => c.contract_number,
  defaultOrdering: 'contract_number',
  managePermission: MANAGE,
  rowActions: (c) => contractActions(vendorContractsApi.act, c),
  columns: [
    { header: 'Number', cell: (c) => <span className="font-mono">{c.contract_number}</span> },
    { header: 'Title', cell: (c) => c.title },
    { header: 'Type', cell: (c) => c.type || '—' },
    { header: 'Period', cell: (c) => `${c.effective_date ?? '…'} → ${c.expiry_date ?? 'open'}` },
    { header: 'Value', cell: (c) => (c.total_value_usd === undefined ? '—' : `${c.total_value_usd} ${c.currency ?? ''}`) },
    { header: 'Status', cell: (c) => statusBadge(c.status) },
  ],
  immutableOnEdit: ['status'],
  fields: contractFields('total_value_usd', [{ kind: 'text', name: 'security_tier', label: 'Security tier' }]),
};
