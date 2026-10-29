import { PROJECT_STATUSES, PROJECT_TYPES, PROJECT_WORKFLOWS, TRACK_TYPES, episodesApi, projectsApi, sequencesApi, showsApi, tracksApi } from '@/api/production/structure';
import type { EditorialTrack, Episode, Project, Sequence, Show } from '@/api/production/structure';
import { EntityPicker } from '@/components/forms/EntityPicker';
import { ClientPicker } from '@/modules/directory/pickers';
import type { DirectoryFormConfig, DirectoryListConfig, FieldDef, RelatedRecordsConfig } from '@/modules/directory/types';
import { Badge } from '@/shared/components/Badge';

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
const MANAGE_PROJECT = 'project.update';

// ---------------------------------------------------------------- projects
export const projectsListConfig: DirectoryListConfig<Project> = {
  title: 'Projects',
  noun: 'project',
  subtitle: 'Productions the studio works on. You see the projects you are a member of.',
  queryKey: projectsApi.keys.all,
  fetchPage: projectsApi.list,
  remove: projectsApi.archive,
  deleteLabel: 'Archive',
  archived: { fetchPage: projectsApi.archived, restore: projectsApi.restore },
  rowName: (p) => p.name,
  defaultOrdering: 'name',
  searchPlaceholder: 'Search name, code or client…',
  basePath: '/projects',
  managePermission: 'project.create',
  filters: [
    { key: 'status', label: 'Status', options: opts(PROJECT_STATUSES) },
    { key: 'type', label: 'Type', options: opts(PROJECT_TYPES) },
  ],
  columns: [
    { header: 'Name', cell: (p) => p.name, sortField: 'name' },
    { header: 'Code', cell: (p) => <span className="font-mono">{p.code}</span>, sortField: 'code' },
    { header: 'Type', cell: (p) => p.type },
    { header: 'Client', cell: (p) => p.client_name || '—' },
    { header: 'Shots', cell: (p) => `${p.approved_shots}/${p.total_shots}` },
    { header: 'Delivery', cell: (p) => p.delivery_date ?? '—' },
    { header: 'Status', cell: (p) => <Badge variant={p.status === 'Approved' ? 'success' : p.status === 'On Hold' ? 'warning' : 'info'}>{p.status}</Badge> },
  ],
  exportColumns: [
    { header: 'Code', value: (p) => p.code },
    { header: 'Name', value: (p) => p.name },
    { header: 'Type', value: (p) => p.type },
    { header: 'Status', value: (p) => p.status },
    { header: 'Client', value: (p) => p.client_name },
    { header: 'Start', value: (p) => p.start_date },
    { header: 'Delivery', value: (p) => p.delivery_date },
  ],
};

export const projectsFormConfig: DirectoryFormConfig<Project> = {
  noun: 'project',
  basePath: '/projects',
  queryKey: projectsApi.keys.all,
  get: projectsApi.get,
  create: (input) => projectsApi.create(input as never),
  update: (id, patch) => projectsApi.update(id, patch as never),
  // An episodic project creates its first episode and takes episodes; the workflow cannot change afterwards.
  immutableOnEdit: ['workflow_type'],
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'text', name: 'code', label: 'Code', required: true, hint: 'Unique, for example ALPHA.' },
    { kind: 'select', name: 'type', label: 'Type', options: opts(PROJECT_TYPES) },
    { kind: 'select', name: 'workflow_type', label: 'Workflow', options: opts(PROJECT_WORKFLOWS), hint: 'Episodic projects have episodes; standard ones do not.' },
    { kind: 'select', name: 'status', label: 'Status', options: opts(PROJECT_STATUSES) },
    { kind: 'entity', name: 'client_id', label: 'Client', render: (p) => <ClientPicker {...p} value={p.value || null} onChange={(id) => p.onChange(id ?? '')} /> },
    { kind: 'textarea', name: 'description', label: 'Description' },
    { kind: 'date', name: 'start_date', label: 'Start date' },
    { kind: 'date', name: 'delivery_date', label: 'Delivery date' },
    { kind: 'number', name: 'fps', label: 'Frame rate (fps)' },
    { kind: 'text', name: 'resolution', label: 'Resolution', hint: 'For example 4096x2160.' },
    { kind: 'text', name: 'aspect_ratio', label: 'Aspect ratio' },
    { kind: 'text', name: 'color_space', label: 'Color space' },
    { kind: 'number', name: 'budget_usd', label: 'Budget (USD)' },
  ],
};

// ---------------------------------------------------------------- children of a project
const base = { managePermission: MANAGE_PROJECT, parentField: 'project' } as const;

export const showsConfig: RelatedRecordsConfig<Show> = {
  ...base,
  noun: 'show',
  title: 'Shows',
  queryKey: showsApi.keys.all,
  fetchPage: showsApi.list,
  create: (input) => showsApi.create(input as never),
  update: (id, patch) => showsApi.update(id, patch as never),
  remove: showsApi.remove,
  rowName: (s) => s.name,
  defaultOrdering: 'code',
  columns: [
    { header: 'Code', cell: (s) => <span className="font-mono">{s.code}</span> },
    { header: 'Name', cell: (s) => s.name },
    { header: 'Primary', cell: (s) => (s.is_primary ? <Badge variant="info">Primary</Badge> : '') },
    { header: 'Status', cell: (s) => s.status || '—' },
  ],
  fields: [
    { kind: 'text', name: 'code', label: 'Code', required: true },
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'textarea', name: 'description', label: 'Description' },
    { kind: 'date', name: 'start_date', label: 'Start date' },
    { kind: 'date', name: 'delivery_date', label: 'Delivery date' },
    { kind: 'checkbox', name: 'is_primary', label: 'Primary show' },
  ],
};

