import { DCC_TOOLS, publishApi } from '@/api/publishing/publishing';
import type { Publish, PublishRow } from '@/api/publishing/publishing';
import { isJobDeletable, isJobEditable } from '@/api/publishing/publishingFlow';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { VersionPicker } from '@/modules/production/review/pickers';
import { ProjectPicker } from '@/modules/production/work/pickers';
import { Badge } from '@/shared/components/Badge';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

/** The job’s real state (`job_status`); the legacy `status` word calls both Validated and Exported “Published”. */
export const jobStatusVariant = (status: string) => {
  switch (status) {
    case 'Exported':
      return 'success';
    case 'Failed':
      return 'destructive';
    case 'Validating':
      return 'info';
    case 'Validated':
      return 'cyan';
    case 'Exporting':
      return 'warning';
    default:
      return 'neutral';
  }
};
export const JobStatusBadge = ({ status }: { status: string }) => <Badge variant={jobStatusVariant(status)}>{status}</Badge>;

export function usePublishListConfig(): DirectoryListConfig<PublishRow> {
  return {
    title: 'Publishing',
    noun: 'export job',
    subtitle: 'Export jobs reported by the DCC tools, and the files they produced. StudioHub records where a file is and its checksum; it never holds the file.',
    queryKey: publishApi.keys.lists(),
    fetchPage: publishApi.list,
    remove: publishApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'publishing.delete',
    createPermission: 'publishing.create',
    managePermission: 'publishing.update',
    // The list route filters nothing (CR-22): search and sorting only.
    canEdit: (row) => isJobEditable(row.job_status),
    canRemove: (row) => isJobDeletable(row.job_status),
    rowName: (row) => row.code,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search name, code, shot or asset',
    basePath: '/publishing',
    columns: [
      { header: 'Job', cell: (row) => `${row.code} · ${row.name}`, sortField: 'created_at' },
      { header: 'Project', cell: (row) => row.client_name || '—' },
      { header: 'For', cell: (row) => `${row.entity_type_display || row.entity_type} ${row.entity_code}`.trim() || '—' },
      { header: 'Tool', cell: (row) => `${row.dcc_tool_display}${row.dcc_version ? ` ${row.dcc_version}` : ''}` },
      { header: 'Format', cell: (row) => row.export_format || '—' },
      { header: 'Retries', cell: (row) => row.retry_count },
      { header: 'Status', sortField: 'status', cell: (row) => <JobStatusBadge status={row.job_status} /> },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Project', value: (r) => r.client_name },
      { header: 'For', value: (r) => `${r.entity_type} ${r.entity_code}`.trim() },
      { header: 'Tool', value: (r) => r.dcc_tool },
      { header: 'Format', value: (r) => r.export_format },
      { header: 'Status', value: (r) => r.job_status },
    ],
  };
}

export const publishFormFields: ReadonlyArray<FieldDef> = [
  // The project, the version and the code are chosen once.
  { kind: 'entity', name: 'project_id', rowKey: 'project', label: 'Project', required: true, onlyOnCreate: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  {
    kind: 'entity',
    name: 'version_id',
    label: 'Published version',
    onlyOnCreate: true,
    render: (p) => <VersionPicker label="Published version" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project_id: String(p.values.project_id ?? ''), is_published: true }} disabled={!p.values.project_id} error={p.error} />,
  },
  { kind: 'text', name: 'code', label: 'Code', maxLength: 50, onlyOnCreate: true, hint: 'Leave empty for PUB-<project>-<number>.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'select', name: 'dcc_tool', label: 'DCC tool', required: true, options: options(DCC_TOOLS) },
  { kind: 'text', name: 'dcc_version', label: 'DCC version', maxLength: 50 },
  // Without a version the job must say which shot or asset it is about.
  { kind: 'select', name: 'entity_type', label: 'About', options: options(['Shot', 'Asset']), onlyOnCreate: true, visibleWhen: (v) => !v.version_id, hint: 'A version names its shot or asset; without one, say which.' },
  { kind: 'text', name: 'entity_code', label: 'Shot or asset code', maxLength: 255, onlyOnCreate: true, visibleWhen: (v) => !v.version_id },
  { kind: 'text', name: 'entity_id', label: 'Shot or asset id', maxLength: 100, onlyOnCreate: true, visibleWhen: (v) => !v.version_id },
  { kind: 'text', name: 'source_file', label: 'Source file', maxLength: 500, hint: 'A path on the artist’s machine, as the DCC tool sees it.' },
  { kind: 'text', name: 'source_version', label: 'Source version', maxLength: 50 },
  { kind: 'text', name: 'export_path', label: 'Export path', maxLength: 500 },
  { kind: 'text', name: 'export_format', label: 'Export format', maxLength: 50 },
  { kind: 'json', name: 'export_options', label: 'Export options', shape: 'object', hint: 'e.g. {"compression":"zip"}' },
  { kind: 'json', name: 'validation_rules', label: 'Validation rules', shape: 'object', hint: 'Stored with the job; the server checks the rules the studio configured.' },
];

export const publishFormConfig: DirectoryFormConfig<Publish> = {
  noun: 'export job',
  basePath: '/publishing',
  queryKey: publishApi.keys.lists(),
  fields: publishFormFields,
  get: publishApi.get,
  create: (input) => publishApi.create(input as never),
  update: (id, patch) => publishApi.update(id, patch as never),
};
