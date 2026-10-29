import type React from 'react';
import type { PageFetcher } from '@/shared/data/listing';

/** A foreign key on a form: the page renders whatever picker fits (see components/forms/EntityPicker). */
export interface EntityFieldRenderProps {
  /** The parent record's id when the form lives inside one (a project's sequences pick that project's episodes). */
  parentId?: string;
  /** Every field's current value, for pickers that depend on another field (a task's shot depends on its project). */
  values: Record<string, string | boolean>;
  value: string;
  onChange: (id: string) => void;
  error?: string;
}

/** Shared by every field: render it only for callers holding this backend permission (e.g. sensitive person fields). */
export interface FieldGate {
  permission?: string;
  /** Show (and send) the field only while this holds, e.g. the shot picker only when the entity type is Shot. */
  visibleWhen?: (values: Record<string, string | boolean>) => boolean;
  /** Value of the field on a NEW record (a form can also be pre-filled from the query string). */
  initial?: string | boolean;
  /** The row property that holds the saved value when it is not the write name (a write takes `project`, a read has `project_id`). */
  rowKey?: string;
}

export type FieldDef = FieldGate &
  (
    | { kind: 'text' | 'textarea' | 'email' | 'url' | 'tel' | 'number' | 'date'; name: string; label: string; required?: boolean; hint?: string; maxLength?: number; /** Numbers: must be greater than zero. */ positive?: boolean }
    | { kind: 'select'; name: string; label: string; options: ReadonlyArray<{ value: string; label: string }>; required?: boolean; hint?: string }
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
  /** Creating is its own permission when it differs (an artist updates tasks but cannot create them). */
  createPermission?: string;
  /** Delete is its own permission when it differs (an artist edits tasks but cannot delete them). */
  deletePermission?: string;
  /** Per-row rules: an approved timelog is final, so it offers neither Edit nor Delete. */
  canEdit?: (row: T) => boolean;
  canRemove?: (row: T) => boolean;
  exportColumns?: ReadonlyArray<{ header: string; value: (row: T) => unknown }>;
  /** Soft-deleted rows live on their own route: adds an Active / Archived switch, and Restore in the archived view. */
  archived?: { fetchPage: PageFetcher<T>; restore: (id: string) => Promise<unknown> };
  /** What the delete control is called when "delete" really archives (default "Delete"). */
  deleteLabel?: string;
  /** Filters fixed by where the list sits (a project's shots tab): sent with every request and not offered as controls. */
  scope?: Record<string, string>;
  /** Query string for the New link, e.g. `project=<id>`, so the form opens pre-filled. */
  createQuery?: string;
  /** Extra header controls; receives the active filters (e.g. a bulk-add button once a project is chosen). */
  headerExtra?: (filters: Record<string, unknown>) => React.ReactNode;
  /** Tick rows and act on them all. */
  bulk?: { actions: ReadonlyArray<BulkAction> };
  /** Lifecycle actions on a row (deactivate, restore, …), each behind a confirmation; shown with the manage permission. */
  rowActions?: (row: T) => ReadonlyArray<RowAction>;
}

/** An action on the ticked rows (bulk status, assign, archive). */
export interface BulkAction {
  label: string;
  confirm: (count: number) => string;
  destructive?: boolean;
  /** Only offered while this holds for the active filters (assigning needs a project to pick members from). */
  available?: (filters: Record<string, unknown>) => boolean;
  /** Something to choose first: a status, an assignee. */
  input?: { label: string; required?: boolean; render: (props: { value: string; onChange: (value: string) => void; filters: Record<string, unknown> }) => React.ReactNode };
  /** May return a sentence (e.g. "2 of 3 updated; 1 refused") that is shown after the action. */
  run: (ids: string[], input?: string) => Promise<string | undefined | void>;
}

export interface RowAction {
  label: string;
  confirm: string;
  destructive?: boolean;
  /** Ask for a date first (e.g. the new end date of a contract); it is passed to `run`. */
  askDate?: { label: string; initial?: string | null };
  /** Ask for a reason first (rejecting a timelog needs one); it is passed to `run`. */
  askText?: { label: string; required?: boolean };
  run: (date?: string, text?: string) => Promise<unknown>;
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

/** A list of child records inside a parent's workspace (a client's contacts, a vendor's contracts). */
export interface RelatedRecordsConfig<T extends { id: string }> {
  noun: string;
  title: string;
  queryKey: readonly unknown[];
  /** Body field that names the parent: `client`, `vendor` or `project`. */
  parentField: string;
  /** The list filter that names the parent when it differs from the body field (editorial tracks filter on `project_id`). */
  filterField?: string;
  fetchPage: PageFetcher<T>;
  create: (input: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  columns: ReadonlyArray<{ header: string; cell: (row: T) => React.ReactNode }>;
  fields: ReadonlyArray<FieldDef>;
  rowName: (row: T) => string;
  defaultOrdering: string;
  managePermission: string;
  rowActions?: (row: T) => ReadonlyArray<RowAction>;
  /** "Delete" really archives (default "Delete"). */
  deleteLabel?: string;
  /** Soft-deleted rows on their own route: adds an Active / Archived switch and Restore. */
  archived?: { fetchPage: PageFetcher<T>; restore: (id: string) => Promise<unknown> };
  /** Fields the API refuses to change after creation (e.g. a contract's status: use the lifecycle actions). */
  immutableOnEdit?: ReadonlyArray<string>;
}
