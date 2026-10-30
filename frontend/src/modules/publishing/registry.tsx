import { DESTINATION_PROTOCOLS, DESTINATION_TYPES, publishDestinationsApi, storageRootsApi } from '@/api/publishing/publishing';
import type { PublishDestination, StorageRoot } from '@/api/publishing/publishing';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));
const active = (on: boolean) => (on ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>);

// ------------------------------------------------------------------------------------------- storage roots

export function useRootsListConfig(): DirectoryListConfig<StorageRoot> {
  return {
    title: 'Storage roots',
    noun: 'storage root',
    subtitle: 'The named places files are published under. The paths are shown to artists; the server never opens them. A root that holds files cannot be deleted: make it inactive instead.',
    queryKey: storageRootsApi.keys.lists(),
    fetchPage: storageRootsApi.list,
    remove: storageRootsApi.remove,
    deletePermission: 'publishing.storage.manage',
    createPermission: 'publishing.storage.manage',
    managePermission: 'publishing.storage.manage',
    rowName: (row) => row.code,
    defaultOrdering: 'code',
    searchPlaceholder: 'Search',
    searchable: false, // the route has no search and the list is short
    basePath: '/publishing/storage-roots',
    rowLink: () => null, // no detail page: Edit is in the last column
    columns: [
      { header: 'Root', cell: (row) => `${row.code} · ${row.name}` },
      { header: 'Linux', cell: (row) => row.linux_path || '—' },
      { header: 'Windows', cell: (row) => row.windows_path || '—' },
      { header: 'Mac', cell: (row) => row.mac_path || '—' },
      { header: 'State', cell: (row) => active(row.is_active) },
    ],
  };
}

export const rootsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50, onlyOnCreate: true, hint: 'Letters, digits, _ and -, starting with a letter. Unique in any case and fixed for good: files keep it.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'text', name: 'linux_path', label: 'Linux path', maxLength: 500 },
  { kind: 'text', name: 'windows_path', label: 'Windows path', maxLength: 500 },
  { kind: 'text', name: 'mac_path', label: 'Mac path', maxLength: 500 },
  { kind: 'checkbox', name: 'is_active', label: 'Active (an inactive root refuses new files)', initial: true },
];

export const rootsFormConfig: DirectoryFormConfig<StorageRoot> = {
  noun: 'storage root',
  basePath: '/publishing/storage-roots',
  queryKey: storageRootsApi.keys.lists(),
  fields: rootsFormFields,
  get: storageRootsApi.get,
  create: (input) => storageRootsApi.create(input as never),
  update: (id, patch) => storageRootsApi.update(id, patch as never),
  afterSavePath: () => '/publishing/storage-roots',
};

// ------------------------------------------------------------------------------------------- destinations

export function usePublishDestinationsListConfig(): DirectoryListConfig<PublishDestination> {
  return {
    title: 'Publish destinations',
    noun: 'destination',
    subtitle: 'Where published work goes. One is the default; making another the default moves it.',
    queryKey: publishDestinationsApi.keys.lists(),
    fetchPage: publishDestinationsApi.list,
    remove: publishDestinationsApi.remove,
    deletePermission: 'publishing.delete',
    createPermission: 'publishing.create',
    managePermission: 'publishing.update',
    rowName: (row) => row.name,
    defaultOrdering: 'name',
    searchPlaceholder: 'Search name, path, region',
    basePath: '/publishing/destinations',
    rowLink: () => null,
    columns: [
      { header: 'Destination', cell: (row) => row.name, sortField: 'name' },
      { header: 'Type', cell: (row) => row.type },
      { header: 'Path', cell: (row) => row.path },
      { header: 'Protocol', cell: (row) => row.protocol },
      { header: 'Region', cell: (row) => row.region || '—' },
      { header: 'Default', cell: (row) => (row.is_default ? <Badge variant="info">Default</Badge> : '—') },
      { header: 'State', cell: (row) => active(row.is_active) },
    ],
  };
}

export const publishDestinationsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255, hint: 'Unique, in any case.' },
  { kind: 'select', name: 'type', label: 'Type', required: true, options: options(DESTINATION_TYPES) },
  { kind: 'text', name: 'path', label: 'Path', required: true, maxLength: 500 },
  { kind: 'select', name: 'protocol', label: 'Protocol', required: true, options: options(DESTINATION_PROTOCOLS) },
  { kind: 'text', name: 'region', label: 'Region', maxLength: 255 },
  { kind: 'checkbox', name: 'is_default', label: 'The default destination (moves the current default)' },
  { kind: 'checkbox', name: 'is_active', label: 'Active', initial: true },
];

export const publishDestinationsFormConfig: DirectoryFormConfig<PublishDestination> = {
  noun: 'destination',
  basePath: '/publishing/destinations',
  queryKey: publishDestinationsApi.keys.lists(),
  fields: publishDestinationsFormFields,
  get: publishDestinationsApi.get,
  create: (input) => publishDestinationsApi.create(input as never),
  update: (id, patch) => publishDestinationsApi.update(id, patch as never),
  afterSavePath: () => '/publishing/destinations',
};
