import React from 'react';
import { ProductionStatus, PriorityLevel } from './common';

export type EntityType =
  | 'client'
  | 'vendor'
  | 'project'
  | 'shot'
  | 'asset'
  | 'task'
  | 'version'
  | 'review'
  | 'person'
  | 'team'
  | 'department'
  | 'office'
  | 'organization';

export type EntityId = string;

export interface EntityReference {
  type: EntityType;
  id: EntityId;
  label?: string;
  code?: string;
  subtitle?: string;
  context?: string;
  avatarUrl?: string;
  badge?: string;
  status?: string;
  priority?: string;
}

export type FieldType =
  | 'text'
  | 'number'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'daterange'
  | 'status'
  | 'priority'
  | 'reference'
  | 'referenceList'
  | 'boolean'
  | 'currency'
  | 'user'
  | 'tags'
  | 'thumbnail'
  | 'code'
  | 'progress';

export interface SelectOption {
  label: string;
  value: string;
  color?: string;
  icon?: string;
}

export interface FieldDefinition<T = any> {
  key: string;
  label: string;
  type: FieldType;
  options?: SelectOption[];
  referenceType?: EntityType;
  referenceFilter?: (item: any) => boolean;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  hiddenByDefault?: boolean;
  required?: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  validation?: (value: any, formValues: Partial<T>) => string | null;
  renderCell?: (value: any, item: T) => React.ReactNode;
  renderFormInput?: (value: any, onChange: (val: any) => void, formValues: Partial<T>) => React.ReactNode;
  width?: number | string;
  minWidth?: number;
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
  | 'before'
  | 'after'
  | 'in'
  | 'notIn'
  | 'isEmpty'
  | 'isNotEmpty';

export interface FilterCondition {
  id: string;
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface FilterGroup {
  id: string;
  logicalOperator: 'AND' | 'OR';
  conditions: (FilterCondition | FilterGroup)[];
}

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface GroupConfig {
  field: string;
  collapsedGroups?: Record<string, boolean>;
}

export type DataViewMode =
  | 'table'
  | 'grid'
  | 'board'
  | 'timeline'
  | 'calendar'
  | 'hierarchy'
  | 'gallery';

export interface SavedView {
  id: string;
  name: string;
  entityType: EntityType;
  viewMode: DataViewMode;
  filters: FilterGroup;
  sort: SortConfig[];
  groupBy?: string;
  visibleColumns: string[];
  columnOrder?: string[];
  isDefault?: boolean;
  isFavorite?: boolean;
  isShared?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BulkAction<T = any> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning' | 'primary' | 'success';
  action: (selectedIds: string[], selectedItems: T[]) => Promise<void> | void;
  confirmMessage?: string;
}

export interface EntityAction<T = any> {
  id: string;
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'danger' | 'warning' | 'primary';
  action: (item: T) => Promise<void> | void;
  isVisible?: (item: T) => boolean;
  disabled?: (item: T) => boolean;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}
