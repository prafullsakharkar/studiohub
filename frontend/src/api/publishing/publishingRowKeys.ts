/**
 * Exhaustive field lists for the hand-written row types in `publishing.ts`. They live here, outside `__tests__`,
 * because tsconfig excludes tests from `tsc`: `Record<keyof T, true>` only fails to compile when this file is
 * compiled. The tests then compare these lists with the captured responses.
 */
import type { Publish, PublishDestination, PublishedFile, PublishRow, StorageRoot } from './publishing';

export const PUBLISHROW_KEYS: Record<keyof PublishRow, true> = { project_id: true, client_name: true, code: true, created_at: true, dcc_tool: true, dcc_tool_display: true, dcc_version: true, entity_code: true, entity_name: true, entity_type: true, entity_type_display: true, export_format: true, export_path: true, id: true, is_archived: true, is_failed: true, is_success: true, job_status: true, name: true, retry_count: true, source_file: true, status: true, updated_at: true };
export const PUBLISH_KEYS: Record<keyof Publish, true> = { version_id: true, code: true, created_at: true, dcc_tool: true, dcc_tool_display: true, dcc_version: true, entity_code: true, entity_id: true, entity_name: true, entity_type: true, entity_type_display: true, error_message: true, export_format: true, export_options: true, export_path: true, id: true, is_archived: true, job_status: true, name: true, project: true, project_name: true, retry_count: true, source_file: true, source_version: true, status: true, updated_at: true, validation_results: true, validation_rules: true };
export const PUBLISHEDFILE_KEYS: Record<keyof PublishedFile, true> = { checksum_checked_at: true, checksum_state: true, created_at: true, created_by_id: true, export_job_id: true, file_type: true, frame_end: true, frame_start: true, id: true, project_id: true, relative_path: true, revoke_reason: true, role: true, sha256: true, size_bytes: true, status: true, status_changed_at: true, storage_root: true, version_id: true };
export const STORAGEROOT_KEYS: Record<keyof StorageRoot, true> = { code: true, created_at: true, id: true, is_active: true, linux_path: true, mac_path: true, name: true, updated_at: true, windows_path: true };
export const PUBLISHDESTINATION_KEYS: Record<keyof PublishDestination, true> = { created_at: true, id: true, is_active: true, is_default: true, name: true, path: true, protocol: true, region: true, type: true, updated_at: true };
