import { UniversalEntityType, UniversalEntityDetail, EntityReference } from '@/types/workspace';
import { queryClient } from '@/providers/QueryProvider';

type AnyRecord = Record<string, any>;

/**
 * Reads list data for the given query-key roots from the React Query cache
 * (populated by the module list hooks). Supports both plain arrays and
 * DRF-style paginated responses. Returns [] until lists have been fetched.
 */
function readCachedList(rootKeys: string[]): AnyRecord[] {
  const byId = new Map<string, AnyRecord>();
  for (const q of queryClient.getQueryCache().getAll()) {
    const key = q.queryKey;
    if (!Array.isArray(key) || !rootKeys.includes(key[0])) continue;
    if (key[1] === 'detail' || key[1] === 'null') continue;
    const data = q.state.data as any;
    if (!data) continue;
    const items = Array.isArray(data) ? data : data?.results;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (item && typeof item === 'object' && item.id != null) {
        byId.set(String(item.id), item);
      }
    }
  }
  return Array.from(byId.values());
}

function findCached(rootKeys: string[], id: string, fields: string[]): AnyRecord | null {
  return readCachedList(rootKeys).find((item) => fields.some((f) => item?.[f] === id)) || null;
}

function findCachedNormalized(rootKeys: string[], id: string, fields: string[]): AnyRecord | null {
  const normalized = id.toLowerCase();
  return (
    readCachedList(rootKeys).find(
      (item) => fields.some((f) => item?.[f] === id || String(item?.[f] ?? '').toLowerCase() === normalized)
    ) || null
  );
}

/**
 * Query-cache roots backing each universal entity type. Types mapped to an
 * empty array have no React Query list wired yet (their modules still use
 * local state), so they resolve to null until those modules migrate.
 */
const ENTITY_ROOTS: Partial<Record<UniversalEntityType, string[]>> = {
  organization: ['organizations'],
  client: ['clients'],
  vendor: ['vendors'],
  person: ['people', 'users'],
  department: ['departments'],
  team: ['teams'],
  office: ['offices'],
  project: ['projects'],
  sequence: ['sequences'],
  shot: ['shots'],
  asset: ['assets'],
  task: ['tasks'],
  version: ['versions'],
  review: ['reviews'],
  playlist: ['playlists'],
  workflow: ['workflows'],
  timelog: ['timelogs'],
  media: ['media'],
  attachment: ['attachments'],
  note: [],
  delivery: [],
  schedule: [],
  resource: [],
  publishing: [],
  calendar: [],
};

const ENTITY_MATCH_FIELDS: Partial<Record<UniversalEntityType, string[]>> = {
  organization: ['id', 'code'],
  client: ['id', 'code'],
  vendor: ['id', 'code'],
  person: ['id', 'email', 'full_name'],
  department: ['id', 'code'],
  team: ['id', 'code'],
  office: ['id', 'code'],
  project: ['id', 'code'],
  sequence: ['id', 'code'],
  shot: ['id', 'code'],
  asset: ['id', 'code'],
  task: ['id', 'code'],
  version: ['id', 'version_number', 'entity_code'],
  review: ['id', 'code'],
  playlist: ['id', 'code'],
  workflow: ['id', 'code'],
  timelog: ['id'],
  media: ['id', 'code'],
  attachment: ['id', 'code'],
};

function rawTitle(raw: AnyRecord): string {
  return raw.name || raw.title || raw.full_name || raw.file_name || raw.code || '';
}

function rawCode(raw: AnyRecord): string {
  return raw.code || raw.version_number || '';
}

function getRealProjects(): AnyRecord[] {
  return readCachedList(['projects']);
}

function findRealProject(id: string): AnyRecord | null {
  return findCachedNormalized(['projects'], id, ['id', 'code']);
}

function entityRef(type: UniversalEntityType, raw: AnyRecord | null | undefined, title?: string): EntityReference | null {
  if (!raw || raw.id == null) return null;
  return {
    id: String(raw.id),
    type,
    title: title || rawTitle(raw),
    code: rawCode(raw) || undefined,
    status: raw.status,
    thumbnail_url: raw.thumbnail_url || raw.avatar_url,
  };
}

