import { EntityType, EntityId, EntityReference } from '@/types/crud';
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

function findCached(rootKeys: string[], id: EntityId, fields: string[]): AnyRecord | null {
  return readCachedList(rootKeys).find((item) => fields.some((f) => item?.[f] === id)) || null;
}

/**
 * Reads real projects from the React Query cache (populated by useProjects /
 * useActiveProject). Returns [] until the list has been fetched.
 */
export function getRealProjects(): AnyRecord[] {
  return readCachedList(['projects']);
}

function findRealProject(id: EntityId): AnyRecord | null {
  return getRealProjects().find((p) => p.id === id || p.code === id) || null;
}

export interface EntityTypeConfig {
  type: EntityType;
  label: string;
  pluralLabel: string;
  iconName: string;
  colorClass: string;
  badgeBg: string;
  routePrefix: string;
  idPrefix: string;
}

export const ENTITY_CONFIGS: Record<EntityType, EntityTypeConfig> = {
  project: {
    type: 'project',
    label: 'Project',
    pluralLabel: 'Projects',
    iconName: 'Clapperboard',
    colorClass: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    routePrefix: '/projects',
    idPrefix: 'proj-',
  },
  shot: {
    type: 'shot',
    label: 'Shot',
    pluralLabel: 'Shots',
    iconName: 'Film',
    colorClass: 'text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    routePrefix: '/shots',
    idPrefix: 'shot-',
  },
  asset: {
    type: 'asset',
    label: 'Asset',
    pluralLabel: 'Assets',
    iconName: 'Boxes',
    colorClass: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    routePrefix: '/assets',
    idPrefix: 'ast-',
  },
  task: {
    type: 'task',
    label: 'Task',
    pluralLabel: 'Tasks',
    iconName: 'CheckSquare',
    colorClass: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    routePrefix: '/tasks',
    idPrefix: 'task-',
  },
  version: {
    type: 'version',
    label: 'Version',
    pluralLabel: 'Versions',
    iconName: 'Layers',
    colorClass: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    routePrefix: '/versions',
    idPrefix: 'ver-',
  },
  review: {
    type: 'review',
    label: 'Review Session',
    pluralLabel: 'Reviews',
    iconName: 'Eye',
    colorClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    routePrefix: '/reviews',
    idPrefix: 'rev-',
  },
  client: {
    type: 'client',
    label: 'Client',
    pluralLabel: 'Clients',
    iconName: 'Building2',
    colorClass: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    routePrefix: '/clients',
    idPrefix: 'cli-',
  },
  vendor: {
    type: 'vendor',
    label: 'Vendor',
    pluralLabel: 'Vendors',
    iconName: 'Truck',
    colorClass: 'text-orange-400',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    routePrefix: '/vendors',
    idPrefix: 'ven-',
  },
  person: {
    type: 'person',
    label: 'Person',
    pluralLabel: 'People',
    iconName: 'User',
    colorClass: 'text-teal-400',
    badgeBg: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    routePrefix: '/people',
    idPrefix: 'usr-',
  },
  team: {
    type: 'team',
    label: 'Team',
    pluralLabel: 'Teams',
    iconName: 'Users',
    colorClass: 'text-pink-400',
    badgeBg: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    routePrefix: '/teams',
    idPrefix: 'team-',
  },
  department: {
    type: 'department',
    label: 'Department',
    pluralLabel: 'Departments',
    iconName: 'Briefcase',
    colorClass: 'text-violet-400',
    badgeBg: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    routePrefix: '/departments',
    idPrefix: 'dept-',
  },
  office: {
    type: 'office',
    label: 'Office',
    pluralLabel: 'Offices',
    iconName: 'MapPin',
    colorClass: 'text-lime-400',
    badgeBg: 'bg-lime-500/10 text-lime-400 border-lime-500/20',
    routePrefix: '/offices',
    idPrefix: 'off-',
  },
  organization: {
    type: 'organization',
    label: 'Organization',
    pluralLabel: 'Organizations',
    iconName: 'Globe',
    colorClass: 'text-sky-400',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    routePrefix: '/organizations',
    idPrefix: 'org-',
  },
};

/**
 * Resolves raw entity data from the React Query cache by (type, id)
 */
