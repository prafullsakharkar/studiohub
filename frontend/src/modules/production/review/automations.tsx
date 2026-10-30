import { automationKeys, automationsApi } from '@/api/production/review';
import type { AutomationRule } from '@/api/production/review';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';
import { ProjectPicker } from '@/modules/production/work/pickers';

/** The form is flat; the rule's trigger is an object. These two layers translate. */
export interface AutomationRuleRow extends AutomationRule {
  trigger_event: string;
  trigger_entity_type: string;
  trigger_filters: Record<string, unknown>;
}
const flatten = (rule: AutomationRule): AutomationRuleRow => ({ ...rule, trigger_event: rule.trigger?.event ?? '', trigger_entity_type: rule.trigger?.entity_type ?? '', trigger_filters: rule.trigger?.filters ?? {} });
/** Collects the flat trigger fields into the `trigger` object the server requires (a bare string is a 400). Sent only when a trigger field was touched. */
export function nestTrigger(values: Record<string, unknown>): Record<string, unknown> {
  const { trigger_event, trigger_entity_type, trigger_filters, ...rest } = values;
  if (trigger_event === undefined && trigger_entity_type === undefined && trigger_filters === undefined) return rest;
  return { ...rest, trigger: { event: trigger_event ?? '', entity_type: trigger_entity_type ?? '', filters: trigger_filters ?? {} } };
}

export function useAutomationsListConfig(): DirectoryListConfig<AutomationRule> {
  return {
    title: 'Automation rules',
    noun: 'automation rule',
    subtitle: 'Stored rules of the form "when this happens, do that". The backend does not run them yet: a rule never fires and its run count stays at zero.',
    queryKey: automationKeys.lists(),
    fetchPage: automationsApi.rules,
    remove: automationsApi.remove,
    deleteLabel: 'Delete',
    deletePermission: 'automation.delete',
    createPermission: 'automation.create',
    managePermission: 'automation.update',
    rowName: (row) => row.name,
    defaultOrdering: '-created_at',
    searchPlaceholder: 'Search name',
    basePath: '/automations',
    rowLink: () => null, // no detail page: Edit is in the last column
    columns: [
      { header: 'Rule', cell: (row) => row.name, sortField: 'created_at' },
      { header: 'When', cell: (row) => `${row.trigger.entity_type || 'Anything'} · ${row.trigger.event || '—'}` },
      { header: 'Then', cell: (row) => (row.actions.length ? `${row.actions.length} action${row.actions.length === 1 ? '' : 's'}` : '—') },
      { header: 'Runs', cell: (row) => row.execution_count },
      { header: 'State', cell: (row) => (row.is_active ? <Badge variant="success">Enabled</Badge> : <Badge variant="neutral">Disabled</Badge>) },
    ],
  };
}

export const automationsFormFields: ReadonlyArray<FieldDef> = [
  { kind: 'text', name: 'name', label: 'Name', required: true, maxLength: 255 },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'text', name: 'trigger_event', label: 'Event', required: true, hint: 'e.g. status_changed' },
  { kind: 'text', name: 'trigger_entity_type', label: 'On', hint: 'e.g. Version, Task, Shot' },
  { kind: 'json', name: 'trigger_filters', label: 'Only when', shape: 'object', hint: 'e.g. {"status":"Approved"}' },
  { kind: 'json', name: 'conditions', label: 'Conditions', shape: 'array' },
  { kind: 'json', name: 'actions', label: 'Actions', shape: 'array', hint: 'e.g. [{"type":"notify","target":"lead"}]' },
  { kind: 'text', name: 'required_role', label: 'Role needed to run', maxLength: 100 },
  { kind: 'checkbox', name: 'is_active', label: 'Enabled' },
  // Required of everyone but a platform administrator; a rule without a project is studio-wide. The server does not report it back, so it is only asked for on creation.
  { kind: 'entity', name: 'project_id', label: 'Project', onlyOnCreate: true, render: (p) => <ProjectPicker label="Project" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
];

export const automationsFormConfig: DirectoryFormConfig<AutomationRuleRow> = {
  noun: 'automation rule',
  basePath: '/automations',
  queryKey: automationKeys.lists(),
  fields: automationsFormFields,
  get: async (id, signal) => flatten(await automationsApi.get(id, signal)),
  create: async (input) => flatten(await automationsApi.create(nestTrigger(input) as never)),
  // The trigger is replaced as a whole, so a touched part is merged into the stored one first.
  update: async (id, patch) => {
    const touched = 'trigger_event' in patch || 'trigger_entity_type' in patch || 'trigger_filters' in patch;
    const current = touched ? flatten(await automationsApi.get(id)) : null;
    const merged = current ? { trigger_event: current.trigger_event, trigger_entity_type: current.trigger_entity_type, trigger_filters: current.trigger_filters, ...patch } : patch;
    return flatten(await automationsApi.update(id, nestTrigger(merged) as never));
  },
  afterSavePath: () => '/automations',
};
