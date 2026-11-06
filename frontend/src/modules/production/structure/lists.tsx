import { projectsApi } from '@/api/production/structure';
import { episodesApi, sequencesApi } from '@/api/production/structure';
import type { Episode, Project, Sequence } from '@/api/production/structure';
import type { BulkAction, DirectoryFormConfig, DirectoryListConfig, FieldDef } from '@/modules/directory/types';
import { isEpisodicProject } from '../projectWorkflow';
import { EpisodePicker, ProjectPicker } from '../work/pickers';
import { EpisodicOnly, episodeColumn, episodeFilter, useEpisodicProjectIds } from '../work/episodic';

/**
 * The Episodes and Sequences pages of the Production section (Phase 2): lists across the caller's projects with a Project
 * filter, like Shots. Episodes exist only on episodic projects, so the Episodes list offers only those (CR-47).
 */

/** `ProductionStatus` of the backend (constants/shot.py), without Archived: that is the Archived view. */
const STATUSES = ['Not Started', 'In Progress', 'Pending Review', 'Approved', 'Retake'] as const;
const options = (values: ReadonlyArray<string>) => values.map((value) => ({ value, label: value }));

const projectFilter = (keep?: (p: Project) => boolean) => ({
  key: 'project_id',
  label: 'Project',
  optionsFrom: { queryKey: projectsApi.keys.all, fetchPage: projectsApi.list as never, getLabel: ((p: Project) => p.code) as never, ...(keep ? { keep: keep as never } : {}) },
});

const archiveAction = (noun: string, bulkArchive: (ids: string[]) => Promise<{ successful?: number; processed: number; failed: number }>): BulkAction => ({
  label: 'Archive',
  destructive: true,
  confirm: (n) => `Archive ${n} ${noun}${n === 1 ? '' : 's'}? They move to the Archived view and can be restored. One that still has live children is refused.`,
  run: async (ids) => {
    const result = await bulkArchive(ids);
    return `${result.successful ?? result.processed - result.failed} archived${result.failed ? `, ${result.failed} failed` : ''}.`;
  },
});

// ---------------------------------------------------------------- episodes

export function useEpisodesListConfig(scope?: { projectId: string }): DirectoryListConfig<Episode> {
  return {
    title: 'Episodes',
    noun: 'episode',
    subtitle: 'Episodes of your episodic projects. Each sequence of an episodic project is filed under one.',
    queryKey: episodesApi.keys.lists(),
    fetchPage: episodesApi.list,
    remove: episodesApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'episode.delete',
    createPermission: 'episode.create',
    managePermission: 'episode.update',
    archived: { fetchPage: episodesApi.archived, restore: episodesApi.restoreOne },
    rowName: (row) => row.code,
    rowLink: (row) => `/episodes/${row.id}/edit`,
    defaultOrdering: 'episode_number',
    searchPlaceholder: 'Search code or name',
    basePath: '/episodes',
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [projectFilter((p) => isEpisodicProject(p)), { key: 'status', label: 'Status', options: options(STATUSES) }],
    columns: [
      { header: 'Episode', cell: (row) => `${row.code}${row.name ? ` · ${row.name}` : ''}`, sortField: 'code' },
      { header: 'Project', cell: (row) => row.project_code },
      { header: 'Season', cell: (row) => row.season_number ?? '—', sortField: 'season_number' },
      { header: 'Number', cell: (row) => row.episode_number ?? '—', sortField: 'episode_number' },
      { header: 'Status', cell: (row) => row.status, sortField: 'status' },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Project', value: (r) => r.project_code },
      { header: 'Season', value: (r) => r.season_number },
      { header: 'Episode', value: (r) => r.episode_number },
      { header: 'Status', value: (r) => r.status },
    ],
    bulk: { actions: [archiveAction('episode', episodesApi.bulkArchive)] },
  };
}

const episodeFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project * (episodic)" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', maxLength: 50, hint: 'Left blank, it is made from the season and episode number (EP101).' },
  { kind: 'text', name: 'name', label: 'Name', maxLength: 255 },
  { kind: 'number', name: 'season_number', label: 'Season' },
  { kind: 'number', name: 'episode_number', label: 'Episode number' },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'date', name: 'air_date', label: 'Air date' },
  { kind: 'date', name: 'delivery_date', label: 'Delivery date' },
];