export function resolveEntityRaw(type: EntityType, id: EntityId): any | null {
  if (!id) return null;

  switch (type) {
    case 'project':
      return findRealProject(id);
    case 'shot':
      return findCached(['shots'], id, ['id', 'code']);
    case 'task':
      return findCached(['tasks'], id, ['id', 'code']);
    case 'asset':
      return findCached(['assets'], id, ['id', 'code']);
    case 'review':
      return findCached(['reviews'], id, ['id', 'code']);
    case 'version':
      return findCached(['versions'], id, ['id', 'entity_code', 'version_code']);
    case 'client':
      return findCached(['clients'], id, ['id', 'code']);
    case 'vendor':
      return findCached(['vendors'], id, ['id', 'code']);
    case 'person':
      return findCached(['people', 'users'], id, ['id', 'email']);
    case 'team':
      return findCached(['teams'], id, ['id', 'code']);
    case 'department':
      return findCached(['departments'], id, ['id', 'code', 'name']);
    case 'office':
      return findCached(['offices'], id, ['id', 'code']);
    case 'organization':
      return findCached(['organizations'], id, ['id', 'code']);
    default:
      return null;
  }
}

/**
 * Creates a normalized EntityReference backed by canonical ID
 */
export function resolveEntityReference(type: EntityType, id: EntityId): EntityReference | null {
  const raw = resolveEntityRaw(type, id);
  if (!raw) {
    return {
      type,
      id,
      label: `${type} #${id}`,
      code: id,
    };
  }

  switch (type) {
    case 'project':
      return {
        type: 'project',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: raw.client_name || raw.genre,
        context: `Client: ${raw.client_name || '—'}`,
        badge: raw.status,
        status: raw.status,
      };
    case 'shot':
      return {
        type: 'shot',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: `${raw.project_code} • ${raw.frame_count || 0}f`,
        context: `Project: ${raw.project_name || raw.project_code || '—'}`,
        avatarUrl: raw.thumbnail_url,
        badge: raw.status,
        status: raw.status,
      };
    case 'task':
      return {
        type: 'task',
        id: raw.id,
        label: raw.title,
        code: raw.code,
        subtitle: `${raw.department} • ${raw.project_code}`,
        context: `Project: ${raw.project_code || '—'}`,
        avatarUrl: raw.assignee_avatar,
        badge: raw.status,
        status: raw.status,
        priority: raw.priority,
      };
    case 'asset':
      return {
        type: 'asset',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: `${raw.category} • ${raw.project_code}`,
        context: `Type: ${raw.category || '—'}`,
        avatarUrl: raw.thumbnail_url,
        badge: raw.status,
        status: raw.status,
      };
    case 'version':
      return {
        type: 'version',
        id: raw.id,
        label: raw.version_code || raw.name,
        code: raw.version_code,
        subtitle: `${raw.department} • ${raw.file_format || 'OpenUSD/EXR'}`,
        context: `Format: ${raw.file_format || '—'}`,
        badge: raw.approval_status || raw.status,
        status: raw.approval_status || raw.status,
      };
    case 'review':
      return {
        type: 'review',
        id: raw.id,
        label: raw.title || raw.name,
        code: raw.code,
        subtitle: `${raw.project_code} • ${raw.item_count || 0} items`,
        context: `Project: ${raw.project_code || '—'} • ${raw.item_count || 0} Items`,
        badge: raw.status,
        status: raw.status,
      };
    case 'client':
      return {
        type: 'client',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: raw.studio_type || raw.contract_tier,
        context: `Projects: ${raw.active_projects_count || 0}`,
        badge: raw.status,
        status: raw.status,
      };
    case 'vendor':
      return {
        type: 'vendor',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: raw.specialty || raw.tier,
        context: `Specialty: ${raw.specialty || '—'}`,
        badge: raw.status,
        status: raw.status,
      };
    case 'person':
      return {
        type: 'person',
        id: raw.id,
        label: raw.full_name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || raw.name,
        code: raw.role || raw.job_title,
        subtitle: raw.department || raw.email,
        context: `Team: ${raw.department || '—'}`,
        avatarUrl: raw.avatar_url,
        badge: raw.is_active ? 'Active' : 'Inactive',
      };
    case 'team':
      return {
        type: 'team',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: `${raw.lead_name || 'Team'} • ${raw.members_count || 0} crew`,
        context: `Lead: ${raw.lead_name || '—'} • ${raw.members_count || 0} Members`,
        badge: raw.status,
      };
    case 'department':
      return {
        type: 'department',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: `${raw.head_name || 'Lead'} • ${raw.active_tasks_count || 0} tasks`,
        context: `Lead: ${raw.head_name || '—'} • ${raw.active_tasks_count || 0} Tasks`,
        badge: raw.status,
      };
    case 'office':
      return {
        type: 'office',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: `${raw.city || raw.location}, ${raw.country || ''}`,
        context: `Location: ${raw.city || '—'}, ${raw.country || ''}`,
        badge: raw.status,
      };
    case 'organization':
      return {
        type: 'organization',
        id: raw.id,
        label: raw.name,
        code: raw.code,
        subtitle: raw.headquarters || raw.tier,
        context: `Headquarters: ${raw.headquarters || '—'}`,
        avatarUrl: raw.logo_url,
        badge: raw.status,
      };
    default:
      return null;
  }
}

