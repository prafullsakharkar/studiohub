import { safeWebUrl } from '@/shared/utils/safeUrl';
import { mediaApi } from '@/api/production/review';
import type { Media } from '@/api/production/review';
import { projectsApi } from '@/api/production/structure';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { ProjectPicker } from '@/modules/production/work/pickers';
import { ReviewTargetField } from './reviews';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

export const mediaName = (row: Pick<Media, 'id' | 'title' | 'file_name' | 'code' | 'media_type'>) => row.title || row.file_name || row.code || `${row.media_type} ${row.id.slice(0, 8)}`;

export function useMediaListConfig(scope?: { projectId: string }): DirectoryListConfig<Media> {
  return {
    title: 'Media',
    noun: 'media item',
    subtitle: 'Links to reference, previews and deliverables attached to shots and assets. The studio records the links; it does not store the files.',
    queryKey: mediaApi.keys.lists(),
    fetchPage: mediaApi.list,
    remove: mediaApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'media.update',
    createPermission: 'media.create',
    managePermission: 'media.update',
    archived: { fetchPage: mediaApi.archived, restore: mediaApi.restoreOne },
    rowName: mediaName,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search title, code, file name, format, category',
    basePath: '/media',
    rowLink: () => null, // no detail page: Edit is in the last column
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      // entity_type and entity_id are ignored by the server; only the type narrows the list
      { key: 'media_type', label: 'Type', options: options(['Image', 'Video', 'Audio', 'Document']) },
    ],
    columns: [
      { header: 'Media', cell: (row) => mediaName(row), sortField: 'created_at' },
      { header: 'On', cell: (row) => row.entity_type || '—' },
      { header: 'Type', cell: (row) => row.media_type || '—' },
      { header: 'Category', cell: (row) => row.category || '—' },
      { header: 'Format', cell: (row) => row.file_format || '—' },
      { header: 'Size', cell: (row) => (Number(row.file_size_mb) > 0 ? `${row.file_size_mb} MB` : '—') },
      {
        header: 'Link',
        cell: (row) =>
          safeWebUrl(row.preview_url) || safeWebUrl(row.source_url) ? (
            <a href={safeWebUrl(row.preview_url) || safeWebUrl(row.source_url)} target="_blank" rel="noreferrer noopener" className="text-cyan-300 hover:underline">
              Open
            </a>
          ) : (
            '—'
          ),
      },
    ],
  };
}

export const mediaFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'select', name: 'entity_type', label: 'Attached to', options: options(['Shot', 'Asset']), initial: 'Shot' },
  { kind: 'entity', name: 'entity_id', label: 'Shot or asset', render: (p) => <ReviewTargetField type={String(p.values.entity_type || 'Shot')} project={String(p.values.project ?? '')} value={p.value} onChange={p.onChange} error={p.error} /> },
  { kind: 'text', name: 'media_type', label: 'Type', maxLength: 50, hint: 'Free text, e.g. Image, Video, Audio, Document. The server accepts any value and defaults to image.' },
  { kind: 'text', name: 'category', label: 'Category', maxLength: 100 },
  { kind: 'text', name: 'file_format', label: 'File format', maxLength: 50 },
  { kind: 'text', name: 'storage_tier', label: 'Storage tier', maxLength: 50 },
  { kind: 'url', name: 'source_url', label: 'Source link' },
  { kind: 'url', name: 'preview_url', label: 'Preview link' },
  { kind: 'url', name: 'thumbnail_url', label: 'Thumbnail link' },
  { kind: 'number', name: 'file_size_mb', label: 'Size (MB)' },
  { kind: 'text', name: 'resolution', label: 'Resolution', maxLength: 50 },
];

export const mediaFormConfig: DirectoryFormConfig<Media> = {
  noun: 'media item',
  basePath: '/media',
  queryKey: mediaApi.keys.lists(),
  fields: mediaFormFields,
  get: mediaApi.get,
  create: (input) => mediaApi.create(input as never),
  update: (id, patch) => mediaApi.update(id, patch as never),
  afterSavePath: () => '/media',
  immutableOnEdit: ['project'],
};
