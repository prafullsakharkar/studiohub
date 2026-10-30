import { playlistsApi } from '@/api/production/review';
import type { Playlist } from '@/api/production/review';
import { projectsApi } from '@/api/production/structure';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { ProjectPicker } from '@/modules/production/work/pickers';

export function usePlaylistsListConfig(scope?: { projectId: string }): DirectoryListConfig<Playlist> {
  return {
    title: 'Playlists',
    noun: 'playlist',
    subtitle: 'Ordered sets of versions for dailies and client reviews.',
    queryKey: playlistsApi.keys.lists(),
    fetchPage: playlistsApi.list,
    remove: playlistsApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'playlist.update',
    createPermission: 'playlist.create',
    managePermission: 'playlist.update',
    archived: { fetchPage: playlistsApi.archived, restore: playlistsApi.restoreOne },
    rowName: (row) => row.code,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search name, code',
    basePath: '/playlists',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'client_only', label: 'Audience', options: [{ value: 'true', label: 'Client only' }, { value: 'false', label: 'Internal' }] },
    ],
    columns: [
      { header: 'Playlist', cell: (row) => `${row.code} · ${row.name}`, sortField: 'created_at' },
      { header: 'Entries', cell: (row) => row.entries.length },
      { header: 'Audience', cell: (row) => (row.client_only ? <Badge variant="info">Client only</Badge> : 'Internal') },
      { header: 'Sharing', cell: (row) => (row.share_settings.is_public ? <Badge variant="success">Marked shared</Badge> : '—') },
      { header: 'Status', cell: (row) => row.status },
    ],
  };
}

export const playlistsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50 },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'checkbox', name: 'client_only', label: 'Client only' },
];

// Entries are never part of the form: after creation they change only through add-entry, remove-entry and reorder.
export const playlistsFormConfig: DirectoryFormConfig<Playlist> = {
  noun: 'playlist',
  basePath: '/playlists',
  queryKey: playlistsApi.keys.lists(),
  fields: playlistsFormFields,
  get: playlistsApi.get,
  create: (input) => playlistsApi.create(input as never),
  update: (id, patch) => playlistsApi.update(id, patch as never),
  immutableOnEdit: ['project'],
};