/**
 * Searches across all entity registries with optional type filtering
 */
export function searchAllEntities(
  query: string,
  types?: EntityType[],
  limit = 20
): EntityReference[] {
  const allowedTypes: EntityType[] = types || [
    'project',
    'shot',
    'asset',
    'task',
    'version',
    'review',
    'client',
    'vendor',
    'person',
    'team',
    'department',
    'office',
    'organization',
  ];

  const results: EntityReference[] = [];
  const q = query.toLowerCase().trim();

  const SEARCH_SOURCES: Partial<Record<EntityType, string[]>> = {
    project: ['projects'],
    shot: ['shots'],
    asset: ['assets'],
    task: ['tasks'],
    version: ['versions'],
    review: ['reviews'],
    client: ['clients'],
    vendor: ['vendors'],
    person: ['people', 'users'],
    team: ['teams'],
    department: ['departments'],
    office: ['offices'],
    organization: ['organizations'],
  };

  for (const t of allowedTypes) {
    const rootKeys = SEARCH_SOURCES[t];
    if (!rootKeys) continue;
    const items: AnyRecord[] = readCachedList(rootKeys);

    for (const item of items) {
      if (results.length >= limit) break;
      const ref = resolveEntityReference(t, item.id);
      if (!ref) continue;

      if (!q) {
        results.push(ref);
      } else {
        const match =
          ref.label?.toLowerCase().includes(q) ||
          ref.code?.toLowerCase().includes(q) ||
          ref.subtitle?.toLowerCase().includes(q) ||
          ref.context?.toLowerCase().includes(q) ||
          ref.id.toLowerCase().includes(q);
        if (match) {
          results.push(ref);
        }
      }
    }
  }

  return results.slice(0, limit);
}

export interface RelatedEntityGroup {
  relationshipType: string;
  label: string;
  targetType: EntityType;
  entities: EntityReference[];
  count: number;
}

/**
 * Universal Relationship Resolution Engine:
 * Traverses relationships across business and production entities using IDs.
 */
