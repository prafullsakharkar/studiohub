/**
 * The types of the bulk screens (preview, resolve, result) that the three bulk managers and `useBulkEntity` share.
 * They describe the screens' own state, not an API response: what the bulk routes answer is typed in
 * `@/api/production/bulkRoutes`.
 */

export type EntityResolutionState =
  | 'NEW'
  | 'SOFT_DELETED'
  | 'EXISTS'
  | 'DUPLICATE_IN_REQUEST'
  | 'INVALID'
  | 'ERROR'
  | string;
export type ResolutionUserAction =
  | 'create'
  | 'recover'
  | 'skip'
  | 'overwrite'
  | 'CREATE'
  | 'OVERWRITE'
  | 'RESTORE'
  | 'RECOVER'
  | 'SKIP'
  | 'AUTO_RENAME'
  | string;
export interface EntityResolutionItem<T = any> {
  code: string;
  name?: string;
  state: EntityResolutionState;
  existingId?: string;
  existingEntity?: T;
  proposedData?: Partial<T>;
  parsedData?: Record<string, any>;
  userAction: ResolutionUserAction;
  newName?: string;
  newCode?: string;
  errorMessage?: string;
  errors?: string[];
  warnings?: string[];
  rowIndex?: number;
  [key: string]: any;
}
export interface BulkOperationSummary {
  total?: number;
  totalCount?: number;
  successCount?: number;
  failedCount?: number;
  createdCount?: number;
  updatedCount?: number;
  restoredCount?: number;
  recoveredCount?: number;
  skippedCount?: number;
  newCount?: number;
  softDeletedCount?: number;
  existingCount?: number;
  duplicateCount?: number;
  invalidCount?: number;
  [key: string]: any;
}
export interface BulkItemResult<T = any> {
  index?: number;
  code: string;
  id?: string;
  success: boolean;
  actionTaken?: ResolutionUserAction | 'CREATED' | 'UPDATED' | 'RESTORED' | 'SKIPPED' | string;
  entity?: T;
  error?: string;
  suggestedAction?: string;
  [key: string]: any;
}
export type BulkOperationResultItem<T = any> = BulkItemResult<T>;
export interface BulkOperationResponse<T = any> {
  success?: boolean;
  operation_id?: string;
  timestamp?: string;
  partial_success?: boolean;
  summary: BulkOperationSummary;
  results: BulkItemResult<T>[];
  errors?: string[];
  [key: string]: any;
}
export interface BulkUpdateFieldConfig<T = any> {
  key?: string | keyof T;
  label?: string;
  value?: any;
  newValue?: any;
  currentMixed?: boolean;
  currentCommonValue?: any;
  mode?: 'set' | 'append' | 'remove' | 'clear' | string;
  field?: string;
  action?: 'set' | 'append' | 'remove' | 'clear' | string;
  type?: 'text' | 'number' | 'select' | 'boolean' | 'date' | string;
  options?: string[] | { label: string; value: any }[];
  enabled?: boolean;
  [key: string]: any;
}
export interface BulkCreateItem<T = any> {
  code: string;
  action?: ResolutionUserAction;
  data: Partial<T>;
  [key: string]: any;
}
export interface BulkCreateRequest<T = any> {
  project_id?: string;
  projectId?: string;
  items: BulkCreateItem<T>[];
  mode?: 'strict' | 'best_effort';
  [key: string]: any;
}
export interface BulkUpdateRequest<T = any> {
  project_id?: string;
  projectId?: string;
  ids?: string[];
  codes?: string[];
  updates?: Partial<T>;
  fields?: BulkUpdateFieldConfig<T>[];
  [key: string]: any;
}
export interface BulkArchiveRestoreRequest {
  project_id?: string;
  projectId?: string;
  ids?: string[];
  codes?: string[];
  action?: 'archive' | 'restore';
  [key: string]: any;
}
export interface CheckExistencePayload {
  project_id?: string;
  projectId?: string;
  codes: string[];
  [key: string]: any;
}
export interface ExistingEntityInfo<T = any> {
  code: string;
  exists: boolean;
  is_deleted?: boolean;
  isDeleted?: boolean;
  entity?: T;
  id?: string;
  name?: string;
}
export interface CheckExistenceResponse<T = any> {
  results?: Record<string, ExistingEntityInfo<T>> | ExistingEntityInfo<T>[];
  items?: any[];
  existing_codes?: string[];
  deleted_codes?: string[];
  new_codes?: string[];
  [key: string]: any;
}
