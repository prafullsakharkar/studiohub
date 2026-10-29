import { projectsApi } from '@/api/production/structure';
import { SHOT_STATUSES, shotsApi } from '@/api/production/work';
import type { Shot } from '@/api/production/work';
import { useCan } from '@/core/permissions/useCan';
import type { BulkAction, DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { StatusMenu } from './StatusMenu';
import { EpisodePicker, MemberSelect, ProjectPicker, SequencePicker } from './pickers';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

/** Moves a shot to a status. Approved is its own action (`shot.approve`, only from Pending Review); anything else is a PATCH. */
export const moveShot = (shot: Pick<Shot, 'id'>, next: string) => (next === 'Approved' ? shotsApi.approve(shot.id) : shotsApi.update(shot.id, { status: next }));

const bulkShotActions: ReadonlyArray<BulkAction> = [
  {
    label: 'Archive',
    destructive: true,
    confirm: (n) => `Archive ${n} shot${n === 1 ? '' : 's'}? They move to the Archived view and can be restored.`,
    run: async (ids) => {
      const result = await shotsApi.bulkArchive(ids);
      return `${result.successful ?? result.processed - result.failed} archived${result.failed ? `, ${result.failed} failed` : ''}.`;
    },
  },
];

export function useShotsListConfig(scope?: { projectId: string }): DirectoryListConfig<Shot> {
  const canUpdate = useCan('shot.update');
  const canRename = useCan('production.code.rename');
  return {
    title: 'Shots',
    noun: 'shot',
    subtitle: 'Shots in the cut. Status moves follow the review flow; a supervisor approves from Pending Review.',
    queryKey: shotsApi.keys.lists(),
    fetchPage: shotsApi.list,
    remove: shotsApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'shot.delete',
    createPermission: 'shot.create',
    managePermission: 'shot.update',
    archived: { fetchPage: shotsApi.archived, restore: shotsApi.restoreOne },
    rowName: (row) => row.code,
    defaultOrdering: 'code',
    searchPlaceholder: 'Search code or name',
    basePath: '/shots',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'status', label: 'Status', options: options(SHOT_STATUSES.filter((s) => s !== 'Archived')) },
    ],
    columns: [
      { header: 'Shot', cell: (row) => `${row.code}${row.name ? ` · ${row.name}` : ''}`, sortField: 'code' },
      { header: 'Sequence', cell: (row) => row.sequence_code || '—' },
      { header: 'Frames', cell: (row) => `${row.frame_in}–${row.frame_out} (${row.frame_count})` },
      { header: 'Artist', cell: (row) => row.assigned_artist_name || '—' },
      { header: 'Signed off', cell: (row) => (row.supervisor_approved || row.client_approved ? <Badge variant="success">{[row.supervisor_approved && 'Supervisor', row.client_approved && 'Client'].filter(Boolean).join(' + ')}</Badge> : '—') },
      { header: 'Status', sortField: 'status', cell: (row) => <StatusMenu entity="shot" status={row.status} name={row.code} canChange={canUpdate} change={(next) => moveShot(row, next)} invalidate={[shotsApi.keys.all]} /> },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Project', value: (r) => r.project_code },
      { header: 'Sequence', value: (r) => r.sequence_code },
      { header: 'Frame in', value: (r) => r.frame_in },
      { header: 'Frame out', value: (r) => r.frame_out },
      { header: 'Status', value: (r) => r.status },
    ],
    rowActions: (row): RowAction[] =>
      canRename ? [{ label: 'Rename code', confirm: `Rename ${row.code}. Use this once versions exist: the code is in published file names, and the server rewrites it everywhere.`, askText: { label: 'New code', required: true }, run: (_date, code) => shotsApi.renameCode(row.id, code as string) }] : [],
    bulk: { actions: bulkShotActions },
  };
}

export const shotsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 30, hint: 'Upper case, no spaces or slashes. Once a version exists, change it with Rename code.' },
  { kind: 'text', name: 'name', label: 'Name', maxLength: 255 },
  { kind: 'entity', name: 'sequence_id', rowKey: 'sequence_id', label: 'Sequence', render: (p) => <SequencePicker label="Sequence" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project: String(p.values.project ?? '') }} disabled={!p.values.project} error={p.error} /> },
  { kind: 'entity', name: 'episode_id', rowKey: 'episode_id', label: 'Episode', render: (p) => <EpisodePicker label="Episode (required on episodic projects)" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project: String(p.values.project ?? '') }} disabled={!p.values.project} error={p.error} /> },
  { kind: 'number', name: 'frame_in', label: 'Frame in' },
  { kind: 'number', name: 'frame_out', label: 'Frame out' },
  { kind: 'number', name: 'handle_frames', label: 'Handle frames' },
  { kind: 'entity', name: 'assigned_artist', rowKey: 'assigned_artist_id', label: 'Artist', render: (p) => <MemberSelect projectId={String(p.values.project ?? '') || undefined} value={p.value} onChange={p.onChange} label="Artist" error={p.error} /> },
  { kind: 'textarea', name: 'description', label: 'Description' },
];

export const shotsFormConfig: DirectoryFormConfig<Shot> = {
  noun: 'shot',
  basePath: '/shots',
  queryKey: shotsApi.keys.lists(),
  fields: shotsFormFields,
  get: shotsApi.get,
  create: (input) => shotsApi.create(input as never),
  update: (id, patch) => shotsApi.update(id, patch as never),
  // The update serializer resolves the episodic chain against the shot's project, which cannot change.
  immutableOnEdit: ['project'],
};
