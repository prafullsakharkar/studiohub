import { projectsApi } from '@/api/production/structure';
import { ASSET_CATEGORIES, ASSET_STATUSES, assetsApi } from '@/api/production/work';
import type { Asset } from '@/api/production/work';
import { useCan } from '@/core/permissions/useCan';
import type { BulkAction, DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { StatusMenu } from './StatusMenu';
import { AssetPicker, AssetTypePicker, MemberSelect, ProjectPicker } from './pickers';

const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

const bulkAssetActions: ReadonlyArray<BulkAction> = [
  {
    label: 'Archive',
    destructive: true,
    confirm: (n) => `Archive ${n} asset${n === 1 ? '' : 's'}? They move to the Archived view and can be restored. An asset still linked to a shot is refused.`,
    run: async (ids) => {
      const result = await assetsApi.bulkArchive(ids);
      return `${result.successful ?? result.processed - result.failed} archived${result.failed ? `, ${result.failed} failed` : ''}.`;
    },
  },
];

export function useAssetsListConfig(scope?: { projectId: string }): DirectoryListConfig<Asset> {
  const canUpdate = useCan('asset.update');
  const canRename = useCan('production.code.rename');
  return {
    title: 'Assets',
    noun: 'asset',
    subtitle: 'Characters, props, environments and the rest of what shots are built from.',
    queryKey: assetsApi.keys.lists(),
    fetchPage: assetsApi.list,
    remove: assetsApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'asset.delete',
    createPermission: 'asset.create',
    managePermission: 'asset.update',
    archived: { fetchPage: assetsApi.archived, restore: assetsApi.restoreOne },
    rowName: (row) => row.code,
    defaultOrdering: 'code',
    searchPlaceholder: 'Search code, name',
    basePath: '/assets',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'category', label: 'Category', options: options(ASSET_CATEGORIES) },
      { key: 'status', label: 'Status', options: options(ASSET_STATUSES.filter((s) => s !== 'Archived')) },
    ],
    columns: [
      { header: 'Asset', cell: (row) => `${row.code} · ${row.name}`, sortField: 'code' },
      { header: 'Category', cell: (row) => row.category },
      { header: 'Software', cell: (row) => row.software || '—' },
      { header: 'Version', cell: (row) => row.version || '—' },
      { header: 'Artist', cell: (row) => row.assigned_artist_name || '—' },
      // Assets have no transition table on the server: any status may follow any other.
      { header: 'Status', sortField: 'status', cell: (row) => <StatusMenu entity="asset" status={row.status} name={row.code} canChange={canUpdate} change={(next) => assetsApi.update(row.id, { status: next })} invalidate={[assetsApi.keys.all]} /> },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Project', value: (r) => r.project_code },
      { header: 'Category', value: (r) => r.category },
      { header: 'Status', value: (r) => r.status },
    ],
    rowActions: (row): RowAction[] =>
      canRename ? [{ label: 'Rename code', confirm: `Rename ${row.code}. Use this once versions exist: the code is in published file names.`, askText: { label: 'New code', required: true }, run: (_date, code) => assetsApi.renameCode(row.id, code as string) }] : [],
    bulk: { actions: bulkAssetActions },
  };
}

export const assetsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50, hint: 'Upper case, no spaces or slashes. Once a version exists, change it with Rename code.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'select', name: 'category', label: 'Category', required: true, options: options(ASSET_CATEGORIES) },
  { kind: 'entity', name: 'asset_type_id', rowKey: 'asset_type_id', label: 'Asset type', render: (p) => <AssetTypePicker label="Asset type" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'entity', name: 'parent_asset', rowKey: 'parent_asset_id', label: 'Parent asset', render: (p) => <AssetPicker label="Parent asset" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project_id: String(p.values.project ?? '') }} disabled={!p.values.project} error={p.error} /> },
  { kind: 'text', name: 'software', label: 'Software', maxLength: 100 },
  { kind: 'entity', name: 'assigned_artist', rowKey: 'assigned_artist_id', label: 'Artist', render: (p) => <MemberSelect projectId={String(p.values.project ?? '') || undefined} value={p.value} onChange={p.onChange} label="Artist" error={p.error} /> },
  { kind: 'textarea', name: 'description', label: 'Description' },
];

export const assetsFormConfig: DirectoryFormConfig<Asset> = {
  noun: 'asset',
  basePath: '/assets',
  queryKey: assetsApi.keys.lists(),
  fields: assetsFormFields,
  get: assetsApi.get,
  create: (input) => assetsApi.create(input as never),
  update: (id, patch) => assetsApi.update(id, patch as never),
  immutableOnEdit: ['project'],
};