function projectRefFor(raw: AnyRecord): EntityReference | null {
  const projectId = raw.project_id;
  if (!projectId) return null;
  const project = getRealProjects().find((p) => p.id === projectId);
  return entityRef('project', project || { id: projectId, code: raw.project_code });
}

function sameTarget(raw: AnyRecord, entityCode: string | undefined, entityId: string): boolean {
  return raw.entity_id === entityId || (entityCode != null && raw.entity_code === entityCode);
}

function tasksForTarget(entityId: string, entityCode?: string): EntityReference[] {
  return readCachedList(['tasks'])
    .filter((t) => sameTarget(t, entityCode, entityId))
    .map((t) => entityRef('task', t))
    .filter(Boolean) as EntityReference[];
}

function versionsForTarget(entityId: string, entityCode?: string): EntityReference[] {
  return readCachedList(['versions'])
    .filter((v) => sameTarget(v, entityCode, entityId))
    .map((v) => entityRef('version', v, `${entityCode || ''} ${v.version_number || ''}`.trim()))
    .filter(Boolean) as EntityReference[];
}

function reviewsForTarget(entityId: string, entityCode?: string): EntityReference[] {
  return readCachedList(['reviews'])
    .filter((r) => sameTarget(r, entityCode, entityId))
    .map((r) => entityRef('review', r))
    .filter(Boolean) as EntityReference[];
}

function peopleRefList(filterFn: (p: AnyRecord) => boolean, limit?: number): EntityReference[] {
  let people = readCachedList(['people', 'users']).filter(filterFn);
  if (limit) people = people.slice(0, limit);
  return people.map((p) => entityRef('person', p)).filter(Boolean) as EntityReference[];
}

function dash(value: any, suffix = ''): string {
  if (value === undefined || value === null || value === '') return '—';
  return `${value}${suffix}`;
}

