import type { EntityType, EntityId, EntityReference } from '@/types/common';

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
  sequence: {
    type: 'sequence',
    label: 'Sequence',
    pluralLabel: 'Sequences',
    iconName: 'Layers',
    colorClass: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    routePrefix: '/production',
    idPrefix: 'seq-',
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
};

/**
 * Resolves raw entity data by (type, id).
 * REST-only: returns null — real detail is loaded via API hooks.
 */
export function resolveEntityRaw(type: EntityType, id: EntityId): any | null {
  void type;
  void id;
  return null;
}

/**
 * Creates a normalized EntityReference backed by canonical ID.
 * REST-only: returns a lightweight fallback reference (no mock lookup).
 */
export function resolveEntityReference(type: EntityType, id: EntityId): EntityReference | null {
  if (!id) return null;
  return {
    type,
    id,
    label: `${type} #${id}`,
    code: String(id),
  };
}

/**
 * Searches across all entity registries with optional type filtering.
 * REST-only: returns [] — real search goes through /api/v1/* endpoints.
 */
export function searchAllEntities(
  query: string,
  types?: EntityType[],
  limit = 20
): EntityReference[] {
  void query;
  void types;
  void limit;
  return [];
}

export interface RelatedEntityGroup {
  relationshipType: string;
  label: string;
  targetType: EntityType;
  entities: EntityReference[];
  count: number;
}

/**
 * Universal Relationship Resolution Engine.
 * REST-only: returns [] — real relationships resolve via API-backed hooks.
 */
export function getRelatedEntities(type: EntityType, id: EntityId): RelatedEntityGroup[] {
  void type;
  void id;
  return [];
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