export function getRelatedEntities(type: EntityType, id: EntityId): RelatedEntityGroup[] {
  const groups: RelatedEntityGroup[] = [];

  switch (type) {
    case 'client': {
      // Client -> Projects
      const projects = getRealProjects()
        .slice(0, 3)
        .map((p) => resolveEntityReference('project', p.id))
        .filter(Boolean) as EntityReference[];

      if (projects.length > 0) {
        groups.push({
          relationshipType: 'projects',
          label: 'Contracted Projects',
          targetType: 'project',
          entities: projects,
          count: projects.length,
        });
      }
      break;
    }

    case 'vendor': {
      // Vendor -> Projects
      const projects = getRealProjects()
        .slice(0, 2)
        .map((p) => resolveEntityReference('project', p.id))
        .filter(Boolean) as EntityReference[];

      groups.push({
        relationshipType: 'projects',
        label: 'Partnered Projects',
        targetType: 'project',
        entities: projects,
        count: projects.length,
      });
      break;
    }

    case 'project': {
      // Project -> Client
      const projectRaw = findRealProject(id);
      const client = projectRaw?.client_id
        ? resolveEntityReference('client', projectRaw.client_id)
        : null;
      if (client) {
        groups.push({
          relationshipType: 'client',
          label: 'Client Account',
          targetType: 'client',
          entities: [client],
          count: 1,
        });
      }

      // Project -> Shots
      const shots = readCachedList(['shots'])
        .filter((s) => s.project_id === id || s.project_code === id)
        .map((s) => resolveEntityReference('shot', s.id))
        .filter(Boolean) as EntityReference[];

      if (shots.length > 0) {
        groups.push({
          relationshipType: 'shots',
          label: 'Production Shots',
          targetType: 'shot',
          entities: shots,
          count: shots.length,
        });
      }

      // Project -> Assets
      const assets = readCachedList(['assets'])
        .filter((a) => a.project_id === id || a.project_code === id)
        .map((a) => resolveEntityReference('asset', a.id))
        .filter(Boolean) as EntityReference[];

      if (assets.length > 0) {
        groups.push({
          relationshipType: 'assets',
          label: 'Digital Assets',
          targetType: 'asset',
          entities: assets,
          count: assets.length,
        });
      }

      // Project -> Tasks
      const tasks = readCachedList(['tasks'])
        .filter((t) => t.project_id === id || t.project_code === id)
        .map((t) => resolveEntityReference('task', t.id))
        .filter(Boolean) as EntityReference[];

      if (tasks.length > 0) {
        groups.push({
          relationshipType: 'tasks',
          label: 'Active Tasks',
          targetType: 'task',
          entities: tasks,
          count: tasks.length,
        });
      }
      break;
    }

    case 'shot': {
      const shot = resolveEntityRaw('shot', id);
      if (!shot) break;

      // Shot -> Project
      const project = resolveEntityReference('project', shot.project_id);
      if (project) {
        groups.push({
          relationshipType: 'project',
          label: 'Parent Project',
          targetType: 'project',
          entities: [project],
          count: 1,
        });
      }

      // Shot -> Tasks
      const tasks = readCachedList(['tasks'])
        .filter(
          (t) => t.entity_id === id || ((t.entity_type || '').toLowerCase() === 'shot' && t.entity_code === shot.code)
        )
        .map((t) => resolveEntityReference('task', t.id))
        .filter(Boolean) as EntityReference[];

      if (tasks.length > 0) {
        groups.push({
          relationshipType: 'tasks',
          label: 'Work Tasks',
          targetType: 'task',
          entities: tasks,
          count: tasks.length,
        });
      }

      // Shot -> Versions
      const versions = readCachedList(['versions'])
        .filter((v) => v.entity_id === id || v.entity_code === shot.code)
        .slice(0, 3)
        .map((v) => resolveEntityReference('version', v.id))
        .filter(Boolean) as EntityReference[];

      if (versions.length > 0) {
        groups.push({
          relationshipType: 'versions',
          label: 'Published Versions',
          targetType: 'version',
          entities: versions,
          count: versions.length,
        });
      }

      // Shot -> Assignee (Person)
      if (shot.assigned_artist_id) {
        const artist = resolveEntityReference('person', shot.assigned_artist_id);
        if (artist) {
          groups.push({
            relationshipType: 'assignee',
            label: 'Assigned Lead Artist',
            targetType: 'person',
            entities: [artist],
            count: 1,
          });
        }
      }
      break;
    }

    case 'task': {
      const task = resolveEntityRaw('task', id);
      if (!task) break;

      // Task -> Project
      const project = resolveEntityReference('project', task.project_id);
      if (project) {
        groups.push({
          relationshipType: 'project',
          label: 'Parent Project',
          targetType: 'project',
          entities: [project],
          count: 1,
        });
      }

      // Task -> Shot / Asset
      if ((task.entity_type || '').toLowerCase() === 'shot' && task.entity_id) {
        const shot = resolveEntityReference('shot', task.entity_id);
        if (shot) {
          groups.push({
            relationshipType: 'target',
            label: 'Target Shot',
            targetType: 'shot',
            entities: [shot],
            count: 1,
          });
        }
      } else if ((task.entity_type || '').toLowerCase() === 'asset' && task.entity_id) {
        const asset = resolveEntityReference('asset', task.entity_id);
        if (asset) {
          groups.push({
            relationshipType: 'target',
            label: 'Target Asset',
            targetType: 'asset',
            entities: [asset],
            count: 1,
          });
        }
      }

      // Task -> Assignee (Person)
      if (task.assignee_id) {
        const assignee = resolveEntityReference('person', task.assignee_id);
        if (assignee) {
          groups.push({
            relationshipType: 'assignee',
            label: 'Assigned Artist',
            targetType: 'person',
            entities: [assignee],
            count: 1,
          });
        }
      }

      // Task -> Reviewer (Person)
      if (task.reviewer_id) {
        const reviewer = resolveEntityReference('person', task.reviewer_id);
        if (reviewer) {
          groups.push({
            relationshipType: 'reviewer',
            label: 'Assigned Supervisor',
            targetType: 'person',
            entities: [reviewer],
            count: 1,
          });
        }
      }
      break;
    }

    case 'version': {
      // Version -> Shot
      const versionRaw = resolveEntityRaw('version', id);
      const shot = versionRaw?.entity_id ? resolveEntityReference('shot', versionRaw.entity_id) : null;
      if (shot) {
        groups.push({
          relationshipType: 'shot',
          label: 'Source Shot',
          targetType: 'shot',
          entities: [shot],
          count: 1,
        });
      }

      // Version -> Reviews
      const reviews = readCachedList(['reviews'])
        .slice(0, 2)
        .map((r) => resolveEntityReference('review', r.id))
        .filter(Boolean) as EntityReference[];

      if (reviews.length > 0) {
        groups.push({
          relationshipType: 'reviews',
          label: 'Screening Reviews',
          targetType: 'review',
          entities: reviews,
          count: reviews.length,
        });
      }
      break;
    }

    case 'review': {
      // Review -> Versions
      const versions = readCachedList(['versions'])
        .slice(0, 4)
        .map((v) => resolveEntityReference('version', v.id))
        .filter(Boolean) as EntityReference[];

      if (versions.length > 0) {
        groups.push({
          relationshipType: 'versions',
          label: 'Screened Versions',
          targetType: 'version',
          entities: versions,
          count: versions.length,
        });
      }

      // Review -> Project
      const reviewRaw = resolveEntityRaw('review', id);
      const project = reviewRaw?.project_id ? resolveEntityReference('project', reviewRaw.project_id) : null;
      if (project) {
        groups.push({
          relationshipType: 'project',
          label: 'Project Context',
          targetType: 'project',
          entities: [project],
          count: 1,
        });
      }
      break;
    }

    case 'person': {
      // Person -> Teams
      const teams = readCachedList(['teams'])
        .slice(0, 2)
        .map((t) => resolveEntityReference('team', t.id))
        .filter(Boolean) as EntityReference[];

      groups.push({
        relationshipType: 'teams',
        label: 'Assigned Teams',
        targetType: 'team',
        entities: teams,
        count: teams.length,
      });

      // Person -> Projects
      const projects = getRealProjects()
        .slice(0, 3)
        .map((p) => resolveEntityReference('project', p.id))
        .filter(Boolean) as EntityReference[];

      groups.push({
        relationshipType: 'projects',
        label: 'Assigned Shows',
        targetType: 'project',
        entities: projects,
        count: projects.length,
      });

      // Person -> Active Tasks
      const tasks = readCachedList(['tasks'])
        .filter((t) => t.assignee_id === id)
        .map((t) => resolveEntityReference('task', t.id))
        .filter(Boolean) as EntityReference[];

      if (tasks.length > 0) {
        groups.push({
          relationshipType: 'tasks',
          label: 'Assigned Tasks',
          targetType: 'task',
          entities: tasks,
          count: tasks.length,
        });
      }
      break;
    }

    case 'team': {
      // Team -> Project
      const projects = getRealProjects()
        .slice(0, 2)
        .map((p) => resolveEntityReference('project', p.id))
        .filter(Boolean) as EntityReference[];

      groups.push({
        relationshipType: 'projects',
        label: 'Deployed Projects',
        targetType: 'project',
        entities: projects,
        count: projects.length,
      });

      // Team -> People
      const people = readCachedList(['people', 'users'])
        .slice(0, 4)
        .map((u) => resolveEntityReference('person', u.id))
        .filter(Boolean) as EntityReference[];

      groups.push({
        relationshipType: 'people',
        label: 'Roster Members',
        targetType: 'person',
        entities: people,
        count: people.length,
      });
      break;
    }

    default:
      break;
  }

  return groups;
}

/**
 * Universal Entity Registry Singleton Object
 */
export const entityRegistry = {
  getMetadata: (type: EntityType) => ENTITY_CONFIGS[type] || null,
  getAllConfigs: () => ENTITY_CONFIGS,
  resolveEntityRaw,
  resolveEntityReference,
  resolveEntitySummary: resolveEntityReference,
  getRelatedEntities,
  searchAllEntities,
};

