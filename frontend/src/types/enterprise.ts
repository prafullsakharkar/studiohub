import { EntityType, EntityId } from './crud';

export type PermissionAction = 'view' | 'create' | 'update' | 'archive' | 'delete' | '*';

export type EnterpriseResource =
  | 'organization'
  | 'client'
  | 'vendor'
  | 'people'
  | 'person'
  | 'department'
  | 'team'
  | 'office'
  | 'project'
  | 'shot'
  | 'asset'
  | 'task'
  | 'version'
  | 'review'
  | 'audit';

export type PermissionKey =
  | `${EnterpriseResource}.${PermissionAction}`
  | `${EnterpriseResource}.*`
  | '*'
  | string;

export interface EnterpriseRoleDefinition {
  id: string;
  name: string;
  description: string;
  badgeColor: string;
  isCustom?: boolean;
  permissions: PermissionKey[];
}

export type ActivityActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'archive'
  | 'restore'
  | 'assign'
  | 'unassign'
  | 'status_change'
  | 'upload'
  | 'review'
  | 'approve'
  | 'reject'
  | 'comment'
  | 'login'
  | 'export'
  | 'permission_change';

export interface ActivityDiff {
  field: string;
  label: string;
  before: string | number | boolean | null | undefined;
  after: string | number | boolean | null | undefined;
}

export interface ActivityActor {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl?: string;
  department?: string;
}

export interface ActivityEntityTarget {
  type: EntityType;
  id: EntityId;
  code?: string;
  name: string;
  context?: string;
  deepLink?: string;
}

export interface ActivityLogItem {
  id: string;
  actor: ActivityActor;
  action: ActivityActionType;
  actionLabel: string;
  entity: ActivityEntityTarget;
  timestamp: string; // ISO 8601
  description: string;
  diffs?: ActivityDiff[];
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface ActivityFilterOptions {
  query?: string;
  entityType?: EntityType | 'all';
  actionType?: ActivityActionType | 'all';
  actorId?: string | 'all';
  timeframe?: 'all' | 'today' | '7days' | '30days';
  startDate?: string;
  endDate?: string;
}

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  context?: string;
  category: 'Navigation' | 'Create' | 'Actions' | 'Entities' | 'System' | 'Audit';
  icon: React.ElementType;
  shortcut?: string;
  badge?: string;
  badgeColor?: string;
  permission?: PermissionKey;
  entityType?: EntityType;
  entityId?: EntityId;
  action: () => void;
  keywords?: string[];
}
