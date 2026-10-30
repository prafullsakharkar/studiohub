import { workflowsApi } from '@/api/production/review';
import type { Workflow } from '@/api/production/review';
import { projectsApi } from '@/api/production/structure';
import { useCan } from '@/core/permissions/useCan';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef, RowAction } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { ProjectPicker } from '@/modules/production/work/pickers';

/** Activate or deactivate, and clone. A clone is inactive and repeats the code `<code>-COPY`; codes are not unique. */
export function workflowActions(row: Pick<Workflow, 'id' | 'code' | 'name' | 'is_active'>, can: { update: boolean; create: boolean }): RowAction[] {
  const actions: RowAction[] = [];
  if (can.update) {
    actions.push(
      row.is_active
        ? { label: 'Deactivate', confirm: `Deactivate ${row.code}?`, destructive: true, run: () => workflowsApi.deactivate(row.id) }
        : { label: 'Activate', confirm: `Activate ${row.code}?`, run: () => workflowsApi.activate(row.id) }
    );
  }
  if (can.create) actions.push({ label: 'Clone', confirm: `Clone ${row.code}? The copy is inactive, named "${row.name} (Copy)" and coded "${row.code}-COPY".`, run: () => workflowsApi.clone(row.id) });
  return actions;
}

export function useWorkflowsListConfig(scope?: { projectId: string }): DirectoryListConfig<Workflow> {
  const canUpdate = useCan('workflow.update');
  const canCreate = useCan('workflow.create');
  return {
    title: 'Workflows',
    noun: 'workflow',
    subtitle: 'Stored process graphs per project: nodes and the transitions between them. Nothing executes them yet.',
    queryKey: workflowsApi.keys.lists(),
    fetchPage: workflowsApi.list,
    remove: workflowsApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'workflow.delete',
    createPermission: 'workflow.create',
    managePermission: 'workflow.update',
    archived: { fetchPage: workflowsApi.archived, restore: workflowsApi.restoreOne },
    rowName: (row) => row.code,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search name, code',
    basePath: '/workflows',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [
      { key: 'project_id', label: 'Project', optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: { code: string }) => p.code) as never } },
      { key: 'is_active', label: 'State', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
    ],
    columns: [
      { header: 'Workflow', cell: (row) => `${row.code} · ${row.name}`, sortField: 'created_at' },
      { header: 'Category', cell: (row) => row.category || '—' },
      { header: 'Department', cell: (row) => row.department || '—' },
      { header: 'Nodes', cell: (row) => row.nodes.length },
      { header: 'Transitions', cell: (row) => row.transitions.length },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="neutral">Inactive</Badge>) },
    ],
    rowActions: (row) => workflowActions(row, { update: canUpdate, create: canCreate }),
  };
}

export const workflowsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50, hint: 'Not unique: the server accepts a second workflow with the same code.' },
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'text', name: 'category', label: 'Category', maxLength: 100 },
  { kind: 'text', name: 'department', label: 'Department', maxLength: 100 },
  { kind: 'json', name: 'nodes', label: 'Nodes', shape: 'array', hint: 'e.g. [{"id":"n1","label":"Start","type":"start"}]. The server stores the graph as written.' },
  { kind: 'json', name: 'transitions', label: 'Transitions', shape: 'array', hint: 'e.g. [{"from":"n1","to":"n2"}]' },
];

// Activation goes through activate/deactivate, not the form.
export const workflowsFormConfig: DirectoryFormConfig<Workflow> = {
  noun: 'workflow',
  basePath: '/workflows',
  queryKey: workflowsApi.keys.lists(),
  fields: workflowsFormFields,
  get: workflowsApi.get,
  create: (input) => workflowsApi.create(input as never),
  update: (id, patch) => workflowsApi.update(id, patch as never),
  immutableOnEdit: ['project'],
};
