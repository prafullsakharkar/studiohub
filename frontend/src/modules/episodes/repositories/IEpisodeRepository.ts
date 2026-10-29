import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { Episode, EpisodeFilterParams } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export interface IEpisodeRepository
  extends Omit<IBaseRepository<Episode, Partial<Episode>, Partial<Episode>>, 'bulkCreate' | 'bulkUpdate'> {
  checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Episode>>;
  bulkCreate(payload: BulkCreateRequest<Episode>): Promise<BulkOperationResponse<Episode>>;
  bulkUpdate(payload: BulkUpdateRequest<Episode>): Promise<BulkOperationResponse<Episode>>;
  bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any>;
  bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any>;
  archiveEpisode(id: string): Promise<Episode>;
  restoreEpisode(id: string): Promise<Episode>;
}
