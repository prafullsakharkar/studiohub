import { IRepository } from './IRepository';
import { Shot } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export interface IShotRepository
  extends Omit<IRepository<Shot, Partial<Shot>, Partial<Shot>>, 'bulkCreate' | 'bulkUpdate'> {
  approveShot(id: string): Promise<Shot>;
  checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Shot>>;
  bulkCreate(payload: BulkCreateRequest<Shot>): Promise<BulkOperationResponse<Shot>>;
  bulkUpdate(payload: BulkUpdateRequest<Shot>): Promise<BulkOperationResponse<Shot>>;
  bulkArchive(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Shot>>;
  bulkRestore(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Shot>>;
  archiveShot(id: string): Promise<Shot>;
  restoreShot(id: string): Promise<Shot>;
}
