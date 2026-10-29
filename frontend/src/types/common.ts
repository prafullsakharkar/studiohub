// ---------------------------------------------------------------------------
// from common.ts
// ---------------------------------------------------------------------------

export type ProductionStatus =
  | 'Bidding'
  | 'Pre-Production'
  | 'Ready'
  | 'Not Started'
  | 'In Progress'
  | 'Internal Review'
  | 'Supervisor Review'
  | 'Client Review'
  | 'Pending Review'
  | 'Approved'
  | 'Retake'
  | 'On Hold'
  | 'Omitted'
  | 'Delivered'
  | 'Archived'
  | string;
export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Urgent' | 'Critical' | string;
export type Department =
  | 'Art / Concept'
  | 'Modeling'
  | 'Texturing'
  | 'Rigging'
  | 'Layout'
  | 'Animation'
  | 'FX'
  | 'Crowd'
  | 'Lighting'
  | 'Matte Painting'
  | 'Comp'
  | 'RotoPrep'
  | 'Editorial'
  | 'Pipeline'
  | 'Production Management'
  | string;
export interface BaseEntity {
  id: string;
  created_at: string;
  updated_at?: string;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from crud.ts
// ---------------------------------------------------------------------------

export type EntityType =
  | 'project'
  | 'show'
  | 'episode'
  | 'sequence'
  | 'shot'
  | 'asset'
  | 'task'
  | 'version'
  | 'playlist'
  | 'delivery'
  | 'review'
  | 'person'
  | 'user'
  | 'client'
  | 'vendor'
  | 'department'
  | 'team'
  | 'office'
  | 'media'
  | 'attachment'
  | 'note'
  | 'timelog'
  | string;
export type EntityId = string;
export interface EntityReference {
  id: EntityId;
  type?: EntityType;
  code?: string;
  name?: string;
  title?: string;
  thumbnail_url?: string;
  status?: string;
  [key: string]: any;
}
export type DataViewMode = 'table' | 'board' | 'grid' | 'timeline' | 'hierarchy' | 'calendar' | string;
export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}
export type FilterOperator =
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'in'
  | 'notIn'
  | string;
export interface FilterCondition {
  id?: string;
  field: string;
  operator: FilterOperator;
  value?: any;
}
export interface FilterGroup {
  id?: string;
  logicalOperator: 'AND' | 'OR';
  conditions: (FilterCondition | FilterGroup)[];
}
export interface FieldDefinition<T = any> {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'status' | 'date' | 'reference' | 'boolean' | 'select' | 'badge' | 'avatar' | 'media' | 'json' | string;
  required?: boolean;
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  hiddenByDefault?: boolean;
  referenceType?: string;
  options?: { label: string; value: any; color?: string }[];
  render?: (value: any, row: T) => any;
  [key: string]: any;
}
export interface SavedView {
  id: string;
  name?: string;
  entityType?: EntityType | string;
  viewMode?: DataViewMode | string;
  filters?: FilterGroup;
  sort?: SortConfig[];
  visibleColumns?: string[];
  columnWidths?: Record<string, number>;
  groupBy?: string;
  isDefault?: boolean;
  isFavorite?: boolean;
  isShared?: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}
export interface BulkAction<T = any> {
  id?: string;
  key?: string;
  label: string;
  icon?: any;
  action?: (ids: EntityId[], items?: any[]) => any;
  variant?: string;
  requiredPermission?: string;
  disabled?: boolean;
  isVisible?: (items: any) => boolean;
  [key: string]: any;
}
export interface EntityAction<T = any> {
  id?: string;
  key?: string;
  label: string;
  icon?: any;
  action?: (entity: T) => any;
  variant?: string;
  requiredPermission?: string;
  disabled?: boolean | ((item: T) => boolean);
  isVisible?: (item: T) => boolean;
  [key: string]: any;
}

// ---------------------------------------------------------------------------
// from organization.ts (relocated, org-free)
// ---------------------------------------------------------------------------

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  icon?: any;
  action: () => void | Promise<void>;
  requiredPermission?: string;
  shortcut?: string;
  keywords?: string[];
  [key: string]: any;
}

/** List shape shared by directory list calls: paginated envelopes map to
 * items + count, bare-array responses map to items + null. */
export interface ListResult<T> {
  items: T[];
  totalCount: number | null;
}

// ---------------------------------------------------------------------------
// from drf.ts
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
export interface DrfErrorResponse {
  detail?: string;
  errors?: Record<string, string[] | string>;
  non_field_errors?: string[];
  [key: string]: any;
}
export interface QueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;
  [key: string]: any;
}
