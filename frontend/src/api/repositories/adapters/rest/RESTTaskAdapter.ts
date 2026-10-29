import { BaseRESTAdapter } from './BaseRESTAdapter';
import { ITaskRepository } from '../../interfaces/ITaskRepository';
import { Task } from '@/types/production';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export class RESTTaskAdapter
  extends BaseRESTAdapter<Task, Partial<Task>, Partial<Task>>
  implements ITaskRepository
{
  constructor() {
    super('/api/v1/tasks');
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Task>> {
    return this.request<CheckExistenceResponse<Task>>(`${this.basePath}check-existence/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkCreate(payload: BulkCreateRequest<Task>): Promise<BulkOperationResponse<Task>> {
    return this.request<BulkOperationResponse<Task>>(`${this.basePath}bulk-create/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkUpdate(payload: BulkUpdateRequest<Task>): Promise<BulkOperationResponse<Task>> {
    return this.request<BulkOperationResponse<Task>>(`${this.basePath}bulk-update/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Task>> {
    return this.request<BulkOperationResponse<Task>>(`${this.basePath}bulk-archive/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<BulkOperationResponse<Task>> {
    return this.request<BulkOperationResponse<Task>>(`${this.basePath}bulk-restore/`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async archiveTask(id: string): Promise<Task> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<Task>(`${this.basePath}${cleanId}/archive/`, {
      method: 'POST',
    });
  }

  async restoreTask(id: string): Promise<Task> {
    const cleanId = encodeURIComponent(id.trim());
    return this.request<Task>(`${this.basePath}${cleanId}/restore/`, {
      method: 'POST',
    });
  }
}
