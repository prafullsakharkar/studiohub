import { deliveriesApi, DELIVERY_METHODS, destinationsApi } from '@/api/deliveries/deliveries';
import type { Delivery, DeliveryDestination, DeliveryRow } from '@/api/deliveries/deliveries';
import { isDeletable, isEditable } from '@/api/deliveries/deliveryFlow';
import { EntityPicker } from '@/components/forms/EntityPicker';
import type { BulkAction, DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { ClientPicker } from '@/modules/directory/pickers';
import { ProjectPicker } from '@/modules/production/work/pickers';
import { Badge } from '@/shared/components/Badge';
import { deliveryErrorMessage } from './errors';
import { formatBytes, formatDay } from './format';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

export const deliveryStatusVariant = (status: string) => {
  switch (status) {
    case 'Approved':
    case 'Completed':
      return 'success';
    case 'Rejected':
      return 'destructive';
    case 'Validating':
      return 'info';
    case 'Ready':
      return 'cyan';
    case 'Signed Off':
      return 'purple';
    case 'Submitted':
      return 'warning';
    default:
      return 'neutral';
  }
};
export const DeliveryStatusBadge = ({ status }: { status: string }) => <Badge variant={deliveryStatusVariant(status)}>{status}</Badge>;

/** The client's answer is only worth a badge once there is one. */
export const clientAnswer = (status: string) => (status === 'Approved' || status === 'Rejected' ? <Badge variant={status === 'Approved' ? 'success' : 'destructive'}>{status}</Badge> : '—');

export const DestinationPicker = ({ value, onChange, label = 'Destination', error }: { value: string | null | undefined; onChange: (id: string | null) => void; label?: string; error?: string }) => (
  <EntityPicker<DeliveryDestination> label={label} queryKey={destinationsApi.keys.all} fetchPage={destinationsApi.list} fetchOne={destinationsApi.get} getLabel={(d) => `${d.name} (${d.type})`} value={value} onChange={onChange} error={error} />
);

/** Cancels the ticked deliveries with one reason; the server answers per id (200, or 207 when some were refused). */
const bulkCancel: BulkAction = {
  label: 'Cancel deliveries',
  confirm: (count) => `Cancel ${count} deliver${count === 1 ? 'y' : 'ies'}? A sent delivery cannot be cancelled and will be reported as refused.`,
  destructive: true,
  input: {
    label: 'Reason (optional)',
    render: ({ value, onChange }) => <input aria-label="Reason" value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200" />,
  },
  run: async (ids, reason) => {
    try {
      const result = await deliveriesApi.bulkCancel(ids, reason?.trim() || undefined);
      return result.failed_count === 0 ? `${result.succeeded_count} cancelled.` : `${result.succeeded_count} cancelled, ${result.failed_count} refused (already sent, finished or not yours to cancel).`;
    } catch (error) {
      throw new Error(deliveryErrorMessage(error));
    }
  },
};

export function useDeliveriesListConfig(scope?: { projectId: string }): DirectoryListConfig<DeliveryRow> {
  return {
    title: 'Deliveries',
    noun: 'delivery',
    subtitle: 'What was sent to the client, when, by whom and after whose sign-off. The transfer itself happens outside StudioHub.',
    queryKey: deliveriesApi.keys.lists(),
    // The list route ignores a project filter (CR-17); a project's own route is scoped and searchable.
    fetchPage: scope ? deliveriesApi.ofProject(scope.projectId) : deliveriesApi.list,
    remove: deliveriesApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'delivery.delete',
    createPermission: 'delivery.create',
    managePermission: 'delivery.update',
    // A sent delivery is a record: it is not edited or deleted (the server would let it be deleted, CR-18).
    canEdit: (row) => isEditable(row.status),
    canRemove: (row) => isDeletable(row.status),
    rowName: (row) => row.code,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search name, code, client',
    basePath: '/deliveries',
    createQuery: scope ? `project_id=${scope.projectId}` : undefined,
    bulk: { actions: [bulkCancel] },
    columns: [
      { header: 'Delivery', cell: (row) => `${row.code} · ${row.name}`, sortField: 'created_at' },
      ...(scope ? [] : [{ header: 'Project', cell: (row: DeliveryRow) => row.project_name || '—' }]),
      { header: 'Client', cell: (row) => row.client_name || '—' },
      { header: 'Method', cell: (row) => row.delivery_method },
      { header: 'Items', cell: (row) => row.version_count },
      { header: 'Size', cell: (row) => formatBytes(row.total_size_bytes) },
      { header: 'Due', cell: (row) => (row.expires_at ? <span className={row.is_expired ? 'text-rose-400' : undefined}>{formatDay(row.expires_at)}</span> : '—') },
      { header: 'Client answer', cell: (row) => clientAnswer(row.client_status) },
      { header: 'Status', sortField: 'status', cell: (row) => <DeliveryStatusBadge status={row.status} /> },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Project', value: (r) => r.project_name },
      { header: 'Client', value: (r) => r.client_name ?? '' },
      { header: 'Method', value: (r) => r.delivery_method },
      { header: 'Items', value: (r) => r.version_count },
      { header: 'Size (bytes)', value: (r) => r.total_size_bytes },
      { header: 'Due', value: (r) => r.expires_at ?? '' },
      { header: 'Status', value: (r) => r.status },
      { header: 'Client answer', value: (r) => r.client_status },
    ],
  };
}

export const deliveriesFormFields: ReadonlyArray<FieldDef> = [
  // The project, client and code are chosen once: the server does not change them afterwards.
  { kind: 'entity', name: 'project_id', rowKey: 'project', label: 'Project', required: true, onlyOnCreate: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'entity', name: 'client_id', rowKey: 'client', label: 'Client', onlyOnCreate: true, render: (p) => <ClientPicker label="Client" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', maxLength: 50, onlyOnCreate: true, hint: 'Leave empty for DLV-<project>-<number>.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'select', name: 'delivery_method', label: 'Method', options: options(DELIVERY_METHODS), initial: 'S3' },
  { kind: 'entity', name: 'destination_id', rowKey: 'destination', label: 'Destination', render: (p) => <DestinationPicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'date', name: 'expires_at', label: 'Due date', hint: 'Only a reminder: nothing expires.' },
  { kind: 'text', name: 'passcode', label: 'Passcode', maxLength: 64, hint: 'Write-only. Leave blank to keep the current one; only people allowed to see secrets can read it back.' },
  { kind: 'textarea', name: 'notes', label: 'Internal notes' },
  { kind: 'textarea', name: 'client_notes', label: 'Notes for the client' },
];

/** The form's date field is a day; the server keeps a time, so a day goes out as midnight UTC and comes back as a day. */
const toWire = (input: Record<string, unknown>): Record<string, unknown> => {
  const day = input.expires_at;
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) ? { ...input, expires_at: `${day}T00:00:00Z` } : input;
};

export const deliveriesFormConfig: DirectoryFormConfig<Delivery> = {
  noun: 'delivery',
  basePath: '/deliveries',
  queryKey: deliveriesApi.keys.lists(),
  fields: deliveriesFormFields,
  get: async (id, signal) => {
    const delivery = await deliveriesApi.get(id, signal);
    return { ...delivery, expires_at: delivery.expires_at ? delivery.expires_at.slice(0, 10) : null };
  },
  create: (input) => deliveriesApi.create(toWire(input) as never),
  update: (id, patch) => deliveriesApi.update(id, toWire(patch) as never),
};
