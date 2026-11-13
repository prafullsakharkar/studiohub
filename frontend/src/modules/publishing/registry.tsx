import { DESTINATION_PROTOCOLS, DESTINATION_TYPES, FILE_ROLES, pathTemplatesApi, publishDestinationsApi, storageRootsApi, TEMPLATE_TOKENS } from '@/api/publishing/publishing';
import type { PathTemplate, PublishDestination, StorageRoot } from '@/api/publishing/publishing';
import { ProjectPicker } from '@/modules/production/work/pickers';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { StatusBadge } from '@/shared/components/StatusBadge';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));
const active = (on: boolean) => (on ? <StatusBadge status="Active" /> : <StatusBadge status="Inactive" />);

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
  listTitle: 'Storage roots',
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
  listTitle: 'Publish destinations',
  basePath: '/publishing/destinations',
  queryKey: publishDestinationsApi.keys.lists(),
  fields: publishDestinationsFormFields,
  get: publishDestinationsApi.get,
  create: (input) => publishDestinationsApi.create(input as never),
  update: (id, patch) => publishDestinationsApi.update(id, patch as never),
  afterSavePath: () => '/publishing/destinations',
};

// ------------------------------------------------------------------------------------------- path templates

/** `scope.projectId`: one project's own templates (its Publishing tab); without it, every template the caller can read. */
export function usePathTemplatesListConfig(scope?: { projectId?: string }): DirectoryListConfig<PathTemplate> {
  return {
    title: 'Path templates',
    noun: 'path template',
    subtitle: scope?.projectId
      ? 'Where this project’s files of each type and role should live. A file type and role with no template here follows the studio’s. Only a template that enforces refuses a file registered elsewhere.'
      : 'Where files of each type and role should live. A template with no project is the studio’s; a project’s own template wins over it. Only a template that enforces refuses a file registered elsewhere.',
    queryKey: pathTemplatesApi.keys.lists(),
    fetchPage: pathTemplatesApi.list,
    // No delete (405): retire a template by making it inactive.
    remove: async () => undefined,
    canRemove: () => false,
    createPermission: 'publishing.template.manage',
    managePermission: 'publishing.template.manage',
    rowName: (row) => `${row.file_type} (${row.role})`,
    defaultOrdering: 'role',
    searchPlaceholder: 'Search',
    searchable: false, // the route has no search
    basePath: '/publishing/path-templates',
    rowLink: () => null, // no detail page: Edit is in the last column
    scope: scope?.projectId ? { project_id: scope.projectId } : undefined,
    createQuery: scope?.projectId ? `project=${scope.projectId}` : undefined,
    filters: [{ key: 'role', label: 'Role', options: options(FILE_ROLES) }],
    columns: [
      { header: 'File type', cell: (row) => `${row.file_type} · ${row.role}` },
      ...(scope?.projectId ? [] : [{ header: 'Applies to', cell: (row: PathTemplate) => (row.project_id ? 'A project' : <Badge variant="info">Studio</Badge>) }]),
      { header: 'Root', cell: (row) => row.storage_root },
      { header: 'Pattern', cell: (row) => <span className="font-mono text-xs break-all">{row.pattern}</span> },
      { header: 'Enforced', cell: (row) => (row.enforce ? <Badge variant="warning">Refuses other paths</Badge> : 'Advice only') },
      { header: 'State', cell: (row) => active(row.is_active) },
    ],
  };
}

const KEY_HINT = 'Fixed once the template is saved: retire it and make another to change it.';

export const pathTemplateFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', label: 'Project', rowKey: 'project_id', onlyOnCreate: true, render: (p) => <ProjectPicker label="Project (leave empty for the studio’s template)" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'file_type', label: 'File type code', required: true, maxLength: 64, onlyOnCreate: true, hint: `A code from the file type catalog. ${KEY_HINT}` },
  { kind: 'select', name: 'role', label: 'Role', options: options(FILE_ROLES), initial: 'main', onlyOnCreate: true },
  { kind: 'text', name: 'storage_root', label: 'Storage root code', required: true, maxLength: 64 },
  {
    kind: 'text',
    name: 'pattern',
    label: 'Pattern',
    required: true,
    maxLength: 1024,
    hint: `A path under the root, with tokens: ${TEMPLATE_TOKENS.map((token) => `{${token}}`).join(' ')}. {version:03} pads the version, {frame:6} sets the frame width, and {name} is chosen by the tool.`,
  },
  { kind: 'checkbox', name: 'enforce', label: 'Refuse files of this type and role registered anywhere else' },
  { kind: 'checkbox', name: 'is_active', label: 'Active (an inactive template is ignored)', initial: true },
];

export const pathTemplateFormConfig: DirectoryFormConfig<PathTemplate> = {
  noun: 'path template',
  listTitle: 'Path templates',
  basePath: '/publishing/path-templates',
  queryKey: pathTemplatesApi.keys.lists(),
  fields: pathTemplateFormFields,
  get: pathTemplatesApi.get,
  create: (input) => pathTemplatesApi.create({ ...input, project: input.project || null } as never),
  update: (id, patch) => pathTemplatesApi.update(id, patch as never),
  afterSavePath: () => '/publishing/path-templates',
};
