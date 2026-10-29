import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Sequence, SequenceFilterParams } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export interface ISequenceRepository
  extends Omit<IBaseRepository<Sequence, Partial<Sequence>, Partial<Sequence>>, 'bulkCreate' | 'bulkUpdate'> {
  checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Sequence>>;
  bulkCreate(payload: BulkCreateRequest<Sequence>): Promise<BulkOperationResponse<Sequence>>;
  bulkUpdate(payload: BulkUpdateRequest<Sequence>): Promise<BulkOperationResponse<Sequence>>;
  bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any>;
  bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any>;
  archiveSequence(id: string): Promise<Sequence>;
  restoreSequence(id: string): Promise<Sequence>;
}
