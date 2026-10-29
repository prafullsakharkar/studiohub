import { IRepository } from './IRepository';
import { Task } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export interface ITaskRepository
  extends Omit<IRepository<Task, Partial<Task>, Partial<Task>>, 'bulkCreate' | 'bulkUpdate'> {
  checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Task>>;
  bulkCreate(payload: BulkCreateRequest<Task>): Promise<BulkOperationResponse<Task>>;
  bulkUpdate(payload: BulkUpdateRequest<Task>): Promise<BulkOperationResponse<Task>>;
  bulkArchive(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Task>>;
  bulkRestore(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Task>>;
  archiveTask(id: string): Promise<Task>;
  restoreTask(id: string): Promise<Task>;
}
