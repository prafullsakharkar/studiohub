import { IRepository } from './IRepository';
import { Asset } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export interface IAssetRepository
  extends Omit<IRepository<Asset, Partial<Asset>, Partial<Asset>>, 'bulkCreate' | 'bulkUpdate'> {
  checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Asset>>;
  bulkCreate(payload: BulkCreateRequest<Asset>): Promise<BulkOperationResponse<Asset>>;
  bulkUpdate(payload: BulkUpdateRequest<Asset>): Promise<BulkOperationResponse<Asset>>;
  bulkArchive(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Asset>>;
  bulkRestore(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Asset>>;
  archiveAsset(id: string): Promise<Asset>;
  restoreAsset(id: string): Promise<Asset>;
}
