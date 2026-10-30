import { Link } from 'react-router-dom';
import { FILE_ROLES, FILE_STATUSES, publishedFilesApi, storageRootsApi } from '@/api/publishing/publishing';
import type { PublishedFile, StorageRoot } from '@/api/publishing/publishing';
import { fileActionsFrom } from '@/api/publishing/publishingFlow';
import { projectsApi } from '@/api/production/structure';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { useCan } from '@/core/permissions/useCan';
import { formatBytes } from '@/modules/deliveries/format';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { VersionPicker } from '@/modules/production/review/pickers';
import { Badge } from '@/shared/components/Badge';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

export const fileStatusVariant = (status: string) => (status === 'Registered' ? 'success' : status === 'Revoked' ? 'destructive' : 'warning');
export const checksumVariant = (state: string) => (state === 'verified' ? 'success' : state === 'mismatch' || state === 'missing' ? 'destructive' : 'neutral');
export const FileStatusBadge = ({ status }: { status: string }) => <Badge variant={fileStatusVariant(status)}>{status}</Badge>;
export const ChecksumBadge = ({ state }: { state: string }) => <Badge variant={checksumVariant(state)}>{state}</Badge>;

/** A frame range reads as `1001–1096`; a single file as nothing. */
export const frames = (f: Pick<PublishedFile, 'frame_start' | 'frame_end'>) => (f.frame_start !== null && f.frame_end !== null ? `${f.frame_start}–${f.frame_end}` : '');

/** Lifecycle actions of a file, each behind a confirmation; revoking needs its own permission and a reason. */
export function fileRowActions(row: PublishedFile, can: { deprecate: boolean; revoke: boolean }): RowAction[] {
  return fileActionsFrom(row.status)
    .filter((a) => (a.permission === 'publishing.revoke' ? can.revoke : can.deprecate))
    .map((a) => ({
      label: a.label,
      confirm: a.confirm,
      destructive: a.destructive,
      askText: a.ask,
      run: (_date?: string, text?: string) => (a.action === 'deprecate' ? publishedFilesApi.deprecate(row.id, text) : a.action === 'restore' ? publishedFilesApi.restore(row.id) : publishedFilesApi.revoke(row.id, text ?? '')),
    }));
}

export function useFilesListConfig(scope?: { projectId: string }): DirectoryListConfig<PublishedFile> {
  const canDeprecate = useCan('publishing.deprecate');
  const canRevoke = useCan('publishing.revoke');
  return {
    title: 'Published files',
    noun: 'published file',
    subtitle: 'Where each published version’s files are and what their checksums are. A file is registered once and never edited: it can be deprecated, restored or, for good, revoked.',
    queryKey: publishedFilesApi.keys.lists(),
    fetchPage: publishedFilesApi.list,
    // The registry has no edit and no delete (405).
    remove: async () => undefined,
    canEdit: () => false,
    canRemove: () => false,
    createPermission: 'publishing.create',
    managePermission: 'publishing.deprecate',
    rowName: (row) => row.relative_path,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search',
    searchable: false, // the files route has no search (use the filters)
    basePath: '/publishing/files',
    scope: scope ? { project_id: scope.projectId } : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'status', label: 'Status', options: options(FILE_STATUSES) },
      { key: 'role', label: 'Role', options: options(FILE_ROLES) },
      { key: 'latest', label: 'Show', options: [{ value: 'true', label: 'Latest of each role' }] },
    ],
    columns: [
      { header: 'File', cell: (row) => <span className="font-mono text-xs break-all">{row.relative_path}</span>, sortField: 'relative_path' },
      { header: 'Root', cell: (row) => row.storage_root },
      {
        header: 'Version',
        cell: (row) => (
          <Link to={`/versions/${row.version_id}`} className="text-cyan-300 hover:underline">
            Open
          </Link>
        ),
      },
      { header: 'Role', cell: (row) => row.role },
      { header: 'Size', cell: (row) => `${formatBytes(row.size_bytes)}${frames(row) ? ` · ${frames(row)}` : ''}` },
      { header: 'Checksum', cell: (row) => <ChecksumBadge state={row.checksum_state} /> },
      { header: 'Status', sortField: 'status', cell: (row) => <FileStatusBadge status={row.status} /> },
    ],
    rowActions: (row) => fileRowActions(row, { deprecate: canDeprecate, revoke: canRevoke }),
  };
}

const RootPicker = ({ value, onChange, error }: { value: string | null | undefined; onChange: (id: string | null) => void; error?: string }) => (
  <EntityPicker<StorageRoot> label="Storage root *" queryKey={storageRootsApi.keys.all} fetchPage={storageRootsApi.list} fetchOne={storageRootsApi.get} getLabel={(r) => `${r.code} · ${r.name}${r.is_active ? '' : ' (inactive)'}`} value={value} onChange={onChange} error={error} />
);

export const filesFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'version_id', label: 'Published version', required: true, render: (p) => <VersionPicker label="Published version *" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ is_published: true }} error={p.error} /> },
  { kind: 'entity', name: 'storage_root', label: 'Storage root', required: true, render: (p) => <RootPicker value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'relative_path', label: 'Path under the root', required: true, maxLength: 1024, hint: 'Forward slashes, no leading slash, no “..”. A frame sequence uses %04d or ####.' },
  { kind: 'select', name: 'role', label: 'Role', options: options(FILE_ROLES), initial: 'main' },
  { kind: 'text', name: 'file_type', label: 'File type code', maxLength: 64, hint: 'Optional, a code from the file type catalog.' },
  { kind: 'number', name: 'size_bytes', label: 'Size (bytes)', required: true },
  { kind: 'text', name: 'sha256', label: 'SHA-256', required: true, maxLength: 64, hint: '64 hexadecimal characters. For a sequence, the sequence digest.' },
  { kind: 'number', name: 'frame_start', label: 'First frame', hint: 'Both frames or neither; the path must be a pattern.' },
  { kind: 'number', name: 'frame_end', label: 'Last frame' },
];

/** The form picks a root by id; the API takes its code. */
export const filesFormConfig: DirectoryFormConfig<PublishedFile> = {
  noun: 'published file',
  basePath: '/publishing/files',
  queryKey: publishedFilesApi.keys.lists(),
  fields: filesFormFields,
  get: publishedFilesApi.get,
  create: async (input) => {
    const root = await storageRootsApi.get(String(input.storage_root));
    return publishedFilesApi.create({ ...input, storage_root: root.code } as never);
  },
  update: async () => {
    throw new Error('A registered file cannot be edited.');
  },
  afterSavePath: (saved) => `/publishing/files/${saved.id}`,
};
