import { ITaskRepository, taskRepository } from '@/api/repositories';
import { Task } from '@/types/production';
import { PaginatedResponse, QueryParams } from '@/types/common';
import { apiClient } from '@/api/client/ApiClient';
import {
  BulkCreateRequest,
  BulkUpdateRequest,
  BulkArchiveRestoreRequest,
  CheckExistencePayload,
  CheckExistenceResponse,
  BulkOperationResponse,
} from '@/types/production';

export class TaskService {
  private repository: ITaskRepository;

  constructor(repository: ITaskRepository = taskRepository) {
    this.repository = repository;
  }

  async getTasks(params?: QueryParams): Promise<PaginatedResponse<Task>> {
    return this.repository.findAll(params);
  }

  async getTaskById(id: string): Promise<Task> {
    return this.repository.findById(id);
  }

  async createTask(data: Partial<Task>): Promise<Task> {
    return this.repository.create(data);
  }

  async updateTask(id: string, data: Partial<Task>): Promise<Task> {
    return this.repository.patch(id, data);
  }

  async deleteTask(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async checkExistence(payload: CheckExistencePayload): Promise<CheckExistenceResponse<Task>> {
    return this.repository.checkExistence(payload);
  }

  async bulkCreate(payload: BulkCreateRequest<Task>): Promise<BulkOperationResponse<Task>> {
    return this.repository.bulkCreate(payload);
  }

  async bulkUpdate(payload: BulkUpdateRequest<Task>): Promise<BulkOperationResponse<Task>> {
    return this.repository.bulkUpdate(payload);
  }

  async bulkArchive(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repository.bulkArchive(payload);
  }

  async bulkRestore(payload: BulkArchiveRestoreRequest): Promise<any> {
    return this.repository.bulkRestore(payload);
  }

  async archiveTask(id: string): Promise<Task> {
    return this.repository.archiveTask(id);
  }

  async restoreTask(id: string): Promise<Task> {
    return this.repository.restoreTask(id);
  }

  async bulkAssign(payload: {
    task_ids: string[];
    assignee_id?: string;
    assignee_name?: string;
    assignee_avatar?: string;
    assignee_role?: string;
    team_id?: string;
    team_name?: string;
  }): Promise<{ success: boolean; updated_count: number }> {
    return apiClient.post<{ success: boolean; updated_count: number }>('/api/v1/tasks/bulk-assign/', payload);
  }

  async bulkStatusUpdate(payload: {
    task_ids: string[];
    status: string;
  }): Promise<{ success: boolean; updated_count: number }> {
    return apiClient.post<{ success: boolean; updated_count: number }>('/api/v1/tasks/bulk-status/', payload);
  }

  async bulkDelete(payload: {
    task_ids: string[];
  }): Promise<{ success: boolean; deleted_count: number }> {
    return apiClient.post<{ success: boolean; deleted_count: number }>('/api/v1/tasks/bulk-delete/', payload);
  }
}

export const taskService = new TaskService();
