import type React from 'react';
import type { PageFetcher } from '@/shared/data/listing';

/** A foreign key on a form: the page renders whatever picker fits (see components/forms/EntityPicker). */
export interface EntityFieldRenderProps {
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

/** Shared by every field: render it only for callers holding this backend permission (e.g. sensitive person fields). */
export interface FieldGate {
  permission?: string;
}

export type FieldDef = FieldGate &
  (
    | { kind: 'text' | 'textarea' | 'email' | 'url' | 'tel' | 'number' | 'date'; name: string; label: string; required?: boolean; hint?: string; maxLength?: number }
    | { kind: 'select'; name: string; label: string; options: ReadonlyArray<{ value: string; label: string }>; required?: boolean }
    | { kind: 'checkbox'; name: string; label: string }
    | { kind: 'entity'; name: string; label: string; required?: boolean; render: (props: EntityFieldRenderProps) => React.ReactNode }
  );

export interface ListColumn<T> {
  header: string;
  cell: (row: T) => React.ReactNode;
  /** Backend `ordering` field; makes the header clickable. Must be one the route supports. */
  sortField?: string;
}

export interface ListFilter {
  /** Backend filter parameter name. */
  key: string;
  label: string;
  /** Fixed choices. */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Or choices loaded from another list route (all rows, e.g. every department). */
  optionsFrom?: { queryKey: readonly unknown[]; fetchPage: PageFetcher<{ id: string }>; getLabel: (row: never) => string };
}

export interface DirectoryListConfig<T extends { id: string }> {
  /** Plural noun for titles and messages: "Teams". */
  title: string;
  /** Singular noun: "team". */
  noun: string;
  subtitle: string;
  queryKey: readonly unknown[];
  fetchPage: PageFetcher<T>;
  remove: (id: string) => Promise<unknown>;
  columns: ReadonlyArray<ListColumn<T>>;
  rowName: (row: T) => string;
  defaultOrdering: string;
  searchPlaceholder: string;
  filters?: ReadonlyArray<ListFilter>;
  /** Routes. */
  basePath: string;
  /** Where the first column links to. Default: the detail page `${basePath}/${id}`. */
  rowLink?: (row: T) => string;
  /** Permission code that shows the create/edit/delete controls. */
  managePermission: string;
  exportColumns?: ReadonlyArray<{ header: string; value: (row: T) => unknown }>;
  /** Lifecycle actions on a row (deactivate, restore, …), each behind a confirmation; shown with the manage permission. */
  rowActions?: (row: T) => ReadonlyArray<RowAction>;
}

export interface RowAction {
  label: string;
  confirm: string;
  destructive?: boolean;
  run: () => Promise<unknown>;
}

export interface DirectoryFormConfig<T extends { id: string }> {
  noun: string;
  basePath: string;
  queryKey: readonly unknown[];
  fields: ReadonlyArray<FieldDef>;
  get: (id: string, signal?: AbortSignal) => Promise<T>;
  create: (input: Record<string, unknown>) => Promise<T>;
  update: (id: string, patch: Record<string, unknown>) => Promise<T>;
  /** Where to go after saving. Default: the detail page `${basePath}/${id}`. */
  afterSavePath?: (saved: T) => string;
  /** Fields that cannot change after creation (the backend rejects them), shown read-only on edit. */
  immutableOnEdit?: ReadonlyArray<string>;
}