export const episodesFormConfig: DirectoryFormConfig<Episode> = {
  noun: 'episode',
  listTitle: 'Episodes',
  basePath: '/episodes',
  queryKey: episodesApi.keys.lists(),
  fields: episodeFields,
  get: episodesApi.get,
  create: (input) => episodesApi.create(input as never),
  update: (id, patch) => episodesApi.update(id, patch as never),
  afterSavePath: () => '/episodes',
  immutableOnEdit: ['project'],
};

// ---------------------------------------------------------------- sequences

export function useSequencesListConfig(scope?: { projectId: string }): DirectoryListConfig<Sequence> {
  const episodic = useEpisodicProjectIds();
  return {
    title: 'Sequences',
    noun: 'sequence',
    subtitle: 'Sequences group shots. On an episodic project each one belongs to an episode.',
    queryKey: sequencesApi.keys.lists(),
    fetchPage: sequencesApi.list,
    remove: sequencesApi.archive,
    deleteLabel: 'Archive',
    deletePermission: 'sequence.delete',
    createPermission: 'sequence.create',
    managePermission: 'sequence.update',
    archived: { fetchPage: sequencesApi.archived, restore: sequencesApi.restoreOne },
    rowName: (row) => row.code,
    rowLink: (row) => `/sequences/${row.id}/edit`,
    defaultOrdering: 'code',
    searchPlaceholder: 'Search code or name',
    basePath: '/sequences',
    scope: scope ? { project_id: scope.projectId } : undefined,
    createQuery: scope ? `project=${scope.projectId}` : undefined,
    filters: [projectFilter(), episodeFilter(episodic), { key: 'status', label: 'Status', options: options(STATUSES) }],
    columns: [
      { header: 'Sequence', cell: (row) => `${row.code}${row.name ? ` · ${row.name}` : ''}`, sortField: 'code' },
      { header: 'Project', cell: (row) => row.project_code },
      episodeColumn<Sequence>(episodic),
      { header: 'Frames', cell: (row) => `${row.frame_in}–${row.frame_out}` },
      { header: 'Shots', cell: (row) => row.shots_count },
      { header: 'Status', cell: (row) => row.status, sortField: 'status' },
    ],
    exportColumns: [
      { header: 'Code', value: (r) => r.code },
      { header: 'Name', value: (r) => r.name },
      { header: 'Project', value: (r) => r.project_code },
      { header: 'Frame in', value: (r) => r.frame_in },
      { header: 'Frame out', value: (r) => r.frame_out },
      { header: 'Status', value: (r) => r.status },
    ],
    bulk: { actions: [archiveAction('sequence', sequencesApi.bulkArchive)] },
  };
}

const sequenceFields: ReadonlyArray<FieldDef> = [
  { kind: 'entity', name: 'project', rowKey: 'project_id', label: 'Project', required: true, render: (p) => <ProjectPicker label="Project *" value={p.value} onChange={(id) => p.onChange(id ?? '')} error={p.error} /> },
  { kind: 'text', name: 'code', label: 'Code', required: true, maxLength: 50, hint: 'Upper case, no spaces or slashes; unique in the project.' },
  { kind: 'text', name: 'name', label: 'Name', maxLength: 255 },
  {
    kind: 'entity',
    name: 'episode_id',
    rowKey: 'episode_id',
    label: 'Episode',
    render: (p) => (
      // Only an episodic project has episodes; there a new sequence needs one (D-12, CR-47).
      <EpisodicOnly projectId={String(p.values.project ?? '')}>
        <EpisodePicker label="Episode *" value={p.value} onChange={(id) => p.onChange(id ?? '')} filters={{ project: String(p.values.project ?? '') }} error={p.error} />
      </EpisodicOnly>
    ),
  },
  { kind: 'textarea', name: 'description', label: 'Description' },
  { kind: 'number', name: 'frame_in', label: 'First frame' },
  { kind: 'number', name: 'frame_out', label: 'Last frame' },
];

export const sequencesFormConfig: DirectoryFormConfig<Sequence> = {
  noun: 'sequence',
  listTitle: 'Sequences',
  basePath: '/sequences',
  queryKey: sequencesApi.keys.lists(),
  fields: sequenceFields,
  get: sequencesApi.get,
  create: (input) => sequencesApi.create(input as never),
  update: (id, patch) => sequencesApi.update(id, patch as never),
  afterSavePath: () => '/sequences',
  immutableOnEdit: ['project'],
};
