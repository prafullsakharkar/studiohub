import { projectsApi } from '@/api/production/structure';
import { versionsApi } from '@/api/production/review';
import type { Version } from '@/api/production/review';
import { TASK_STATUSES } from '@/api/production/work';
import { useCan } from '@/core/permissions/useCan';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { StatusMenu } from '@/modules/production/work/StatusMenu';
import { AssetPicker, ProjectPicker, ShotPicker, TaskPicker } from '@/modules/production/work/pickers';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

/** Publish, unpublish and promote, each behind a confirmation; the server's refusal (not approved, separation of duties…) is shown in the dialog. */
export function versionActions(row: Pick<Version, 'id' | 'code' | 'status' | 'is_published' | 'is_hero'>, canPublish: boolean): RowAction[] {
  if (!canPublish) return [];
  const actions: RowAction[] = [];
  if (row.status === 'Approved' && !row.is_published) {
    actions.push({ label: 'Publish', confirm: `Publish ${row.code}? A published version is frozen except its notes and tags, and cannot be archived until it is unpublished.`, run: () => versionsApi.publish(row.id) });
  }
  if (row.is_published) {
    actions.push({ label: 'Unpublish', destructive: true, confirm: `Unpublish ${row.code}? It becomes editable again.`, run: () => versionsApi.unpublish(row.id) });
  }
  if (row.status === 'Approved' && !row.is_hero) {
    actions.push({ label: 'Make hero', confirm: `Make ${row.code} the hero version of its shot or asset? The current hero is demoted. Promoting approves the version, so you cannot do it for work you produced.`, run: () => versionsApi.promote(row.id) });
  }
  return actions;
}

export const versionBadges = (row: Pick<Version, 'is_published' | 'is_hero'>) =>
  row.is_published || row.is_hero ? (
    <span className="inline-flex gap-1">
      {row.is_published && <Badge variant="success">Published</Badge>}
      {row.is_hero && <Badge variant="purple">Hero</Badge>}
    </span>
  ) : (
    '—'
  );

export function useVersionsListConfig(scope?: { projectId: string }): DirectoryListConfig<Version> {
  const canUpdate = useCan('version.update');
  const canPublish = useCan('version.publish');
  return {
    title: 'Versions',
    noun: 'version',
    subtitle: 'Work submitted for review, numbered by the server. Approve it, then publish it; the hero is the one a shot or asset is judged by.',
    queryKey: versionsApi.keys.lists(),
    fetchPage: versionsApi.list,
    remove: versionsApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'version.update',
    createPermission: 'version.create',
    managePermission: 'version.update',
    archived: { fetchPage: versionsApi.archived, restore: versionsApi.restoreOne },
    rowName: (row) => row.code,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search code',
    basePath: '/versions',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    // A published version cannot be edited (400) or archived until it is unpublished.
    canEdit: () => true,
    canRemove: (row) => !row.is_published,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'status', label: 'Status', options: options(TASK_STATUSES.filter((s) => s !== 'Archived')) },
      // shot_id, task_id, asset_id, artist and is_hero are ignored by the server: only these narrow the list
      { key: 'entity_type', label: 'For', options: options(['Shot', 'Asset']) },
      { key: 'is_published', label: 'Published', options: [{ value: 'true', label: 'Published' }, { value: 'false', label: 'Not published' }] },
    ],
    columns: [
      { header: 'Version', cell: (row) => `${row.code} · ${row.version_number}`, sortField: 'created_at' },
      { header: 'For', cell: (row) => `${row.entity_type} ${row.entity_code}`.trim() || '—' },
      { header: 'Department', cell: (row) => row.department || '—' },
      { header: 'Artist', cell: (row) => row.artist_name || '—' },
      { header: 'State', cell: versionBadges },
      {
        header: 'Status',
        sortField: 'status',
        cell: (row) => <StatusMenu entity="version" status={row.status} name={row.code} canChange={canUpdate && !row.is_published} change={(next) => versionsApi.update(row.id, { status: next })} invalidate={[versionsApi.keys.all]} />,
      },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Number', value: (r) => r.version_number },
      { header: 'For', value: (r) => `${r.entity_type} ${r.entity_code}`.trim() },
      { header: 'Department', value: (r) => r.department },
      { header: 'Status', value: (r) => r.status },
      { header: 'Published', value: (r) => r.is_published },
      { header: 'Hero', value: (r) => r.is_hero },
    ],
    rowActions: (row) => versionActions(row, canPublish),
  };
}

export const versionsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  // A version is about a shot OR an asset; a task alone takes the task's. Neither can change after creation.
  { kind: 'entity', name: 'shot', rowKey: 'shot_id', label: 'Shot', render: (p) => <ShotPicker label="Shot" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project_id: String(p.values.project ?? '') }} disabled={!p.values.project} error={p.error} /> },
  { kind: 'entity', name: 'asset', rowKey: 'asset_id', label: 'Asset (instead of a shot)', render: (p) => <AssetPicker label="Asset (instead of a shot)" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project_id: String(p.values.project ?? '') }} disabled={!p.values.project} error={p.error} /> },
  { kind: 'entity', name: 'task', rowKey: 'task_id', label: 'Task', render: (p) => <TaskPicker label="Task" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project_id: String(p.values.project ?? '') }} disabled={!p.values.project} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', maxLength: 50, hint: 'Leave empty to derive it from the shot or asset and the department.' },
  { kind: 'text', name: 'department', label: 'Department', maxLength: 100 },
  { kind: 'textarea', name: 'notes', label: 'Notes' },
  { kind: 'textarea', name: 'changelog', label: 'Changelog' },
  { kind: 'text', name: 'resolution', label: 'Resolution', maxLength: 50 },
  { kind: 'number', name: 'fps', label: 'Frame rate' },
  { kind: 'number', name: 'start_frame', label: 'Start frame' },
  { kind: 'number', name: 'end_frame', label: 'End frame' },
];

export const versionsFormConfig: DirectoryFormConfig<Version> = {
  noun: 'version',
  basePath: '/versions',
  queryKey: versionsApi.keys.lists(),
  fields: versionsFormFields,
  get: versionsApi.get,
  create: (input) => versionsApi.create(input as never),
  update: (id, patch) => versionsApi.update(id, patch as never),
  immutableOnEdit: ['project', 'shot', 'asset', 'task'],
};
