import { IBaseRepository } from '@/core/repository/IBaseRepository';
import { PaginatedResponse, QueryParams } from '@/types/drf';
import {
  BulkResponse,
  ExistenceResponse,
  Sequence,
  SequenceInput,
  SequenceUpdateInput,
} from '@/types/sequences';

/**
 * Sequence repository contract.
 *
 * The backend exposes custom bulk `@action` endpoints that return a per-item
 * envelope (`BulkResponse`) rather than the generic `T[]` used by
 * `IBaseRepository`'s bulk methods, so those inherited methods are omitted and
 * re-declared with the sequence-specific contract.
 */
export interface ISequenceRepository
  extends Omit<
    IBaseRepository<Sequence, SequenceInput, SequenceUpdateInput>,
    'bulkCreate' | 'bulkUpdate' | 'bulkDelete'
  > {
  bulkCreate(items: SequenceInput[]): Promise<BulkResponse>;
  bulkUpdate(items: SequenceUpdateInput[]): Promise<BulkResponse>;
  bulkArchive(ids: string[]): Promise<BulkResponse>;
  bulkRestore(ids: string[]): Promise<BulkResponse>;
  existenceCheck(items: Array<Pick<SequenceInput, 'project_id' | 'code'>>): Promise<ExistenceResponse>;
  getArchived(params?: QueryParams): Promise<PaginatedResponse<Sequence>>;
}
