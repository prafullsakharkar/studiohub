import { ITimelogRepository } from '../repositories/ITimelogRepository';
import { timelogRepository } from '../repositories/TimelogRepository';
import { Timelog } from '@/types/tasks';
import { PaginatedResponse, QueryParams } from '@/types/drf';
import { apiClient } from '@/api/client/ApiClient';

export class TimelogService {
  private repository: ITimelogRepository;

  constructor(repository: ITimelogRepository = timelogRepository) {
    this.repository = repository;
  }

  async getTimelogs(params?: QueryParams): Promise<PaginatedResponse<Timelog>> {
    return this.repository.findAll(params);
  }

  async getTimelogById(id: string): Promise<Timelog> {
    return this.repository.findById(id);
  }

  async createTimelog(data: Partial<Timelog>): Promise<Timelog> {
    return this.repository.create(data);
  }

  async updateTimelog(id: string, data: Partial<Timelog>): Promise<Timelog> {
    return this.repository.patch(id, data);
  }

  async deleteTimelog(id: string): Promise<void> {
    return this.repository.delete(id);
  }

  async approveTimelog(id: string, payload?: { approved_by_id?: string; approved_by_name?: string }): Promise<Timelog> {
    return apiClient.post<Timelog>(`/api/v1/timelogs/${id}/approve/`, payload || {});
  }

  async rejectTimelog(id: string, payload?: { rejection_reason?: string }): Promise<Timelog> {
    return apiClient.post<Timelog>(`/api/v1/timelogs/${id}/reject/`, payload || {});
  }
}

export const timelogService = new TimelogService();