function buildEntityDetail(type: UniversalEntityType, id: string, raw: AnyRecord): UniversalEntityDetail {
  const detail: UniversalEntityDetail = {
    id: String(raw.id ?? id),
    type,
    code: rawCode(raw) || id,
    title: rawTitle(raw),
    subtitle: raw.description ? String(raw.description).slice(0, 90) : undefined,
    description: raw.description,
    status: raw.status || raw.availability_status,
    thumbnail_url: raw.thumbnail_url || raw.avatar_url || raw.logo_url,
    banner_url: raw.banner_url,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    properties: {},
    tags: [raw.status, rawCode(raw)].filter(Boolean) as string[],
    relations: {},
  };

  const props = detail.properties;
  const relations = detail.relations;

  switch (type) {
    case 'organization': {
      props['Headquarters'] = dash(raw.headquarters);
      props['Active Crew'] = dash(raw.crew_count, ' Artists');
      props['Storage Usage'] = raw.storage_used_tb != null ? `${raw.storage_used_tb} / ${dash(raw.storage_quota_tb)} TB` : '—';
      props['Active Productions'] = dash(raw.active_projects_count);
      relations.people = peopleRefList(() => true, 6);
      relations.teams = readCachedList(['teams']).map((t) => entityRef('team', t)).filter(Boolean) as EntityReference[];
      break;
    }

    case 'client': {
      props['Studio Type'] = dash(raw.studio_type);
      props['Headquarters'] = dash(raw.headquarters);
      props['Primary Contact'] = raw.contact_name ? `${raw.contact_name}${raw.email ? ` (${raw.email})` : ''}` : '—';
      props['Contract Tier'] = dash(raw.contract_tier);
      props['Portal Access'] = raw.portal_access != null ? (raw.portal_access ? 'Enabled' : 'Restricted') : '—';
      relations.project = projectRefFor(raw);
      break;
    }

    case 'vendor': {
      props['Specialization'] = dash(raw.specialization || raw.specialty);
      props['Facility Location'] = dash(raw.location);
      props['Security Tier'] = dash(raw.security_tier || raw.tier);
      props['Rating'] = raw.rating != null ? `${raw.rating} / 5.0` : '—';
      props['Lead Contact'] = raw.contact_name ? `${raw.contact_name}${raw.email ? ` (${raw.email})` : ''}` : '—';
      relations.project = projectRefFor(raw);
      relations.tasks = readCachedList(['tasks'])
        .filter((t) => t.vendor_id === raw.id)
        .slice(0, 3)
        .map((t) => entityRef('task', t))
        .filter(Boolean) as EntityReference[];
      break;
    }

    case 'person': {
      const fullName = raw.full_name || raw.name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim();
      detail.title = fullName || id;
      detail.code =
        fullName
          ? fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase()
          : id;
      detail.subtitle = `${dash(raw.role || raw.job_title)} • ${dash(raw.department_name || raw.department)}`;
      props['Role'] = dash(raw.role || raw.job_title);
      props['Discipline / Dept'] = dash(raw.department_name || raw.department);
      props['Email'] = dash(raw.email);
      props['Timezone'] = dash(raw.timezone);
      props['Availability'] = dash(raw.availability_status);
      relations.parent = raw.organization_id ? entityRef('organization', { id: raw.organization_id }) : undefined;
      relations.department = raw.department_id ? entityRef('department', { id: raw.department_id, code: raw.department_name }) : undefined;
      relations.team = raw.team_id ? entityRef('team', { id: raw.team_id, code: raw.team_name }) : undefined;
      relations.tasks = readCachedList(['tasks'])
        .filter((t) => t.assignee_id === raw.id)
        .map((t) => entityRef('task', t))
        .filter(Boolean) as EntityReference[];
      relations.shots = readCachedList(['shots'])
        .filter((s) => s.assigned_artist_id === raw.id)
        .map((s) => entityRef('shot', s))
        .filter(Boolean) as EntityReference[];
      break;
    }

    case 'department': {
      detail.subtitle = `Discipline Lead: ${dash(raw.head_name)}`;
      props['Department Head'] = dash(raw.head_name);
      props['Crew Size'] = dash(raw.member_count, ' Artists & TDs');
      props['Active Task Queue'] = dash(raw.active_tasks_count, ' Work Items');
      relations.parent = raw.organization_id ? entityRef('organization', { id: raw.organization_id }) : undefined;
      relations.assignee = raw.head_id ? entityRef('person', { id: raw.head_id }, raw.head_name) : undefined;
      relations.teams = readCachedList(['teams'])
        .filter((t) => t.department_id === raw.id)
        .map((t) => entityRef('team', t))
        .filter(Boolean) as EntityReference[];
      relations.people = peopleRefList((p) => p.department_id === raw.id, 6);
      break;
    }

    case 'team': {
      detail.subtitle = `${dash(raw.department_name)} • Show: ${dash(raw.current_project_code)}`;
      props['Team Lead'] = dash(raw.lead_name);
      props['Discipline'] = dash(raw.department_name);
      props['Assigned Show'] = dash(raw.current_project_code);
      props['Squad Members'] = dash(raw.member_count || raw.members_count, ' Artists');
      relations.parent = raw.organization_id ? entityRef('organization', { id: raw.organization_id }) : undefined;
      relations.project = raw.current_project_id ? projectRefFor({ project_id: raw.current_project_id, project_code: raw.current_project_code }) : undefined;
      relations.assignee = raw.lead_id ? entityRef('person', { id: raw.lead_id }, raw.lead_name) : undefined;
      relations.people = peopleRefList((p) => p.team_id === raw.id, 8);
      break;
    }

    case 'office': {
      detail.subtitle = `${dash(raw.city)}, ${dash(raw.country)} • ${dash(raw.timezone)}`;
      props['Facility Location'] = `${dash(raw.city)}, ${dash(raw.country)}`;
      props['Local Timezone'] = dash(raw.timezone);
      props['Capacity'] = dash(raw.capacity, ' Crew members');
      props['Facility Manager'] = dash(raw.manager_name);
      relations.parent = raw.organization_id ? entityRef('organization', { id: raw.organization_id }) : undefined;
      relations.people = peopleRefList((p) => p.office_id === raw.id || (raw.city && String(p.office_name || '').includes(raw.city)), 6);
      break;
    }

    case 'project': {
      detail.subtitle = `${dash(raw.type)} • Client: ${dash(raw.client_name)}`;
      props['Production Type'] = dash(raw.type);
      props['Client Studio'] = dash(raw.client_name);
      props['VFX Supervisor'] = dash(raw.supervisor_name);
      props['VFX Producer'] = dash(raw.coordinator_name);
      props['Timeline / Delivery'] =
        raw.start_date && raw.delivery_date ? `${raw.start_date} → ${raw.delivery_date}` : 'TBD';
      props['Resolution / FPS'] =
        raw.resolution || raw.fps ? `${dash(raw.resolution)} @ ${dash(raw.fps)} FPS` : '—';
      props['Color Management'] = dash(raw.color_space);
      relations.parent = raw.organization_id ? entityRef('organization', { id: raw.organization_id }) : undefined;
      relations.client = raw.client_id ? entityRef('client', { id: raw.client_id }, raw.client_name) : undefined;
      relations.assignee = raw.supervisor_id ? entityRef('person', { id: raw.supervisor_id }, raw.supervisor_name) : undefined;
      relations.reviewer = raw.coordinator_id ? entityRef('person', { id: raw.coordinator_id }, raw.coordinator_name) : undefined;
      relations.shots = readCachedList(['shots'])
        .filter((s) => s.project_id === raw.id || s.project_code === raw.code)
        .map((s) => entityRef('shot', s))
        .filter(Boolean) as EntityReference[];
      relations.assets = readCachedList(['assets'])
        .filter((a) => a.project_id === raw.id || a.project_code === raw.code)
        .map((a) => entityRef('asset', a))
        .filter(Boolean) as EntityReference[];
      relations.tasks = readCachedList(['tasks'])
        .filter((t) => t.project_id === raw.id || t.project_code === raw.code)
        .map((t) => entityRef('task', t))
        .filter(Boolean) as EntityReference[];
      break;
    }

    case 'sequence': {
      detail.subtitle = `Project: ${dash(raw.project_code)} • ${dash(raw.shots_count)} Shots`;
      props['Sequence Code'] = dash(raw.code);
      props['Parent Show'] = dash(raw.project_code);
      props['Total Cuts'] = dash(raw.shots_count, ' Shots');
      props['Approved Cuts'] = dash(raw.approved_shots, ' Shots');
      if (raw.shots_count && raw.approved_shots != null) {
        props['Completion'] = `${Math.round((raw.approved_shots / raw.shots_count) * 100)}%`;
      }
      relations.project = projectRefFor(raw);
      relations.shots = readCachedList(['shots'])
        .filter((s) => s.sequence_id === raw.id || s.sequence_code === raw.code)
        .map((s) => entityRef('shot', s))
        .filter(Boolean) as EntityReference[];
      break;
    }

    case 'shot': {
      detail.subtitle = `${dash(raw.project_code)} • Seq ${dash(raw.sequence_code)} • ${dash(raw.current_version)}`;
      props['Cut Frame Range'] =
        raw.frame_in != null ? `${raw.frame_in} - ${dash(raw.frame_out)} (${dash(raw.frame_count)} frames)` : '—';
      props['Current Version'] = dash(raw.current_version);
      props['Assigned Lead'] = dash(raw.assigned_artist_name);
      if (raw.supervisor_approved != null) {
        props['Supervisor Final'] = raw.supervisor_approved ? 'Approved' : 'Pending Review';
      }
      if (raw.project_code && raw.code) {
        props['OpenUSD Root Layer'] = `@studio/shows/${raw.project_code}/shots/${raw.code}/${raw.code}.usd`;
      }
      relations.project = projectRefFor(raw);
      relations.sequence = raw.sequence_id ? entityRef('sequence', { id: raw.sequence_id, code: raw.sequence_code }) : undefined;
      relations.assignee = raw.assigned_artist_id ? entityRef('person', { id: raw.assigned_artist_id }, raw.assigned_artist_name) : undefined;
      relations.tasks = tasksForTarget(String(raw.id), raw.code);
      relations.versions = versionsForTarget(String(raw.id), raw.code);
      relations.reviews = reviewsForTarget(String(raw.id), raw.code);
      break;
    }

    case 'asset': {
      detail.subtitle = `${dash(raw.category)} • ${dash(raw.project_code)} • ${dash(raw.version)}`;
      props['Asset Category'] = dash(raw.category);
      props['Polygon Count'] = raw.poly_count != null ? `${(raw.poly_count / 1000000).toFixed(2)}M Polygons` : '—';
      props['Authoring DCC'] = dash(raw.software);
      props['Payload Format'] = dash(raw.file_format);
      props['Artist Lead'] = dash(raw.assigned_artist_name);
      relations.project = projectRefFor(raw);
      relations.assignee = raw.assigned_artist_id ? entityRef('person', { id: raw.assigned_artist_id }, raw.assigned_artist_name) : undefined;
      relations.tasks = tasksForTarget(String(raw.id), raw.code);
      relations.versions = versionsForTarget(String(raw.id), raw.code);
      break;
    }

    case 'task': {
      detail.subtitle = `${dash(raw.department)} • ${dash(raw.entity_code)} • Due: ${dash(raw.due_date)}`;
      props['Discipline'] = dash(raw.department);
      props['Priority'] = dash(raw.priority);
      props['Target Entity'] = raw.entity_type || raw.entity_code ? `${dash(raw.entity_type)} ${dash(raw.entity_code)}` : '—';
      props['Assigned Artist'] = dash(raw.assignee_name);
      props['Supervisor Reviewer'] = dash(raw.reviewer_name);
      props['Estimated Budget'] = dash(raw.estimated_hours, ' hrs');
      props['Target Due Date'] = dash(raw.due_date);
      relations.project = projectRefFor(raw);
      const targetType = String(raw.entity_type || '').toLowerCase();
      if (raw.entity_id && targetType === 'shot') {
        relations.shot = entityRef('shot', { id: raw.entity_id, code: raw.entity_code });
      } else if (raw.entity_id && targetType === 'asset') {
        relations.asset = entityRef('asset', { id: raw.entity_id, code: raw.entity_code });
      }
      relations.assignee = raw.assignee_id ? entityRef('person', { id: raw.assignee_id }, raw.assignee_name) : undefined;
      relations.reviewer = raw.reviewer_id ? entityRef('person', { id: raw.reviewer_id }, raw.reviewer_name) : undefined;
      break;
    }

    case 'version': {
      detail.code = raw.entity_code && raw.version_number ? `${raw.entity_code}_${raw.version_number}` : rawCode(raw) || id;
      detail.title = `${dash(raw.entity_code)} ${dash(raw.version_number)}`.trim();
      detail.subtitle = `Show: ${dash(raw.project_code)} • ${dash(raw.frame_range)}`;
      props['Version Tag'] = dash(raw.version_number);
      props['Parent Entity'] = raw.entity_type || raw.entity_code ? `${dash(raw.entity_type)} [${dash(raw.entity_code)}]` : '—';
      props['Frame Range'] = dash(raw.frame_range);
      props['File Size'] = raw.file_size_mb != null ? `${raw.file_size_mb} MB` : '—';
      props['Submitter'] = dash(raw.published_by_name);
      relations.project = projectRefFor(raw);
      const targetType = String(raw.entity_type || '').toLowerCase();
      if (raw.entity_id && targetType === 'shot') {
        relations.shot = entityRef('shot', { id: raw.entity_id, code: raw.entity_code });
      } else if (raw.entity_id && targetType === 'asset') {
        relations.asset = entityRef('asset', { id: raw.entity_id, code: raw.entity_code });
      }
      relations.reviews = reviewsForTarget(String(raw.entity_id || id), raw.entity_code);
      break;
    }

    case 'review': {
      detail.subtitle = `${dash(raw.project_code)} • ${dash(raw.entity_code)} ${dash(raw.version_number)} • Lead: ${dash(raw.lead_reviewer_name)}`;
      props['Review Code'] = dash(raw.code);
      props['Target Cut'] = `${dash(raw.entity_code)} ${dash(raw.version_number)}`.trim();
      props['Lead Reviewer'] = dash(raw.lead_reviewer_name);
      props['Supervisor Verdict'] = dash(raw.supervisor_verdict);
      if (raw.resolution || raw.fps) {
        props['Playback Spec'] = `${dash(raw.resolution)} @ ${dash(raw.fps)} FPS`;
      }
      relations.project = projectRefFor(raw);
      relations.shot = raw.entity_id ? entityRef('shot', { id: raw.entity_id, code: raw.entity_code }) : undefined;
      relations.reviewer = raw.lead_reviewer_id ? entityRef('person', { id: raw.lead_reviewer_id }, raw.lead_reviewer_name) : undefined;
      relations.versions = versionsForTarget(String(raw.entity_id || id), raw.entity_code);
      break;
    }

    case 'playlist': {
      detail.subtitle = `${dash(raw.type)} • ${dash(raw.items_count)} Cuts`;
      props['Playlist Type'] = dash(raw.type);
      props['Reel Cuts'] = dash(raw.items_count, ' items');
      props['Reel Curator'] = dash(raw.author_name);
      props['Session Status'] = dash(raw.status);
      if (raw.is_locked != null) {
        props['Lock State'] = raw.is_locked ? 'Locked' : 'Editable';
      }
      relations.project = projectRefFor(raw);
      relations.assignee = raw.author_id ? entityRef('person', { id: raw.author_id }, raw.author_name) : undefined;
      relations.shots = Array.isArray(raw.entries)
        ? raw.entries
            .filter((e: AnyRecord) => String(e.entity_type || '').toLowerCase() === 'shot')
            .map((e: AnyRecord) => entityRef('shot', { id: e.entity_id, code: e.entity_code }, e.entity_code))
            .filter(Boolean) as EntityReference[]
        : [];
      break;
    }

    case 'workflow': {
      const stepsCount = raw.nodes?.length || raw.steps_count || 0;
      const autoCount = raw.automation_rules?.length || raw.automation_triggers_count || 0;
      detail.subtitle = `${dash(raw.category)} • v${dash(raw.version)} • ${stepsCount} DAG Steps`;
      detail.status = raw.is_active != null ? (raw.is_active ? 'Active' : 'Inactive') : raw.status;
      props['Pipeline Category'] = dash(raw.category);
      props['Schema Version'] = dash(raw.version);
      props['DAG Steps'] = dash(stepsCount);
      props['Active Automation Triggers'] = dash(autoCount);
      if (raw.last_executed_at) {
        props['Last Executed'] = new Date(raw.last_executed_at).toLocaleString();
      }
      relations.project = projectRefFor(raw);
      break;
    }

    case 'timelog': {
      detail.code = raw.id ? `TIME-${String(raw.id).toUpperCase()}` : id;
      detail.title = `${dash(raw.artist_name)}: ${dash(raw.task_title)} (${dash(raw.hours_logged)} hrs)`;
      detail.subtitle = `${dash(raw.department)} • ${dash(raw.entity_code)} • ${dash(raw.date_logged)}`;
      detail.status = raw.approved_by_name ? 'Approved' : 'Pending';
      props['Artist'] = dash(raw.artist_name);
      props['Department'] = dash(raw.department);
      props['Target Entity'] = dash(raw.entity_code);
      props['Hours Logged'] = dash(raw.hours_logged, ' hrs');
      props['Date'] = dash(raw.date_logged);
      if (raw.is_overtime != null) {
        props['Overtime'] = raw.is_overtime ? 'Yes (1.5x OT)' : 'Standard Hours';
      }
      props['Approved By'] = dash(raw.approved_by_name);
      relations.project = projectRefFor(raw);
      relations.assignee = raw.artist_id ? entityRef('person', { id: raw.artist_id }, raw.artist_name) : undefined;
      break;
    }

    case 'media': {
      detail.subtitle = `${dash(raw.media_type)} • ${dash(raw.file_format)} • ${raw.file_size_mb != null ? `${raw.file_size_mb} MB` : '—'}`;
      detail.status = raw.status || 'Active';
      props['Media Category'] = dash(raw.media_type);
      props['File Name'] = dash(raw.file_name);
      props['Format'] = dash(raw.file_format);
      props['Resolution'] = dash(raw.resolution);
      props['Framerate'] = raw.fps != null ? `${raw.fps} FPS` : 'N/A';
      props['Color Space'] = dash(raw.color_space);
      props['Storage Path'] = dash(raw.source_url);
      props['Uploaded By'] = dash(raw.uploaded_by);
      relations.project = projectRefFor(raw);
      break;
    }

    case 'attachment': {
      detail.title = raw.file_name || rawTitle(raw);
      detail.subtitle = `${dash(raw.category)} • ${dash(raw.file_type)}${raw.file_size_kb != null ? ` (${(raw.file_size_kb / 1024).toFixed(1)} MB)` : ''}`;
      detail.status = raw.status || 'Active';
      props['Document Category'] = dash(raw.category);
      props['File Format'] = dash(raw.file_type);
      props['File Size'] = raw.file_size_kb != null ? `${(raw.file_size_kb / 1024).toFixed(2)} MB` : '—';
      props['Document Version'] = dash(raw.version);
      props['Security Classification'] = dash(raw.security_classification);
      props['Uploaded By'] = dash(raw.uploaded_by);
      relations.project = projectRefFor(raw);
      break;
    }

    default:
      break;
  }

  return detail;
}

