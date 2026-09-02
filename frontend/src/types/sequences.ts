import { BaseEntity, ProductionStatus } from '@/types/common';

/**
 * A Sequence groups Shots within a Project.
 * Mirrors the backend `Sequence` model / serializer contract
 * (see backend/apps/production/api/serializers/sequence/base.py).
 */
export interface Sequence extends BaseEntity {
  uuid: string;
  project_id: string;
  project_code: string;
  project_name: string;
  code: string;
  name: string;
  status: ProductionStatus;
  description: string;
  frame_in: number;
  frame_out: number;
  department: string;
  tags: string[];
  metadata: Record<string, unknown>;
  shots_count: number;
  is_deleted: boolean;
  deleted_at: string | null;
}

/** Payload for creating/updating a Sequence (backend bulk-item contract). */
export interface SequenceInput {
  project_id: string;
  code: string;
  name?: string;
  status?: ProductionStatus | string;
  description?: string;
  frame_in?: number;
  frame_out?: number;
  department?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type SequenceUpdateInput = Partial<Omit<SequenceInput, 'project_id'>> & { id: string };

/** Per-item statuses returned by bulk operations. */
export type BulkResultStatus =
  | 'created'
  | 'updated'
  | 'archived'
  | 'restored'
  | 'exists'
  | 'soft_deleted'
  | 'duplicate'
  | 'invalid'
  | 'not_found';

export interface BulkResult {
  index: number;
  status: BulkResultStatus;
  id?: string;
  code?: string;
  deleted_at?: string | null;
  error?: string | unknown;
  entity?: Sequence;
}

/** Envelope returned by bulk-create / bulk-update / bulk-archive / bulk-restore. */
export interface BulkResponse {
  processed: number;
  successful: number;
  failed: number;
  results: BulkResult[];
}

/** Per-item statuses returned by existence-check. */
export type ExistenceStatus = 'new' | 'exists' | 'soft_deleted' | 'duplicate' | 'invalid';

export interface ExistenceResult {
  index: number;
  status: ExistenceStatus;
  id?: string;
  deleted_at?: string | null;
  error?: string;
}

export interface ExistenceResponse {
  results: ExistenceResult[];
}
