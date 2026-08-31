import { EntityType, EntityId } from '@/types/crud';
import { ActivityDiff, ActivityLogItem } from '@/types/enterprise';

/**
 * Raw shape returned by `GET /api/v1/audit/activities/`.
 */
export type RawActivity = {
  id: string;
  uuid?: string;
  activity_type?: string;
  status?: string;
  description?: string;
  user?: string;
  user_email?: string;
  user_name?: string;
  organization?: string;
  organization_name?: string;
  ip_address?: string | null;
  user_agent?: string;
  duration_seconds?: number | null;
  metadata?: {
    action?: string;
    actionLabel?: string;
    entity?: {
      type?: string;
      id?: string;
      code?: string;
      name?: string;
      context?: string;
    };
    actor?: { name?: string; role?: string };
    diffs?: ActivityDiff[];
    tags?: string[];
  };
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

const VALID_ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'archive',
  'restore',
  'assign',
  'unassign',
  'status_change',
  'upload',
  'review',
  'approve',
  'reject',
  'comment',
  'login',
  'export',
  'permission_change',
]);

const VALID_ENTITY_TYPES = new Set<EntityType>([
  'client',
  'vendor',
  'project',
  'shot',
  'asset',
  'task',
  'version',
  'review',
  'person',
  'team',
  'department',
  'office',
  'organization',
]);

function normalizeAction(action?: string): ActivityLogItem['action'] {
  const candidate = (action || '').toLowerCase();
  return (VALID_ACTIONS.has(candidate) ? candidate : 'status_change') as ActivityLogItem['action'];
}

function normalizeEntityType(type?: string): EntityType {
  const candidate = (type || '').toLowerCase();
  return (VALID_ENTITY_TYPES.has(candidate as EntityType) ? candidate : 'project') as EntityType;
}

export function toActivityLogItem(raw: RawActivity): ActivityLogItem {
  const metadata = raw.metadata ?? {};
  const entity = metadata.entity ?? {};
  const id: EntityId = entity.id ?? raw.uuid ?? raw.id;

  return {
    id: raw.uuid ?? raw.id,
    actor: {
      id: raw.user ?? raw.uuid ?? raw.id,
      name: metadata.actor?.name ?? raw.user_name ?? '',
      email: raw.user_email ?? '',
      role: metadata.actor?.role ?? '',
    },
    action: normalizeAction(metadata.action),
    actionLabel: metadata.actionLabel ?? (metadata.action || '').toUpperCase(),
    entity: {
      type: normalizeEntityType(entity.type),
      id,
      code: entity.code,
      name: entity.name ?? raw.description ?? '',
      context: entity.context ?? raw.organization_name ?? '',
    },
    timestamp: raw.created_at ?? new Date().toISOString(),
    description: raw.description ?? '',
    diffs: metadata.diffs,
    ipAddress: raw.ip_address ?? undefined,
    userAgent: raw.user_agent ?? undefined,
    metadata,
    tags: metadata.tags,
  };
}

export function normalizeActivities(raw: RawActivity[]): ActivityLogItem[] {
  return Array.isArray(raw) ? raw.map(toActivityLogItem) : [];
}