/**
 * Universal Entity Resolver
 * Resolves any entity by type and ID from the React Query cache into a rich
 * UniversalEntityDetail with its relational links for non-linear workspace
 * exploration. Returns null when the entity type has no backend list wired or
 * the entity is not present in the cache.
 */
export function resolveEntity(type: UniversalEntityType, id: string): UniversalEntityDetail | null {
  if (!id) return null;

  const roots = ENTITY_ROOTS[type];
  if (!roots || roots.length === 0) return null;

  const raw = findCachedNormalized(roots, id, ENTITY_MATCH_FIELDS[type] || ['id', 'code']);
  if (!raw) return null;

  return buildEntityDetail(type, id, raw);
}

/**
 * Universal Global Search across all cached entity collections
 */
export function searchUniversalEntities(query: string, filterType?: UniversalEntityType): EntityReference[] {
  const q = query.trim().toLowerCase();
  const all: EntityReference[] = [];

  for (const [type, roots] of Object.entries(ENTITY_ROOTS) as Array<[UniversalEntityType, string[]]>) {
    if (!roots || roots.length === 0) continue;
    if (filterType && type !== filterType) continue;

    for (const raw of readCachedList(roots)) {
      const title = rawTitle(raw);
      const code = rawCode(raw);
      if (!title && !code) continue;
      if (q) {
        const haystack = [title, code, raw.description, raw.status, raw.project_code]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) continue;
      }
      all.push({
        id: String(raw.id),
        type,
        title,
        code: code || undefined,
        subtitle: raw.description ? String(raw.description).slice(0, 80) : undefined,
        status: raw.status,
        thumbnail_url: raw.thumbnail_url || raw.avatar_url,
      });
      if (all.length >= 50) return all;
    }
  }

  return all;
}

/**
 * Format entity type into human label
 */
export function formatEntityType(type: UniversalEntityType): string {
  const map: Record<UniversalEntityType, string> = {
    organization: 'Organization',
    client: 'Client Studio',
    vendor: 'Vendor Partner',
    person: 'Crew Member',
    department: 'Department',
    team: 'Squad / Team',
    office: 'Office Facility',
    project: 'Project Show',
    sequence: 'Sequence',
    shot: 'Shot Cut',
    asset: 'Asset Element',
    task: 'Task Item',
    version: 'Published Version',
    review: 'Review Session',
    note: 'Supervisor Directive',
    delivery: 'Client Delivery',
    schedule: 'Schedule Milestone',
    resource: 'Compute / SAN Resource',
    publishing: 'USD Publish Record',
    playlist: 'Review Playlist / Reel',
    workflow: 'Pipeline Workflow DAG',
    timelog: 'Artist Timelog',
    calendar: 'Production Calendar',
    media: 'Source Media / Plate',
    attachment: 'Production Attachment',
  };
  return map[type] || type;
}
