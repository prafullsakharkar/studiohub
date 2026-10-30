import { DESTINATION_TYPES, destinationsApi } from '@/api/deliveries/deliveries';
import type { DeliveryDestination } from '@/api/deliveries/deliveries';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';

export function useDestinationsListConfig(): DirectoryListConfig<DeliveryDestination> {
  return {
    title: 'Delivery destinations',
    noun: 'destination',
    subtitle: 'Where deliveries are sent. Only the address is kept here: credentials are never stored, the flag says whether they are set up elsewhere.',
    queryKey: destinationsApi.keys.lists(),
    fetchPage: destinationsApi.list,
    remove: destinationsApi.remove,
    deletePermission: 'delivery.delete',
    createPermission: 'delivery.create',
    managePermission: 'delivery.update',
    rowName: (row) => row.name,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search name, endpoint, region',
    basePath: '/deliveries/destinations',
    rowLink: () => null, // no detail page: Edit is in the last column
    columns: [
      { header: 'Destination', cell: (row) => row.name, sortField: 'name' },
      { header: 'Type', cell: (row) => row.type },
      { header: 'Endpoint', cell: (row) => `${row.endpoint}${row.port ? `:${row.port}` : ''}${row.target_directory ? ` ${row.target_directory}` : ''}` },
      { header: 'Region', cell: (row) => row.storage_region || '—' },
      { header: 'Credentials', cell: (row) => (row.credentials_configured ? <Badge variant="success">Set up</Badge> : <Badge variant="neutral">Not set up</Badge>) },
      { header: 'Default', cell: (row) => (row.is_default ? <Badge variant="info">Default</Badge> : '—') },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>) },
    ],
  };
}

const typeOptions = DESTINATION_TYPES.map((value) => ({ value, label: value }));

export const destinationsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255, hint: 'Unique, in any case.' },
  { kind: 'select', name: 'type', label: 'Type', required: true, options: typeOptions },
  { kind: 'text', name: 'endpoint', label: 'Endpoint', required: true, maxLength: 500, hint: 'An address, URL or bucket.' },
  { kind: 'number', name: 'port', label: 'Port' },
  { kind: 'text', name: 'target_directory', label: 'Target directory', maxLength: 500 },
  { kind: 'text', name: 'region', rowKey: 'storage_region', label: 'Region', maxLength: 255 },
  { kind: 'number', name: 'rate', rowKey: 'transfer_rate_mbps', label: 'Transfer rate (Mbps)' },
  { kind: 'checkbox', name: 'is_default', label: 'The default destination (moves the current default)' },
  { kind: 'checkbox', name: 'is_active', label: 'Active', initial: true },
];

export const destinationsFormConfig: DirectoryFormConfig<DeliveryDestination> = {
  noun: 'destination',
  basePath: '/deliveries/destinations',
  queryKey: destinationsApi.keys.lists(),
  fields: destinationsFormFields,
  get: destinationsApi.get,
  create: (input) => destinationsApi.create(input as never),
  update: (id, patch) => destinationsApi.update(id, patch as never),
  afterSavePath: () => '/deliveries/destinations',
};