export const episodesConfig: RelatedRecordsConfig<Episode> = {
  ...base,
  noun: 'episode',
  title: 'Episodes',
  queryKey: episodesApi.keys.all,
  fetchPage: episodesApi.list,
  create: (input) => episodesApi.create(input as never),
  update: (id, patch) => episodesApi.update(id, patch as never),
  remove: episodesApi.archive,
  deleteLabel: 'Archive',
  archived: { fetchPage: episodesApi.archived, restore: episodesApi.restoreOne },
  rowName: (e) => e.name || e.code,
  defaultOrdering: 'episode_number',
  columns: [
    { header: 'Code', cell: (e) => <span className="font-mono">{e.code}</span> },
    { header: 'Name', cell: (e) => e.name || '—' },
    { header: 'Season', cell: (e) => e.season_number ?? '—' },
    { header: 'Episode', cell: (e) => e.episode_number ?? '—' },
    { header: 'Status', cell: (e) => e.status },
  ],
  fields: [
    { kind: 'text', name: 'code', label: 'Code', required: true },
    { kind: 'text', name: 'name', label: 'Name' },
    { kind: 'number', name: 'season_number', label: 'Season' },
    { kind: 'number', name: 'episode_number', label: 'Episode number' },
    { kind: 'textarea', name: 'description', label: 'Description' },
    { kind: 'date', name: 'air_date', label: 'Air date' },
    { kind: 'date', name: 'delivery_date', label: 'Delivery date' },
  ],
};

/** On an episodic project every sequence belongs to an episode of THAT project. */
const episodeField: FieldDef = {
  kind: 'entity',
  name: 'episode_id',
  label: 'Episode',
  render: ({ parentId, value, onChange, error }) => (
    <EntityPicker<Episode>
      label="Episode"
      queryKey={episodesApi.keys.all}
      fetchPage={episodesApi.list}
      fetchOne={episodesApi.get}
      getLabel={(e) => `${e.code}${e.name ? `: ${e.name}` : ''}`}
      filters={{ project: parentId }}
      value={value || null}
      onChange={(id) => onChange(id ?? '')}
      error={error}
    />
  ),
};

export const sequencesConfig: RelatedRecordsConfig<Sequence> = {
  ...base,
  noun: 'sequence',
  title: 'Sequences',
  queryKey: sequencesApi.keys.all,
  fetchPage: sequencesApi.list,
  create: (input) => sequencesApi.create(input as never),
  update: (id, patch) => sequencesApi.update(id, patch as never),
  remove: sequencesApi.archive,
  deleteLabel: 'Archive',
  archived: { fetchPage: sequencesApi.archived, restore: sequencesApi.restoreOne },
  rowName: (s) => s.name || s.code,
  defaultOrdering: 'code',
  columns: [
    { header: 'Code', cell: (s) => <span className="font-mono">{s.code}</span> },
    { header: 'Name', cell: (s) => s.name || '—' },
    { header: 'Frames', cell: (s) => `${s.frame_in}–${s.frame_out}` },
    { header: 'Shots', cell: (s) => s.shots_count },
    { header: 'Status', cell: (s) => s.status },
  ],
  fields: [
    { kind: 'text', name: 'code', label: 'Code', required: true },
    { kind: 'text', name: 'name', label: 'Name' },
    episodeField,
    { kind: 'textarea', name: 'description', label: 'Description' },
    { kind: 'number', name: 'frame_in', label: 'First frame' },
    { kind: 'number', name: 'frame_out', label: 'Last frame' },
  ],
};

export const tracksConfig: RelatedRecordsConfig<EditorialTrack> = {
  ...base,
  filterField: 'project_id',
  noun: 'track',
  title: 'Editorial tracks',
  queryKey: tracksApi.keys.all,
  fetchPage: tracksApi.list,
  create: (input) => tracksApi.create(input as never),
  update: (id, patch) => tracksApi.update(id, patch as never),
  remove: tracksApi.remove,
  rowName: (t) => t.name,
  defaultOrdering: 'track_number',
  columns: [
    { header: 'Track', cell: (t) => t.track_number },
    { header: 'Name', cell: (t) => t.name },
    { header: 'Type', cell: (t) => t.track_type },
    { header: 'Clips', cell: (t) => t.clip_count },
    { header: 'Range', cell: (t) => (t.start_tc || t.end_tc ? `${t.start_tc || '…'} → ${t.end_tc || '…'}` : '—') },
  ],
  fields: [
    { kind: 'text', name: 'name', label: 'Name', required: true },
    { kind: 'select', name: 'track_type', label: 'Type', options: opts(TRACK_TYPES) },
    { kind: 'number', name: 'track_number', label: 'Track number' },
  ],
};
